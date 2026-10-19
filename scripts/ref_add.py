#!/usr/bin/env python3
"""Discover the quantized residual-ADD semantics, bit-exactly (method of E2).

TFLite's int8 ADD cannot just add: the two operands live on different scales.
Reference algorithm (kernels/add.cc): pre-shift both inputs left by 20 bits,
scale each by its own Q31 multiplier (m_i = s_i / (2*max(s1,s2))), add, then
apply an output multiplier (2*max / (2^20 * s_out)) and the output zero point.
The open question — settled here empirically — is WHICH rounding each of the
three multiplier applications uses on this build.
"""
import numpy as np
from PIL import Image
from ai_edge_litert.interpreter import Interpreter, OpResolverType

def preprocess(p):
    img = Image.open(p).convert("RGB"); w,h = img.size
    s = 256/min(w,h); img = img.resize((round(w*s),round(h*s)), Image.BILINEAR); w,h = img.size
    img = img.crop(((w-224)//2,(h-224)//2,(w-224)//2+224,(h-224)//2+224))
    x = np.asarray(img,np.float32)/255.0
    x = (x-[0.485,0.456,0.406])/[0.229,0.224,0.225]
    return x.transpose(2,0,1)[None]

ip = Interpreter(model_path="src/model/resnet18_int8_channelwise.tflite",
                 experimental_op_resolver_type=OpResolverType.BUILTIN_WITHOUT_DEFAULT_DELEGATES,
                 experimental_preserve_all_tensors=True)
ip.allocate_tensors()
inp = ip.get_input_details()[0]; s_in, zp_in = inp['quantization']
ip.set_tensor(inp['index'], np.clip(np.round(preprocess("src/model/testdata/grace_hopper.jpg")/s_in)+zp_in,-128,127).astype(np.int8))
ip.invoke()
tens = {t['index']: t for t in ip.get_tensor_details()}

add = next(o for o in ip._get_ops_details() if o['op_name'] == 'ADD')   # first ADD = layer1.0
i1, i2 = add['inputs'][0], add['inputs'][1]; oi = add['outputs'][0]
X1 = ip.get_tensor(i1).astype(np.int64); X2 = ip.get_tensor(i2).astype(np.int64)
Y  = ip.get_tensor(oi).astype(np.int64)
q1 = tens[i1]['quantization_parameters']; q2 = tens[i2]['quantization_parameters']
qo = tens[oi]['quantization_parameters']
s1, z1 = float(q1['scales'][0]), int(q1['zero_points'][0])
s2, z2 = float(q2['scales'][0]), int(q2['zero_points'][0])
so, zo = float(qo['scales'][0]), int(qo['zero_points'][0])
print(f"ADD: {tens[i1]['name'][:38]} (s={s1:.5g},zp={z1})")
print(f"   + {tens[i2]['name'][:38]} (s={s2:.5g},zp={z2})")
print(f"  -> (s={so:.5g},zp={zo})  n={Y.size}")

LS = 20
tm = 2.0 * max(s1, s2)
def qmult(x):
    mant, exp = np.frexp(x)
    q = int(np.floor(mant * (1<<31) + 0.5)); e = int(exp)
    if q == (1<<31): q >>= 1; e += 1
    return q, e
(m1, e1), (m2, e2), (mo, eo) = qmult(s1/tm), qmult(s2/tm), qmult(tm/((1<<LS)*so))

def rdbpot(x, e):
    if e <= 0: return x << (-e)
    mask = (np.int64(1)<<np.int64(e)) - 1
    rem = x & mask; thr = (mask>>1) + np.where(x<0,1,0)
    return (x>>np.int64(e)) + (rem>thr)

def mbqm_B(x, m, e):      # trunc-SRDHM + RDBPOT (canonical gemmlowp)
    ls, rs = max(e,0), max(-e,0)
    p = (x << np.int64(ls)) * np.int64(m)
    nud = np.where(p>=0, np.int64(1)<<30, np.int64(1-(1<<30)))
    t = p + nud
    hi = np.where(t>=0, t>>np.int64(31), -((-t)>>np.int64(31)))
    return rdbpot(hi, rs)
def mbqm_C(x, m, e):      # single rounding of the full product
    ls, rs = max(e,0), max(-e,0)
    return rdbpot((x << np.int64(ls)) * np.int64(m), 31+rs)
def mbqm_E(x, m, e):      # trunc-SRDHM + half-up shift
    ls, rs = max(e,0), max(-e,0)
    p = (x << np.int64(ls)) * np.int64(m)
    nud = np.where(p>=0, np.int64(1)<<30, np.int64(1-(1<<30)))
    t = p + nud
    hi = np.where(t>=0, t>>np.int64(31), -((-t)>>np.int64(31)))
    add = np.where(np.int64(rs)>0, np.int64(1)<<np.int64(max(rs-1,0)), 0)
    return (hi + add) >> np.int64(rs)

sh1 = (X1 - z1) << LS
sh2 = (X2 - z2) << LS
for name, f in (("B gemmlowp", mbqm_B), ("C single", mbqm_C), ("E ruy", mbqm_E)):
    raw = f(sh1, m1, e1) + f(sh2, m2, e2)
    out = np.clip(f(raw, mo, eo) + zo, -128, 127)
    bad = int((out != Y).sum())
    d = np.unique((out-Y)[out!=Y]).tolist() if bad else []
    print(f"  variant {name:<12} mismatches={bad:<6} diffs={d[:4]}")
