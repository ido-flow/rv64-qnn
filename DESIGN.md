# DESIGN — Quantized NN acceleration on RV64IMC

Status: **open**. Freezes week 4. After the freeze, changes need team agreement,
because the instruction encoding is the interface between the software and
hardware workstreams.

---

## 1. Workload

**ResNet-18, pre-quantized W8A8.**

| | |
|---|---|
| Source | `litert-community/resnet18` on Hugging Face |
| File | `resnet18_int8_channelwise.tflite` (11.9 MB, sha256 `8fea1acb62829e12…`) |
| Scheme | INT8 weights, INT8 activations, **per-output-channel** weight scales |
| Compute | ~1.81 GMAC / inference |
| Parameters | 11.7 M |

### Why not a transformer

The brief prefers transformers, but:

1. **Instructor ruling (JingJia, 15 Sep 2026):** "you may download the quantized
   versions... There is no need to perform quantization, retraining or similar
   tasks on the NN models." Confirmed verbally in class that a non-transformer
   model is acceptable if it is simpler.
2. litert-community publishes **no pre-quantized vision transformers** — no DeiT,
   MobileViT, EfficientFormer or LeViT. Taking a transformer would have required
   quantizing it ourselves, i.e. exactly what we were told not to do.
3. ResNet-18 removes the normalization problem entirely: BatchNorm folds into the
   preceding convolution at inference and does not exist as an operator. No
   LayerNorm, no GELU, no softmax on the critical path (argmax at the classifier).
   Non-GEMM work is ~0% of runtime.
4. Highest compute of the candidate list (1.81 GMAC) ⇒ most headroom to show speedup.

### Layer dimensions (im2col K)

| Stage | K = kh·kw·Cin | ÷8? |
|---|---:|---|
| conv1 (7x7x3) | 147 | **NO** |
| layer1 (3x3x64) | 576 | yes |
| layer2 (3x3x128) | 1152 | yes |
| layer3 (3x3x256) | 2304 | yes |
| layer4 (3x3x512) | 4608 | yes |
| fc | 512 | yes |

**Open issue:** `conv1` has K=147, not a multiple of 8. ~7% of total MACs.
Options: zero-pad the im2col buffer to K=152, or a scalar tail loop. Decide before freeze.

---

## 2. Target ISA

**`rv64imc_zicsr_zifencei`** — not plain `rv64imc`.

Modern binutils split CSR access out of base I into the `Zicsr` extension, so
`csrr minstret` does not assemble under `-march=rv64imc`. `Zifencei` is needed by
`crt.S`. Neither adds compute capability; the processor remains integer-only with
no F, D or V. Record this in the report as a toolchain detail, not a deviation.

Toolchain is xPack GCC 15.2.0, prefix **`riscv-none-elf-`** (not
`riscv64-unknown-elf-`). ABI `lp64` (not `lp64d` — that would imply FP).

---

## 3. Baseline measurement (B0)

Measured 22 Sep 2026, `riscv-none-elf-gcc -march=rv64imc_zicsr_zifencei -O2`:

The INT8 dot-product inner loop compiles to **8 instructions per MAC**:

```
.L3:  lb   a6,0(a5)     load activation
      lb   a4,0(a1)     load weight
      addi a5,a5,1      pointer bump
      subw a6,a6,a3     zero-point subtract
      mulw a4,a4,a6     multiply
      addi a1,a1,1      pointer bump
      addw a0,a0,a4     accumulate
      bne  a2,a5,.L3    loop
```

Verified: **0 floating-point instructions** emitted.

**B1 optimization already identified:** the `subw` zero-point correction can be
hoisted out of the loop entirely, since
`Σ(a_k − za)·w_k = Σ a_k·w_k − za·Σ w_k` and `Σ w_k` is a property of the weights,
precomputable offline. Removes 1 of 8 instructions (~12%) for free.

---

## 4. Instruction design — NOT YET FROZEN

### 4.1 `xqmac8` — packed 8-way INT8 MAC

Proposed semantics:

```
xqmac8 rd, rs1, rs2
    for i in 0..7:
        p[i] = sext(rs1[8i+7:8i]) * sext(rs2[8i+7:8i])   // signed 8x8 -> 16b
    rd = sext32to64( rd[31:0] + Σ p[i] )                  // 32-bit accumulate
```

Encoding: R-type, opcode `0001011` (custom-0), funct3 `000`, funct7 `0000000`.

**Accumulator width: 32-bit**, sign-extended into the 64-bit GPR.
Overflow analysis: max |product| = 16384; ×8 = 131072 (18 bits); over K=4608
(the largest in this model) = 75.5 M (27 bits). int32 does not overflow until
K > 131072, a 28× margin over our largest K.

**OPEN — the three-operand problem.** `rd` is both read and written, so the
instruction needs three register reads where RISC-V integer ops have two.
- (A) destructive accumulate, +1 register-file read port — *current preference*
- (B) R4-type with explicit rs3 — same cost, non-standard format, no benefit
- (C) dedicated accumulator registers — no extra port, but new architectural state

Decide after measuring the read port's area in DC.

### 4.2 `xrq` — requantize

Fuses: fixed-point multiply → rounding shift → zero-point add → saturate to int8.
Replaces ~8-12 RV64IMC instructions including two data-dependent branches
(RV64IMC has no `min`/`max` — those are in Zbb, which we do not have).

**Per-channel resolution:** the model uses per-output-channel scales, which
naively would force the parameters into a second source register. But per-channel
means per *output channel*, and each output channel produces thousands of output
elements (layer1: 3136 spatial positions). Looping **output-channel-outermost**,
the scale is written to a CSR once per channel and reused across thousands of
requantizations. **The cheap single-source form survives:**

```
csrw XRQ_MULT, M0              // once per output channel
csrw XRQ_CTRL, (n << 8) | zp   // once per output channel
xrq  rd, rs1                   // per output element
```

---

## 5. Open items before the week-4 freeze

- [ ] conv1 K=147 handling (pad vs tail loop)
- [ ] three-operand decision (A / B / C)
- [ ] exact CSR numbers for `XRQ_MULT` / `XRQ_CTRL`
- [ ] funct7/funct3 allocation for future variants (W8A16, unsigned weights)
- [x] **rounding mode SETTLED (2026-09-22, see EXPERIMENTS.md E2).** All 20 convs
      (2.18 M outputs) match bit-exactly with a SINGLE rounding:
      `q = clamp( RoundingDivideByPOT(acc * M0, 31 + rs) + zp_out )`,
      gemmlowp tie rule (threshold += 1 for negative x). The FC layer alone uses
      ruy's pipeline (trunc-SRDHM then half-up shift); we implement the conv
      semantics only — cheaper datapath (ONE rounding stage), deviation vs
      TFLite ≤ ±1 on ≤3 of 1000 logits, argmax unaffected. `scripts/ref_conv.py`
      is the golden reference; `scripts/ref_sweep.py` reproduces the evidence.
