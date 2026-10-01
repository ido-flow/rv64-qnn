# =============================================================================
# Bare-metal RV64IMC build.
#
# TOOLCHAIN: xPack GCC, prefix `riscv-none-elf-` — NOT the
# `riscv64-unknown-elf-` most tutorials assume. Same compiler, different name.
# Override if needed:   make RISCV_PREFIX=riscv64-unknown-elf-
#
# ARCH is rv64imc_zicsr_zifencei, NOT plain rv64imc:
#   Zicsr    - CSR access (csrr minstret). Split out of base I in spec 20191213;
#              modern binutils refuses `csrr` without it.
#   Zifencei - fence.i, used by crt.S.
# Neither adds compute capability - the core stays integer-only (no F/D/V).
#
# ABI lp64 = soft-float. (lp64d would require FP registers we do not have,
# and is what the riscv-tests Makefile defaults to - a trap, see DESIGN.md §2.)
# =============================================================================
RISCV_PREFIX ?= riscv-none-elf-
CC      := $(RISCV_PREFIX)gcc
OBJDUMP := $(RISCV_PREFIX)objdump
SIZE    := $(RISCV_PREFIX)size

BM   := src/baremetal
ARCH := rv64imc_zicsr_zifencei
ABI  := lp64

# Flag-by-flag:
#   -mcmodel=medany       code is linked at 0x8000_0000 (see test.ld); medany
#                         generates PC-relative addressing so that works. The
#                         default (medlow) can only address near 0.
#   -std=gnu99            the riscv-tests sources use GNU C extensions
#   -O2                   the baseline must be COMPILED code, not an -O0 straw man
#   -fno-common           one definition per global (modern default, explicit)
#   -fno-builtin-printf   stops GCC swapping printf("x\n") for puts() - our
#                         mini-libc (syscalls.c) only provides printf
#   -fno-tree-loop-distribute-patterns
#                         stops GCC rewriting loops into memcpy/memset calls
#                         (they exist in syscalls.c, but as bytewise loops we
#                         do not want silently injected into measured code)
#   -static -nostdlib -nostartfiles
#                         no libc, no OS startup - we bring crt.S + test.ld
#   -lgcc                 compiler runtime helpers (64-bit shifts, division)
CFLAGS := -march=$(ARCH) -mabi=$(ABI) -mcmodel=medany -std=gnu99 -O2 \
          -fno-common -fno-builtin-printf -fno-tree-loop-distribute-patterns \
          -static -I$(BM)
LDFLAGS := -static -nostdlib -nostartfiles -lgcc -T $(BM)/test.ld

SRCS := $(BM)/crt.S $(BM)/syscalls.c $(BM)/main.c

all: app.elf

app.elf: $(SRCS) $(BM)/test.ld
	$(CC) $(CFLAGS) $(SRCS) -o $@ $(LDFLAGS)
	@$(SIZE) $@

# Disassemble - how we count the loop body by hand (EXPERIMENTS.md E1).
dump: app.elf
	$(OBJDUMP) -d $< > app.dump
	@echo "wrote app.dump"

# Run on Spike. --isa must match ARCH or CSR instructions trap.
run: app.elf
	spike --isa=$(ARCH) app.elf

# The brief requires "no unintended floating-point instruction". 0 = clean.
fpcheck: app.elf
	@echo "floating-point instructions found:"
	@$(OBJDUMP) -d app.elf | grep -cE '\s(f[a-z]+\.[sd]|flw|fld|fsw|fsd)\s' || echo 0

clean:
	rm -f app.elf app.dump

.PHONY: all dump run fpcheck clean
