#!/usr/bin/env bash
# =============================================================================
# Regenerates every B0 number in EXPERIMENTS.md E1. Run from the repo root.
# Raw output -> results/b0.txt (results/ is never hand-edited: the report's
# tables are only ever regenerated from scripts like this one).
# =============================================================================
set -e
export PATH="$HOME/riscv/bin:$HOME/Library/xPacks/@xpack-dev-tools/riscv-none-elf-gcc/15.2.0-1.1/.content/bin:$PATH"
ISA=rv64imc_zicsr_zifencei
mkdir -p results
make -s clean && make -s

# 1) Correctness: bare-metal result must equal the numpy host reference.
echo "== correctness ==" | tee results/b0.txt
REF=$(python3 scripts/ref_dot.py)
GOT=$(spike --isa=$ISA app.elf | sed -n 's/^dot(K=192) = //p')
echo "reference=$REF  spike=$GOT  $([ "$REF" = "$GOT" ] && echo MATCH || echo MISMATCH)" | tee -a results/b0.txt

# 2) Dynamic instruction count via the minstret CSR (cheap, exact).
echo "== dynamic instruction count (minstret) ==" | tee -a results/b0.txt
spike --isa=$ISA app.elf | tee -a results/b0.txt

# 3) Instruction mix from the commit log, PC-filtered to dot_b0 ONLY.
#    (Whole-program mixes are garbage here: the HTIF output poll loop
#    dominates. See the methodology note in EXPERIMENTS.md E1.)
echo "== instruction mix, dot_b0 only ==" | tee -a results/b0.txt
read ADDR SIZE <<<"$(riscv-none-elf-nm -S --defined-only app.elf | awk '$4=="dot_b0"{print $1,$2}')"
HI=$(python3 -c "print('%016x' % (0x$ADDR + 0x$SIZE))")
spike --isa=$ISA --log-commits app.elf 2>&1 | grep '^core' \
  | python3 scripts/instr_mix.py --range "$ADDR" "$HI" | tee -a results/b0.txt

# 4) Code size (required metric #6 in the brief).
echo "== code size ==" | tee -a results/b0.txt
riscv-none-elf-size app.elf | tee -a results/b0.txt
