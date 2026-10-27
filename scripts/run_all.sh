#!/usr/bin/env bash
# =============================================================================
# Reproduces EVERY reported measurement (deliverable: reproducible benchmark
# scripts). Expected outputs are tabulated in the README. Prerequisites:
#   - xPack riscv-none-elf-gcc and Spike built with the custom-instruction
#     patch applied (src/spike/custom-insns-spike.patch) — see README
#   - python venv:  python3 -m venv .venv && . .venv/bin/activate
#                   pip install numpy ai-edge-litert pillow
# Usage:  ./scripts/run_all.sh [--with-mix]     (mix profiling adds ~2 min)
# =============================================================================
set -e
cd "$(dirname "$0")/.."
source .venv/bin/activate

echo "==[1/5] golden references regenerated from the .tflite =="
python3 scripts/export_layer.py
python3 scripts/export_block.py
python3 scripts/ref_conv.py | tail -2
python3 scripts/ref_sweep.py | tail -3

echo; echo "==[2/5] B0 microbenchmark (E1) =="
./scripts/run_b0.sh | grep -E "MATCH|instr/MAC"

echo; echo "==[3/5] instruction verification suite (E6) =="
make -s run-test

echo; echo "==[4/5] kernel evaluation B0/B1/X1/X2 (E3-E6) =="
make -s conv.elf >/dev/null && make -s run-conv

echo; echo "==[5/5] complete residual block (E8) =="
make -s block.elf >/dev/null && make -s run-block

if [ "$1" = "--with-mix" ]; then
  echo; echo "==[extra] instruction mix + custom-insn utilization (E7) =="
  ./scripts/run_mix.sh
fi
echo; echo "ALL MEASUREMENTS REPRODUCED — compare against README tables"
