# Spike implementation of xqdot8

`xqdot8.h` is the complete instruction semantics (goes in `riscv/insns/`).
`xqdot8-spike.patch` is the full diff against riscv-isa-sim (commit 1960943):
encoding.h MATCH/MASK + DECLARE_INSN, the semantics file, and the riscv.mk.in
build-list entry. Apply with `git apply`, rebuild, `make install`.
Encoding: custom-0 (0x0B), funct3=000, funct7=0000000, R-type.
