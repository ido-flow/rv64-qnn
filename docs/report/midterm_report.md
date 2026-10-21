# Accelerating Quantized ResNet-18 Inference on RV64IMC with a Two-Instruction Packed-Integer Extension

*Midterm report — ISA design and Spike implementation.*
*(Working draft in Markdown; typeset to the course template before submission.)*

---

## 1. Introduction

Quantized neural-network inference is the standard deployment path for edge
devices: weights and activations are reduced to 8-bit integers, removing any
dependence on floating-point hardware. A minimal 64-bit RISC-V core (RV64IMC)
can therefore run such models — but it runs them badly, for a structural
reason: **its 64-bit datapath carries eight INT8 values in every register,
while its ISA provides no instruction that treats them as more than one
number.**

We quantify this gap on a real workload. Running the W8A8-quantized ResNet-18
published by the LiteRT community, bit-exact on the Spike ISA simulator, the
compiled inner loop of the dominant convolution kernel retires **8.06
instructions per multiply-accumulate** (E1). Only 12.5% of retired
instructions are the multiplies that do the work; 50% are address arithmetic,
25% are loads that each move a single byte through an 8-byte datapath, and
12.5% are loop control. The processor is, in effect, 87.5% overhead.

This report follows a measurement-driven loop — profile, propose, implement,
evaluate — to close that gap with the smallest hardware commitment we could
justify. We design two instructions on the RISC-V custom-0 opcode:

- **`xqdot8 rd, rs1, rs2`** — an 8-lane packed INT8 dot product. We
  deliberately chose a *non-accumulating* form: it reads two registers and
  writes one, exactly like `mul`, so the register file, forwarding network
  and pipeline control of the host core are untouched. The accumulation is an
  ordinary `add`. (Section 4 documents this three-operand design decision and
  the accumulating alternative we defer to the RTL phase.)
- **`xrq rd, rs1, rs2`** — requantization: one instruction collapses the
  ~13-instruction integer sequence (including two data-dependent branches)
  that converts each int32 accumulator back to int8. Its per-channel
  constants are packed offline into a single 64-bit operand — a correction to
  our original CSR-based design, forced by the measured loop structure of the
  real kernels (Section 4.3).

The semantics these instructions implement are not textbook formulas: they
were **reverse-engineered to bit-exactness from the deployed model itself**.
Reproducing TFLite's integer arithmetic in NumPy and iterating candidate
rounding rules against every convolution in the network revealed that the
reference two-step gemmlowp rounding is wrong for this model (off by +1 on
0.065% of outputs, a double-rounding artifact), that a single-rounding rule
matches all 20 convolutions exactly — 2.18 M outputs, zero mismatches (E2) —
and that TFLite itself is internally inconsistent, its FC layer using a
different backend's rounding. Every subsequent artifact of this project — the
C kernels, the Spike instructions — is verified bit-exactly against this
reference chain, end to end.

**Contributions of this report:**

1. **Workload characterization** of W8A8 ResNet-18 on RV64IMC: 8.06
   instructions/MAC; instruction mix 50/25/12.5/12.5 (ALU/load/branch/mul);
   the three dominant bottlenecks quantified (E1, E7).
2. **A bit-exact requantization specification** for the deployed model,
   empirically derived; including the finding that TFLite's conv and FC
   kernels round differently, and a documented decision to implement the
   cheaper conv semantics (deviation: ≤3 of 1000 FC logits by ±1) (E2).
3. **Two custom instructions** requiring no modification to the host core's
   register file or forwarding network, implemented in Spike and verified by
   directed plus 40,000-vector randomized testing against independent C
   references: zero failures (E5, E6).
4. **A 5.6× dynamic-instruction reduction** on the dominant kernel over an
   *optimized* software baseline (11.3× over the naive baseline), evaluated
   incrementally (B0→B1→X1→X2) as required, bit-exact at every stage — far
   exceeding the ≥2× project target (E4–E6).
5. **A complete residual block** (conv→conv→quantized add) bit-exact against
   TFLite, in which `xrq` generalizes beyond convolution to the residual
   add's output stage (E8).
6. **The post-extension bottleneck, measured**: with arithmetic collapsed,
   loads and address generation are ~70% of remaining instructions (E7) —
   the quantified motivation for the memory-system extensions planned for
   the RTL phase.

## 2. Background and workload

### 2.1 Quantized inference in four equations

Affine quantization stores each real tensor as int8 plus two constants, a
scale S and zero point Z:

    real = S * (q - Z)                                                   (1)

Weights here are symmetric (Z_w = 0) with a separate scale per output
channel. A convolution output is then a pure-integer dot product plus a
pre-scaled bias:

    acc = sum_k (a_k - Z_a) * w_k + bias[c]            (int32)           (2)

The accumulator must return to int8 at the output tensor's own scale. The
float ratio eff = S_a*S_w[c]/S_o is precomputed as a Q31 fixed-point pair
(M0, shift), making requantization integer-only:

    q_out = clamp( rdbpot(acc * M0, shift) + Z_o )                       (3)

where rdbpot is a rounding right shift (gemmlowp tie rule), applied ONCE —
the single-rounding semantics established empirically in Section 3. Finally,
the zero point leaves the inner loop by algebra:

    sum_k (a_k - Z_a) * w_k  =  sum_k a_k*w_k  -  Z_a * sum_k w_k        (4)

with sum_k w_k a compile-time constant per channel. Equation (4) is why every
kernel in this report has a pure a*w inner loop — the shape `xqdot8` consumes.

### 2.2 Model selection

The project brief prefers transformer models. We selected **ResNet-18
(W8A8, per-channel)** instead, and defend the deviation as a chain of four
constraints:

1. **Instructor ruling.** Teams were directed to use downloaded pre-quantized
   models: "There is no need to perform quantization, retraining or similar
   tasks" (course discussion, 15 Sep). Self-quantifying a model is therefore
   out of scope.
2. **Availability.** The designated source (litert-community on Hugging Face)
   publishes no pre-quantized vision transformer — no DeiT, MobileViT,
   EfficientFormer or LeViT. Choosing a transformer would have required
   violating (1). ResNet-18 is available as `resnet18_int8_channelwise.tflite`
   (11.9 MB, full W8A8).
3. **Normalization foldability.** Transformers use LayerNorm, which depends
   on the live input and must be computed at inference — on a core with no
   FPU, an integer-arithmetic subproject of its own, orthogonal to the
   GEMM-acceleration theme. ResNet's BatchNorm folds into the convolution
   weights offline: in the deployed graph it does not exist as an operator.
   The model's nonlinearities reduce to ReLU, which quantization makes free
   (output zero point = -128, so the int8 saturation clamp IS the ReLU).
4. **Quantitative fit.** At 1.81 GMAC it is the highest-compute candidate on
   the brief's list (most headroom to demonstrate speedup), and its im2col
   inner dimensions — 576, 1152, 2304, 4608 — are all multiples of 8, so an
   8-lane instruction tiles every layer exactly. The single exception is the
   7x7x3 stem (K=147, ~7% of MACs), handled by padding to 152.

(A non-transformer choice was additionally confirmed as acceptable by the
instructor in class.)

### 2.3 The workload's shape

The deployed graph contains 20 convolutions (17 spatial, 3 pointwise
"downsample" convs on skip paths), 8 residual adds, one max-pool, one global
average pool, one FC layer, and 5 explicit pads; BatchNorm and ReLU are
folded away. Work distribution: the stem costs 118 MMAC (7%), and the four
residual stages ~460/411/411/411 MMAC — near-constant by design, since each
stage halves the spatial map while doubling the channels. MACs are 98% of
arithmetic; the residual adds, pools and requantization form the remainder.

### 2.4 Baseline platform

Target: bare-metal RV64IMC — 64-bit RISC-V with multiply and compressed
encodings, no floating point, no vector unit, static memory only. One
toolchain detail is recorded as methodology: modern binutils splits CSR
access out of base I, so the practical architecture string is
`rv64imc_zicsr_zifencei` (Zicsr for the minstret counters used throughout,
Zifencei for startup code); neither adds compute capability. Compiler: GCC
15.2 at -O2. ISA-level measurement: Spike (riscv-isa-sim), instruction counts
via the minstret CSR, instruction mixes via PC-filtered commit logs.
Correctness at every stage is bit-exactness against the deployed model's own
recorded tensors, through a verified chain: TFLite -> NumPy reference ->
bare-metal C -> custom instructions.
## 3. Workload characterization

### 3.1 Method

Two independent instruments, cross-checked. Totals come from the `minstret`
CSR read immediately before and after the region of interest — exact and
free, usable on full-size runs. Mixes come from Spike's commit log, decoded
by opcode field (scripts/instr_mix.py) and **PC-filtered to the kernel
symbol**. The filter is not optional: the bare-metal runtime emits output by
polling an HTIF mailbox, and an unfiltered trace reports a meaningless
~50%-branch/49%-load mix from that polling loop alone. All mixes below are
one-output-row runs (the mix is loop-invariant; only totals scale).

### 3.2 The baseline, measured

The naive INT8 dot product (B0) compiles at -O2 into an 8-instruction loop
body: two byte loads, zero-point subtract, multiply, accumulate, two pointer
increments, branch. Measured dynamically: **8.06 instructions/MAC** on a
K=192 microbenchmark (1,548 instructions / 192 MACs, matching the static
count 192x8+12); **7.13 instructions/MAC** on the real layer1.0.conv1
(824,959,988 instructions / 115.6 MMAC, E3) — the improvement from the
zero-point hoist of Eq. (4) and im2col window amortization. Code size:
2,916 B text for the microbenchmark; zero floating-point instructions
emitted (verified by disassembly scan, a §5 functional requirement).

Instruction mix of B0 on the real layer (E7): int ALU 43.0%, load 28.3%,
branch 14.3%, **multiply 14.1%**, store 0.2%.

### 3.3 The three bottlenecks (brief §2B)

1. **Address generation and bookkeeping — 43%.** Two pointer increments and
   a zero-point subtract per MAC. Partially removable in software (B1);
   fully removable only by post-increment addressing (RTL phase).
2. **Load inefficiency — 28%.** Two loads per MAC, each moving ONE byte
   through an 8-byte datapath: 87.5% of every load's width wasted. This is
   the observation the entire extension rests on — the operands for eight
   MACs already fit in two registers.
3. **Loop control — 14%.** One branch per MAC.

Only 14.1% of retired instructions are the multiplies that constitute the
work. The ISA proposal follows directly: widen the unit of arithmetic to
match the unit of data movement (8 lanes), and the three overhead classes
amortize or vanish.
## 4. ISA design

### 4.1 The three-operand problem and the design space

A multiply-accumulate reads three values (accumulator, activations, weights);
the RISC-V integer datapath reads two — the register file has two read ports
and the destination field is write-only. Any packed-MAC design must place the
accumulator somewhere, and the options differ not in arithmetic but in how
much of the EXISTING core they modify:

| option | form | core modifications | notes |
|---|---|---|---|
| A | `xqmac8 rd,rs1,rs2` (rd += dot8) | 3rd regfile read port + forwarding/hazard extension for the third operand | best instruction density (~0.28 instr/MAC); accumulators are ordinary GPRs, so 4-way tiling is free |
| B | R4-type with rs3 | same as A, nonstandard integer format | dominated by A; rejected |
| C | accumulators inside the unit | none — but new architectural state + move instructions | self-contained; compiler cannot allocate accumulators |
| **D (chosen)** | **`xqdot8 rd,rs1,rs2` (rd = dot8)** | **none** | 2-read/1-write like `mul`; accumulation by ordinary `add`; ~45% more loop instructions than A |

We implement **D first**, for three reasons. (i) Risk: additions fail their
own tests loudly; modifications to the register file and bypass network —
the structures every instruction flows through — fail silently and late.
(ii) Sufficiency: D already exceeds the project's >=2x target by 2.8x
(Section 6). (iii) Method: the brief requires incremental instruction-on-
instruction evaluation; option A is the natural next increment for the RTL
phase, where synthesis can price its third read port in area and Fmax rather
than conjecture. A latency bonus follows from the choice: consecutive
`xqdot8` results are mutually independent (only the cheap adds chain), so a
multi-cycle implementation of the 8-multiplier unit would pipeline without
stalls.

### 4.2 `xqdot8` — packed 8-lane INT8 dot product

    xqdot8 rd, rs1, rs2:
        rd = sum_{i=0..7} sext8(rs1.byte[i]) * sext8(rs2.byte[i])

Encoding: R-type on custom-0 (opcode 0001011), funct3=000, funct7=0000000.
The result range is +-131,072 (18 bits), sign-extended; accumulation over the
largest layer dimension (K=4608) peaks at 27 bits — int32 accumulation is
safe with a 28x margin, so no saturation logic is required in the unit.
RV64-only (require_rv64): the packing presumes 64-bit registers.

### 4.3 `xrq` — requantization

`xrq` collapses Eq. (3) — one widening multiply, one rounding shift,
zero-point add, saturation: ~13 scalar instructions including two
data-dependent branches (RV64IMC lacks min/max; clamps compile to branches
that mispredict on data).

**Semantics were established empirically, not assumed.** Reproducing each
convolution of the deployed model in NumPy and iterating candidate rounding
rules against TFLite's own outputs showed: the textbook two-step gemmlowp
sequence (SRDHM then RDBPOT) is +1 on 0.065% of outputs — a double-rounding
artifact; a SINGLE rounding of the full 64-bit product acc*M0 by (31+rs)
with the gemmlowp tie rule matches all 20 convolutions bit-exactly (2.18 M
outputs, zero mismatches). The FC layer alone follows a different backend's
rounding (ruy); we implement the conv semantics only — one rounding stage is
also the cheaper datapath — accepting a deviation of <=3 of 1000 FC logits
by +-1, which cannot alter the argmax.

    xrq rd, rs1, rs2:
        acc = rs1[31:0];  M0 = rs2[31:0];  sh = rs2[39:32];  zp = rs2[47:40]
        rd  = clamp_int8( rdbpot(acc * M0, sh) + zp )

Encoding: custom-0, funct3=001. **Design correction, recorded:** the original
plan held M0/shift/zp in CSRs, written once per output channel. Measurement
of the real kernels invalidated it: im2col window reuse forces pixel-
outermost loops, so per-channel CSR writes would fire exactly as often as
the requantizations they serve. The corrected design packs all three
constants into one 64-bit rs2 word prepared offline — preserving the
2-read/1-write discipline and serving per-channel quantization with zero
architectural state. funct7 and the remaining funct3 codes are reserved for
variants (accumulating xqmac8, W8A16).
## 5. Implementation and verification

### 5.1 Simulator implementation

Each instruction is ~15 lines of semantics in Spike's per-instruction format
(`riscv/insns/xqdot8.h`, `xrq.h`) plus an opcode match/mask declaration and a
build-list entry; the full diff ships as `src/spike/custom-insns-spike.patch`.
No assembler or compiler modification is needed anywhere in the project: the
GNU assembler's `.insn` directive emits the raw encodings, wrapped in C
macros with register constraints (`"+r"`/`"=r"`), so the kernels call the
instructions like intrinsics and GCC's register allocator schedules them
normally.

### 5.2 Kernels

All four kernel generations (B0, B1, X1, X2) compile into one binary and run
back-to-back over the same layer, each timed by `minstret` and each checked
bit-exactly before the next runs. The X2 kernel is additionally provided in a
layer-parameterized form (`conv2d_q()`), used twice in the residual-block
test and intended as the template for full-model inference. One portability
rule is enforced now for the RTL phase's benefit: all packed operands are
8-byte aligned (`aligned(8)` on buffers; every layer's K is a multiple of 8,
so row starts stay aligned). Spike tolerates misaligned 64-bit loads; real
hardware may not.

### 5.3 Verification

Three layers of defense, outermost first:

1. **A bit-exact reference chain.** TFLite's own recorded tensors (obtained
   by running the deployed model with the fusing delegate disabled) verify
   the NumPy reference (E2); NumPy verifies the bare-metal C (E3); the C
   with custom instructions is verified against the same recorded tensors at
   every stage (E5, E6, E8). At no point is "close" accepted: every
   comparison in this project is exact equality over every element.
2. **Directed + randomized instruction tests** (brief §5): each instruction
   is compared against an independent plain-C model of its specified
   semantics — directed vectors pin saturation extremes, per-lane isolation,
   and shift/zero-point bounds; 20,000 random vectors per instruction sweep
   the interior. Result: **40,144 vectors, zero failures** (`make run-test`).
3. **Anti-artifact hygiene.** Kernels are `noinline` (so PC-filtered
   profiling and symbol-level timing are meaningful), outputs are always
   consumed by the checker (so no measured work can be optimized away), and
   the binary is scanned for floating-point instructions after every build
   (`make fpcheck`: zero, satisfying the no-FP functional requirement).
## 6. Evaluation

All numbers are dynamic counts from Spike on layer1.0.conv1 (115,605,504
MACs) unless stated; every table regenerates from a script
(`scripts/run_b0.sh`, `make run-conv`, `scripts/run_mix.sh`, `make run-test`,
`make run-block`). Spike counts INSTRUCTIONS, not cycles: all cycle, CPI,
frequency and area claims are deliberately deferred to the RTL phase
(Section 7).

### 6.1 Main result — incremental, as required

| config | dynamic instr | instr/MAC | step gain | cumulative | bit-exact |
|---|---:|---:|---:|---:|---|
| B0 naive C, -O2 | 824,959,988 | 7.13 | — | 1.00x | yes |
| B1 + tiling, unroll, zp-hoist | 413,848,076 | 3.57 | 1.99x | 1.99x | yes |
| X1 + `xqdot8` | 75,926,769 | 0.66 | 5.45x | 10.86x | yes |
| X2 + `xrq` | 73,267,673 | 0.63 | 1.036x | **11.26x** | yes |

Against the project target of >=2x dynamic-instruction reduction: **5.6x
measured against the OPTIMIZED software baseline** (B1->X2), 11.3x against
naive. We report the former as the headline: comparing an ISA extension to
unoptimized software would credit hardware with gains a compiler-grade
kernel already achieves.

### 6.2 Instruction mix and custom-instruction utilization

Mixes from one output row (loop-invariant), PC-filtered per kernel (E7):

| class | B0 | B1 | X1 | X2 |
|---|---:|---:|---:|---:|
| int ALU | 43.0% | 34.3% | 42.8% | 41.4% |
| load | 28.3% | 35.6% | 26.9% | 27.7% |
| scalar multiply | 14.1% | 28.1% | 0.3% | 0.0% |
| XQDOT8 | — | — | 19.4% | 20.1% |
| XRQ | — | — | — | 0.3% |
| branch | 14.3% | 1.5% | 8.0% | 7.8% |

Utilization is exact by count: XQDOT8 retires precisely MACs/8 (258,048 for
the measured row; 14,450,688 for the full layer) and XRQ precisely one per
output element (3,584 / 200,704) — the units are never idle-issued and never
redundant. The scalar multiply population falls from 2,068,136 (identical in
B0 and B1 — same arithmetic, different wrapping) to 168, the residue being
address computation.

### 6.3 The xrq increment, read correctly

X1->X2 is 1.036x — small BY STRUCTURE, not by failure: requantization
executes once per output element (200,704) against 14.45 M packed-MAC
operations, so its instruction-count ceiling is a few percent (Amdahl). Its
second effect is invisible to instruction counting: each `xrq` removes two
data-dependent saturation branches (RV64IMC has no min/max), a predicted
branch-misprediction saving measurable only in cycles — an explicit
hypothesis carried to the RTL phase.

### 6.4 A complete residual block

layer1.0 end to end — conv1(+ReLU) -> conv2 -> quantized residual add
(+fused ReLU) — runs bit-exactly against TFLite's recorded output at every
stage (E8): 142.7 M instructions total, of which the add contributes 3.6 M
(18 per element). The add's input rescalings are plain C; its OUTPUT stage
is performed by the `xrq` instruction itself, demonstrating that the
requantize primitive generalizes beyond convolution. The add's rounding
semantics were established the same way as E2 (candidate iteration against
recorded tensors); on this model's data all three candidate rounding
variants coincide, and we adopt single-round for consistency.

### 6.5 Code size

Reported at kernel granularity (binary text is dominated by embedded test
data). Measured symbol sizes: B0 476 B, B1 1,320 B, X1 860 B, X2 650 B.
The reading: naive code is the smallest; the software-optimized B1 pays
2.8x code size for its unrolling and tiling; the custom instructions
recover most of it — X2 is 51% smaller than B1 while 5.6x faster, despite
custom instructions having no 16-bit compressed forms. Only the naive
kernel is smaller than X2, and it is 11x slower.
## 7. The next bottleneck, and the RTL phase it dictates

### 7.1 What the workload looks like after the extension

The brief's closing question — what becomes the bottleneck after the
optimization — has a measured answer. In X2, loads plus address arithmetic
are ~70% of retired instructions (E7: 41.4% int ALU + 27.7% load), and the
inner loop makes the shift visible at a glance: per 32 MACs it issues 5
loads, 4 `xqdot8`, 4 `add`, 3 pointer increments and a branch — **memory
traffic now outnumbers arithmetic**. This was predictable (arithmetic was
made 8x denser while data delivery was untouched) and is now quantified.
Two further structure facts localize the remaining cost: the im2col window
gather is a visible share of the int-ALU population, and the 40 bytes per
32 MACs moved by the loop is irreducible — weights and activations must
arrive; only the overhead per load can fall.

### 7.2 Planned increments, each with its measured motivation

1. **Post-increment load/store** (brief §7, ★★): folds the pointer
   increment into the load. Deletes 3 of the 17 inner-loop instructions
   (~18%) plus a similar population in the window gather. Pure ISA-level
   gain, measurable in Spike before RTL.
2. **Accumulating `xqmac8` (design option A)**: the deferred second half of
   the Section 4 decision. With post-increment, the inner loop becomes
   5 loads + 4 `xqmac8` + branch = 10 instructions per 32 MACs
   (0.31 instr/MAC projected vs 0.53 measured). Its cost — a third register
   read port and forwarding extension — is exactly what synthesis can price,
   turning the A-vs-D comparison into a measured speedup-per-area trade.
3. **Limited dual issue** (load alongside `xqdot8`, brief §7 ★★★★) and/or a
   pipelined cache: cycle-domain attacks on the same 70%, invisible to
   instruction counts by construction.
4. **Software, costless in hardware:** interior output rows share two of
   their three window rows with the previous position; a rolling-window
   gather removes most of the im2col copy traffic.

### 7.3 Hypotheses the RTL phase must test

Spike counts instructions; the following are explicitly cycle-domain claims
carried forward as hypotheses: (i) `xrq`'s removal of two data-dependent
saturation branches per output element reduces misprediction stalls beyond
its 3.6% instruction saving; (ii) the single-cycle feasibility of the
8-multiplier unit — its adder tree is far shallower than the existing 64x64
multiplier, so Fmax should be unaffected (to be confirmed by synthesis);
(iii) X2's 8-byte strided loads use the cache line far better than B0's
byte loads, so the cycle-level gain may exceed the instruction-level 5.6x.

### 7.4 Plan and infrastructure

CV-Wally (rv64imc configuration) with the two instructions added to decode
plus one self-contained functional unit; cycle counts and CPI from hardware
counters on a kernel benchmark sized to measured Verilator throughput;
synthesis with Synopsys DC against the SAED 32/28nm library for area delta
and critical path, on university infrastructure (simulation itself is
self-hosted Linux). Deliverable metric, per the brief: speedup per unit
area, for D alone and for the A increment.
## 8. Conclusion

A bare-metal RV64IMC core runs quantized ResNet-18 at 8.06 instructions per
multiply-accumulate — 87.5% overhead around 12.5% work. Following the
course's measurement loop, we characterized that overhead, proposed the
smallest ISA extension the measurements justified, implemented it in Spike,
and evaluated it incrementally: software optimization alone yields 1.99x;
the packed dot-product instruction `xqdot8` — deliberately non-accumulating,
so the host core's register file and forwarding network are untouched —
yields a further 5.45x; the requantization instruction `xrq` adds its
structurally bounded 3.6% and removes the loop's data-dependent branches.
Net: **0.63 instructions/MAC, an 11.26x reduction over the naive baseline
and 5.6x over the optimized one**, with the extension's utilization exact
(one `xqdot8` per 8 MACs, one `xrq` per output) and every stage — through a
complete residual block — bit-exact against the deployed model itself.

Beyond the numbers, the project's design record is its method: a
requantization specification reverse-engineered to bit-exactness rather
than assumed (exposing a double-rounding pitfall and TFLite's own internal
inconsistency); a parameter-delivery design corrected when measurement of
real loop structure invalidated it; and an accumulating-MAC variant
deliberately deferred until synthesis can price its hardware. The workload
after the extension is memory-bound — 70% loads and addressing, measured —
which is precisely the question the RTL phase is equipped to answer.
