# Quantized NN acceleration on RV64IMC

Term project: run INT8 ResNet-18 inference on a bare-metal RV64IMC RISC-V
core, profile it, design packed-MAC (`xqmac8`) + requantize (`xrq`) custom
instructions, implement them in Spike and then in CV-Wally RTL, and measure
speedup vs. silicon cost.

**Read these in order:** [DESIGN.md](DESIGN.md) — every decision and its
rationale (model choice, ISA string, instruction semantics, open items).
[EXPERIMENTS.md](EXPERIMENTS.md) — every measurement, each regenerable by a
script. [AI_USAGE.md](AI_USAGE.md) — required disclosure log.

## Quick start (Mac side)

```
./scripts/run_b0.sh          # build + run + profile the B0 baseline on Spike
python3 scripts/ref_conv.py  # bit-exact numpy reference for one ResNet conv
python3 scripts/ref_sweep.py # verify requantize spec on ALL 21 GEMM-class ops
```

(Python scripts need `source .venv/bin/activate`; the venv has numpy,
ai-edge-litert, pillow.)

## Layout

```
Makefile              bare-metal RV64IMC build (flags explained inside)
src/baremetal/        crt.S, linker script, mini-libc (see its README) + main.c
src/model/            resnet18_int8_channelwise.tflite (W8A8) + test data
src/kernels/          (soon) conv/GEMM/requantize kernels: B0 -> B1 -> X1
src/spike/            (soon) xqmac8 + xrq implementation for Spike
src/rtl/              (later, Linux box) CV-Wally patches
scripts/              measurement + golden-reference tools
results/              raw measurement output; never hand-edited
experiments/          benchmark configurations per level (micro/operator/model)
```

## Expected measurements (what a correct run prints)

One command reproduces everything: `./scripts/run_all.sh` (add `--with-mix`
for the instruction-mix profile). Expected results, as retired-instruction
counts from Spike's `minstret`:

| command | expected output |
|---|---|
| `./scripts/run_b0.sh` | reference=96128 spike=96128 MATCH; 1,548 instr / 192 MACs (8.06/MAC) |
| `make run-test` | isa_test: 40,144 vectors, 0 failures — ALL PASS |
| `make run-conv` | B0 824,959,988 · B1 413,848,076 · X1 75,926,769 · X2 73,267,673 instr; mismatches = 0 on all four; ratios B0/B1=1.99x, B1/X1=5.45x, X1/X2=1.036x, B0/X2=11.26x |
| `make run-block` | conv1 69,554,877 · conv2 69,554,877 · add 3,612,690 instr; 0 mismatches each; BLOCK COMPLETE |
| `./scripts/run_mix.sh` | per-kernel mix (results/mix.txt); X2: XQDOT8 = 258,048 (= MACs/8 exactly), XRQ = 3,584 (= 1/output) |
| `python3 scripts/ref_sweep.py` | conv mismatches: 0 · FC deviation: 3 (expected, documented) — SPEC HOLDS |

Spike setup: apply `src/spike/custom-insns-spike.patch` to riscv-isa-sim
(commit 1960943), rebuild, install. Toolchain: xPack riscv-none-elf-gcc,
`-march=rv64imc_zicsr_zifencei -mabi=lp64`.

## Status / key numbers so far

| what | value |
|---|---|
| B0 baseline (dot product, K=192) | **8.06 instr/MAC**, mix: 50% ALU / 25% load / 12.5% branch / 12.5% mul |
| Requantize spec | settled bit-exactly (2.18 M conv outputs, 0 mismatches) — EXPERIMENTS.md E2 |
| Machines | this Mac = toolchain/Spike/ISA work · Linux x86-64 box (pending) = Wally RTL + Synopsys DC |
