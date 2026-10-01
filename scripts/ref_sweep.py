#!/usr/bin/env python3
"""Evidence for the requantize spec: replay EVERY CONV_2D and FULLY_CONNECTED
op in the .tflite through the single-round semantics of ref_conv.py (which
has the full math walkthrough — read that first) and count mismatches.

Expected result, and what it means (EXPERIMENTS.md E2):
  * all 20 convs: 0 mismatches      -> the spec holds; xrq implements this.
  * FC: <= 3 of 1000 off by ±1      -> EXPECTED. TFLite's FC kernel goes
    through a different backend (ruy: trunc-SRDHM + half-up shift) than its
    convs. We deliberately do NOT implement a second rounding mode in
    hardware for 0.05% of one layer's outputs; the deviation cannot move
    the argmax. This script reports it separately so a regression in the
    CONV numbers is never masked.
"""
import numpy as np
from PIL import Image
from ai_edge_litert.interpreter import Interpreter, OpResolverType

def preprocess(p):
    # Same torchvision ImageNet pipeline as ref_conv.py.
    img = Image.open(p).convert("RGB"); w,h = img.size
    s = 256/min(w,h); img = img.resize((round(w*s),round(h*s)), Image.BILINEAR); w,h = img.size
    img = img.crop(((w-224)//2,(h-224)//2,(w-224)//2+224,(h-224)//2+224))
    x = np.asarray(img,np.float32)/255.0
    x = (x-[0.485,0.456,0.406])/[0.229,0.224,0.225]
    return x.transpose(2,0,1)[None]

def rdbpot(x, e):
    # gemmlowp rounding shift — documented in ref_conv.py.
    mask = (np.int64(1)<<e) - 1
    rem = x & mask
    thr = (mask>>1) + np.where(x<0,1,0)
    return (x>>e) + (rem>thr)

# No-delegate interpreter with all tensors preserved: lets us read every
# op's true input/output (XNNPACK would fuse ops and hide them).
ip = Interpreter(model_path="src/model/resnet18_int8_channelwise.tflite",
                 experimental_op_resolver_type=OpResolverType.BUILTIN_WITHOUT_DEFAULT_DELEGATES,
                 experimental_preserve_all_tensors=True)
ip.allocate_tensors()
inp = ip.get_input_details()[0]; s_in, zp_in = inp['quantization']
ip.set_tensor(inp['index'], np.clip(np.round(preprocess("src/model/testdata/grace_hopper.jpg")/s_in)+zp_in,-128,127).astype(np.int8))
ip.invoke()
tens = {t['index']: t for t in ip.get_tensor_details()}

conv_bad = fc_bad = 0
for op in ip._get_ops_details():
    if op['op_name'] not in ('CONV_2D', 'FULLY_CONNECTED'):
        continue
    ai, wi, bi = op['inputs'][:3]; oi = op['outputs'][0]
    A = ip.get_tensor(ai).astype(np.int32); W = ip.get_tensor(wi).astype(np.int32)
    B = ip.get_tensor(bi).astype(np.int64); Y = ip.get_tensor(oi).astype(np.int32)
    qa = tens[ai]['quantization_parameters']; qw = tens[wi]['quantization_parameters']
    qo = tens[oi]['quantization_parameters']
    sa, za = float(qa['scales'][0]), int(qa['zero_points'][0])
    sw = qw['scales'].astype(np.float64)
    so, zo = float(qo['scales'][0]), int(qo['zero_points'][0])
    name = tens[wi]['name'].replace('g0::p_','').replace('_weight','')

    if op['op_name'] == 'FULLY_CONNECTED':
        # FC is already a GEMM: [1, Cin] x [Cout, Cin]^T. No im2col needed.
        cols = A.reshape(1, -1); Wm = W
        desc = f"FC   {W.shape[1]:>5} -> {W.shape[0]}"
    else:
        # Infer stride and SAME-padding from shapes; im2col exactly as in
        # ref_conv.py (pad fill = zero point!). Convs that follow an explicit
        # PAD op arrive pre-padded, and the formula then yields pad = 0.
        N,H,Wd,Cin = A.shape; Cout,kh,kw,_ = W.shape; Ho,Wo = Y.shape[1],Y.shape[2]
        stride = max(1, round(H/Ho))
        ph = max((Ho-1)*stride+kh-H, 0); pw = max((Wo-1)*stride+kw-Wd, 0)
        pt, pl = ph//2, pw//2
        Ap = np.full((N,H+ph,Wd+pw,Cin), za, np.int32); Ap[:,pt:pt+H,pl:pl+Wd,:] = A
        cols = np.empty((Ho*Wo, kh*kw*Cin), np.int32); r=0
        for y in range(Ho):
            for xw in range(Wo):
                cols[r] = Ap[0,y*stride:y*stride+kh,xw*stride:xw*stride+kw,:].ravel(); r+=1
        Wm = W.reshape(Cout,-1)
        desc = f"conv {kh}x{kw}x{Cin:<3} s{stride} K={kh*kw*Cin:<5}"

    # int32 GEMM with the zero-point hoist, + bias; then single-round requant.
    acc = (cols @ Wm.T - za*Wm.sum(axis=1)[None,:]).astype(np.int64) + B[None,:]
    mant, exp = np.frexp(sa*sw/so)
    M0 = np.round(mant*(1<<31)).astype(np.int64)
    rs = np.maximum(-exp.astype(np.int64), 0)[None,:]
    q = np.clip(rdbpot(acc*M0[None,:], 31+rs) + zo, -128, 127)

    bad = int((q != Y.reshape(q.shape)).sum())
    if op['op_name'] == 'FULLY_CONNECTED': fc_bad += bad
    else:                                  conv_bad += bad
    print(f"  {name:<22} {desc}  out={Y.size:>7}  mismatch={bad}")

print(f"\nconv mismatches: {conv_bad}   (spec requires 0)")
print(f"FC deviation:    {fc_bad}   (expected <=3: FC uses ruy's rounding, see EXPERIMENTS.md E2)")
print("SPEC HOLDS" if conv_bad == 0 else "SPEC BROKEN — do not build on this; investigate first")
