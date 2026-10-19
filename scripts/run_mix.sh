#!/usr/bin/env bash
# Instruction mix + custom-instruction utilization for all four kernels
# (brief §2B metric #2 and metric #7). One spike run with the commit log,
# then PC-filtered analysis per kernel symbol. Uses the RUN_HO=1 build.
set -e
export PATH="$HOME/riscv/bin:$HOME/Library/xPacks/@xpack-dev-tools/riscv-none-elf-gcc/15.2.0-1.1/.content/bin:$PATH"
ISA=rv64imc_zicsr_zifencei
make -s mix.elf
LOG=$(mktemp /tmp/mix_log.XXXX)
trap "rm -f $LOG" EXIT
spike --isa=$ISA --log-commits mix.elf > /dev/null 2> "$LOG"
mkdir -p results
: > results/mix.txt
for FN in conv2d_b0 conv2d_b1 conv2d_x1d conv2d_x2; do
  read ADDR SIZE <<<"$(riscv-none-elf-nm -S --defined-only mix.elf | awk -v f=$FN '$4==f{print $1,$2}')"
  HI=$(python3 -c "print('%016x' % (0x$ADDR + 0x$SIZE))")
  echo "== $FN ==" | tee -a results/mix.txt
  grep '^core' "$LOG" | python3 scripts/instr_mix.py --range "$ADDR" "$HI" | tee -a results/mix.txt
  echo | tee -a results/mix.txt
done
