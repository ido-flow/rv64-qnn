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

## Status / key numbers so far

| what | value |
|---|---|
| B0 baseline (dot product, K=192) | **8.06 instr/MAC**, mix: 50% ALU / 25% load / 12.5% branch / 12.5% mul |
| Requantize spec | settled bit-exactly (2.18 M conv outputs, 0 mismatches) — EXPERIMENTS.md E2 |
| Machines | this Mac = toolchain/Spike/ISA work · Linux x86-64 box (pending) = Wally RTL + Synopsys DC |
