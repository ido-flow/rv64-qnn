# The bare-metal runtime — what each file is and where it came from

Only `main.c` is ours. The other four files are copied **unmodified** from
[riscv-tests](https://github.com/riscv-software-src/riscv-tests)
(`benchmarks/common/` and `env/`). Keeping them unmodified means we can diff
against upstream at any time. Do not edit them; put project code in `main.c`
or new files.

## The boot story (what happens before `main`)

There is no OS. Spike (and later CV-Wally's testbench) loads `app.elf` into
simulated RAM at `0x8000_0000` and jumps to `_start`. From there:

1. **`crt.S`** — the very first instructions. Sets up a stack pointer, zeroes
   the `.bss` section (so C globals start at 0), installs a trap handler, and
   calls `_init()`. Also parks extra cores.
2. **`syscalls.c`** — a ~600-line mini-libc: `printf`, `memcpy`, `memset`,
   `exit`, plus `_init()`, which calls our `thread_entry()` and then `main()`.
   I/O works over **HTIF** (host-target interface): writing a command to the
   magic `tohost` symbol makes the *simulator* perform the I/O, then the code
   spins polling `fromhost` for the acknowledgment.
   ⚠ That polling loop is why whole-program instruction traces are useless —
   always PC-filter to the kernel (see `scripts/instr_mix.py --range`).
3. **`test.ld`** — the linker script. Places code/data at `0x8000_0000`
   (`ENTRY(_start)`), which is where RISC-V simulators put RAM by convention.
4. **`util.h`** — small helpers used by riscv-tests benchmarks.
5. **`encoding.h`** — CSR addresses and bit-field constants for the whole
   privileged spec (from `riscv-tests/env`).

## Rules of this world

- No `malloc`, no heap: every buffer is a static array.
- No `<stdio.h>`/libc headers: declare what you use (`extern int printf(...)`).
- No floating point: `make fpcheck` must always print 0.
- Exit happens via `exit()` → HTIF; Spike's process exit code is `main`'s
  return value (0 = success).
