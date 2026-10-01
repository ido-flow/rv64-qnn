#!/usr/bin/env python3
"""THE GOLDEN REFERENCE: bit-exact numpy model of one quantized CONV_2D.

This file is the specification everything else must match, in order:
    C kernel (src/kernels)  ->  Spike + xqmac8/xrq  ->  CV-Wally RTL.
It reproduces TFLite's integer conv EXACTLY (verified: 0 mismatches on all
20 convs of ResNet-18, 2.18 M outputs — see EXPERIMENTS.md E2 and
ref_sweep.py). Every arithmetic choice below is therefore hardware spec.

THE MATH, from the top:

  Affine quantization stores real numbers as   real = S * (q - Z)
  where q is int8, S (scale, float) and Z (zero point, int8) are per-tensor —
  except weights, which here are SYMMETRIC (Z=0) with a separate S per
  OUTPUT CHANNEL ("per-channel quantization").

  A conv output element is a dot product over K = kh*kw*Cin inputs:
      real_out = sum( S_a(a_k - Z_a) * S_w[c]*w_k ) + real_bias
  Divide by the output's own scale S_o and you get the int8 output:
      q_out = clamp( round( acc * (S_a*S_w[c]/S_o) ) + Z_o )
  where acc is the pure-integer part:
      acc = sum((a_k - Z_a) * w_k) + bias[c]          (int32)
  and bias[c] is stored pre-scaled to S_a*S_w[c] (so it adds directly).

  The float factor  eff = S_a*S_w[c]/S_o  (~0.001..0.05) must become integer
  arithmetic, because our processor has no FPU. Standard trick:
      eff = mant * 2^exp   (frexp: mant in [0.5, 1), exp <= 0 here)
      M0  = round(mant * 2^31)          # "Q31" fixed-point multiplier
      =>  acc * eff  ~=  (acc * M0) >> (31 - exp)  =  (acc*M0) >> (31 + rs)
  So requantization is: one 32x32->64-bit multiply, one ROUNDING right
  shift, add Z_o, clamp to [-128,127]. That is exactly what the xrq
  instruction will do in hardware.

  THE ROUNDING (the part we had to discover empirically, E2): the shift
  rounds to nearest with gemmlowp's tie rule, applied ONCE to the full
  64-bit product. The textbook two-step (SaturatingRoundingDoublingHighMul
  then RoundingDivideByPOT) rounds TWICE and lands +1 on ~0.065% of values.
  Hardware bonus: one rounding stage is cheaper than two.

  Fused ReLU costs nothing here: these convs have Z_o = -128, so clamping
  to [-128,127] IS the ReLU (real 0.0 sits exactly at q = -128).

Run:  python3 scripts/ref_conv.py [layer-name-substring]   (default layer1_0_conv1)
"""
import sys
import numpy as np
from PIL import Image
from ai_edge_litert.interpreter import Interpreter, OpResolverType

TARGET = sys.argv[1] if len(sys.argv) > 1 else "layer1_0_conv1"

def preprocess(path):
    """torchvision-style ImageNet preprocessing (the model card's convention):
    resize shorter side to 256, center-crop 224, scale to [0,1], normalize by
    ImageNet mean/std, HWC->NCHW. Validated by the smoke test (top-1
    'military uniform' on grace_hopper.jpg)."""
    img = Image.open(path).convert("RGB"); w, h = img.size
    s = 256 / min(w, h)
    img = img.resize((round(w*s), round(h*s)), Image.BILINEAR); w, h = img.size
    img = img.crop(((w-224)//2, (h-224)//2, (w-224)//2+224, (h-224)//2+224))
    x = np.asarray(img, np.float32) / 255.0
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    return x.transpose(2, 0, 1)[None]

# The XNNPACK delegate FUSES ops and hides intermediate tensors, so we load
# the interpreter WITHOUT it and preserve all tensors — that is what lets us
# pull any layer's exact input/output out for comparison.
ip = Interpreter(model_path="src/model/resnet18_int8_channelwise.tflite",
                 experimental_op_resolver_type=OpResolverType.BUILTIN_WITHOUT_DEFAULT_DELEGATES,
                 experimental_preserve_all_tensors=True)
ip.allocate_tensors()
inp = ip.get_input_details()[0]
s_in, zp_in = inp['quantization']
x = preprocess("src/model/testdata/grace_hopper.jpg")
# quantize the input image with ITS tensor's scale/zero-point
ip.set_tensor(inp['index'], np.clip(np.round(x/s_in)+zp_in, -128, 127).astype(np.int8))
ip.invoke()

# Locate the CONV_2D op whose weight tensor name contains TARGET, then pull
# its exact operands. CONV_2D input order is [activations, weights, bias].
tens = {t['index']: t for t in ip.get_tensor_details()}
op = next(o for o in ip._get_ops_details() if o['op_name'] == 'CONV_2D'
          and any(TARGET in tens[i]['name'] for i in o['inputs'] if i in tens))
ai, wi, bi = op['inputs'][0], op['inputs'][1], op['inputs'][2]
oi = op['outputs'][0]

A  = ip.get_tensor(ai).astype(np.int32)      # activations, NHWC int8
W  = ip.get_tensor(wi).astype(np.int32)      # weights, [Cout, kh, kw, Cin] int8
B  = ip.get_tensor(bi).astype(np.int64)      # bias, int32 at scale S_a*S_w[c]
Y  = ip.get_tensor(oi).astype(np.int32)      # TFLite's own output = the target
qa = tens[ai]['quantization_parameters']; qw = tens[wi]['quantization_parameters']
qo = tens[oi]['quantization_parameters']
sa, za = float(qa['scales'][0]), int(qa['zero_points'][0])
sw = qw['scales'].astype(np.float64)         # per-output-channel scales
so, zo = float(qo['scales'][0]), int(qo['zero_points'][0])

# Infer stride/pad from shapes (the flatbuffer op options are not exposed by
# this API): SAME padding solves (Ho-1)*stride + kh - H, split symmetrically.
N, H, Wd, Cin = A.shape
Cout, kh, kw, _ = W.shape
Ho, Wo = Y.shape[1], Y.shape[2]
stride = (H + (1 if H % Ho else 0)) // Ho if Ho != H else 1
pad_h = max((Ho - 1)*stride + kh - H, 0); pt = pad_h // 2
pad_w = max((Wo - 1)*stride + kw - Wd, 0); pl = pad_w // 2
print(f"conv: in {A.shape} w {W.shape} -> out {Y.shape}  stride={stride} pad=({pt},{pl})")
print(f"scales: act={sa:.6g} zp={za} | out={so:.6g} zp={zo} | K={kh*kw*Cin}")

# ---- im2col: unroll each output position's kh*kw*Cin receptive field into a
# row, turning the conv into ONE big GEMM of [Ho*Wo, K] x [K, Cout].
# ⚠ Quantized padding fills with the ZERO POINT (za = real 0.0), never with
# integer 0 (which would be real +0.83 here — every border pixel wrong).
Ap = np.full((N, H+pad_h, Wd+pad_w, Cin), za, np.int32)
Ap[:, pt:pt+H, pl:pl+Wd, :] = A
cols = np.empty((Ho*Wo, kh*kw*Cin), np.int32)
r = 0
for y in range(Ho):
    for xw in range(Wo):
        cols[r] = Ap[0, y*stride:y*stride+kh, xw*stride:xw*stride+kw, :].ravel(); r += 1
Wm = W.reshape(Cout, -1)                     # [Cout, K]

# ---- int32 GEMM. The zero point is NOT subtracted per element; instead:
#   sum((a_k - za)*w_k) = sum(a_k*w_k) - za*sum(w_k)
# and sum(w_k) per output channel is a compile-time constant of the weights.
# This "zero-point hoist" removes one op per MAC — it is also the B1 software
# optimization, and the reason the C kernel can use a pure a*w inner loop.
acc = cols @ Wm.T - za * Wm.sum(axis=1)[None, :]
acc = acc.astype(np.int64) + B[None, :]

# ---- requantize: eff -> Q31 fixed point (see header for the derivation)
eff = (sa * sw / so)                          # per channel, ~0.02 here
mant, exp = np.frexp(eff)                     # eff = mant * 2^exp
M0 = np.round(mant * (1 << 31)).astype(np.int64)   # Q31 multiplier
shift = exp.astype(np.int64)                  # <= 0 for eff < 0.5

def rdbpot(x, e):
    """gemmlowp RoundingDivideByPOT: arithmetic shift right by e, rounding to
    nearest; the tie (remainder exactly half) rounds AWAY from zero, which is
    what the +1 threshold adjustment for negative x implements."""
    mask = (np.int64(1) << e) - 1
    rem = x & mask
    thr = (mask >> 1) + np.where(x < 0, 1, 0)
    return (x >> e) + (rem > thr)

# CONFIRMED SPEC (EXPERIMENTS.md E2): ONE single rounding of the full 64-bit
# product acc*M0 — NOT the textbook two-step SRDHM+RDBPOT, which double-rounds
# and misses by +1 on 0.065% of outputs. This line IS the xrq datapath.
rs = np.maximum(-shift, 0)
q = rdbpot(acc * M0[None, :], 31 + rs[None, :])
q = q + zo
q = np.clip(q, -128, 127)                     # saturate; with zo=-128 this is also the fused ReLU

ref = Y.reshape(-1, Cout)
mism = int((q != ref).sum())
print(f"\nelements={ref.size}  mismatches={mism}  ({100*mism/ref.size:.4f}%)")
if mism:
    d = (q - ref)[q != ref]
    vals, cnts = np.unique(d, return_counts=True)
    print("diff histogram:", dict(zip(vals.tolist(), cnts.tolist())))
    print("ref min/max:", ref.min(), ref.max(), "| ours min/max:", int(q.min()), int(q.max()), "| zp_out:", zo)
else:
    print("BIT-EXACT MATCH — this file is the requantize specification.")
