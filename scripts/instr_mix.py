#!/usr/bin/env python3
"""Instruction-mix profiler for RV64IMC (brief §2B, required metric #2).

Reads a `spike --log-commits` trace on stdin and classifies every retired
instruction. Spike's log gives NO mnemonics — just the raw instruction word:

    core   0: 3 0x0000000080002718 (0x00078803) x16 0x...
                 ^ pc                ^ instruction word (hex)

so we decode the opcode field ourselves. That is more robust than parsing
disassembly anyway, and it means a future custom instruction is classified
correctly for free: custom-0 (0x0B) and custom-1 (0x2B) are already rows.

USAGE
    spike --isa=rv64imc_zicsr_zifencei --log-commits app.elf 2>&1 \
      | grep '^core' | python3 scripts/instr_mix.py [--range LO HI]

    --range LO HI   count only instructions whose PC lies in [LO, HI), hex.
                    Get a function's range from:  riscv-none-elf-nm -S app.elf
                    ALWAYS use this: without it the HTIF output poll loop in
                    syscalls.c (load+branch forever) swamps the statistics.

HOW THE DECODE WORKS
    RISC-V instruction length: if the low 2 bits are 0b11 the instruction is
    32-bit; anything else is a 16-bit compressed (RVC) encoding. Spike prints
    32-bit words as 8 hex digits and compressed ones as 4, so the number of
    hex digits tells us which decoder to use.

    32-bit: the major opcode is bits [6:0] — one table lookup. The only
    subtlety is that integer mul/div shares opcodes 0x33/0x3B with add/sub
    etc., distinguished by funct7 == 0b0000001 (the M extension).

    16-bit RVC: class = quadrant (bits [1:0]) + funct3 (bits [15:13]).
"""
import re, sys, collections

# --- 32-bit major opcodes (bits [6:0]) ---
OP32 = {
    0x03: 'load',     0x23: 'store',
    0x13: 'int ALU',  0x1B: 'int ALU',   # OP-IMM, OP-IMM-32
    0x37: 'int ALU',  0x17: 'int ALU',   # LUI, AUIPC
    0x63: 'branch',   0x6F: 'branch', 0x67: 'branch',   # Bxx, JAL, JALR
    0x73: 'csr/sys',  0x0F: 'fence',
    0x0B: 'CUSTOM-0 (xqmac8)', 0x2B: 'CUSTOM-1 (xrq)',  # reserved for us
}
# --- RVC: quadrant -> funct3 -> class ---
C0 = {0: 'int ALU', 2: 'load', 3: 'load', 6: 'store', 7: 'store'}
C1 = {0: 'int ALU', 1: 'int ALU', 2: 'int ALU', 3: 'int ALU',
      4: 'int ALU', 5: 'branch', 6: 'branch', 7: 'branch'}
C2 = {0: 'int ALU', 2: 'load', 3: 'load', 4: 'int ALU',  # f3=4: c.jr/c.mv/c.add
      6: 'store', 7: 'store'}

def classify(w, nbits):
    if nbits == 16:
        q, f3 = w & 3, (w >> 13) & 7
        if q == 0: return C0.get(f3, 'int ALU')
        if q == 1: return C1.get(f3, 'int ALU')
        return C2.get(f3, 'int ALU')
    op = w & 0x7F
    if op in (0x33, 0x3B):                       # OP / OP-32: is it M-ext?
        return 'multiply' if ((w >> 25) & 0x7F) == 1 else 'int ALU'
    if op == 0x0B:                               # custom-0: ours, split by funct3
        return 'XQDOT8' if ((w >> 12) & 7) == 0 else 'XRQ'
    return OP32.get(op, f'unknown(0x{op:02x})')

# Optional PC window (see USAGE above — without it, HTIF polling dominates).
lo, hi = 0, 1 << 64
if '--range' in sys.argv:
    i = sys.argv.index('--range')
    lo, hi = int(sys.argv[i + 1], 16), int(sys.argv[i + 2], 16)

# Capture the 16-hex-digit PC and the variable-width instruction word.
pat = re.compile(r'0x([0-9a-fA-F]{16})\s+\(0x([0-9a-fA-F]+)\)')
counts = collections.Counter()
for line in sys.stdin:
    m = pat.search(line)
    if not m:
        continue
    pc = int(m.group(1), 16)
    if not (lo <= pc < hi):
        continue
    hx = m.group(2)
    counts[classify(int(hx, 16), 16 if len(hx) <= 4 else 32)] += 1

tot = sum(counts.values()) or 1
print(f"{'class':<22}{'count':>10}{'share':>9}")
print('-' * 41)
for k, v in counts.most_common():
    print(f"{k:<22}{v:>10}{v/tot*100:>8.1f}%")
print('-' * 41)
print(f"{'TOTAL':<22}{tot:>10}")
