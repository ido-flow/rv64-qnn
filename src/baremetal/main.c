// =============================================================================
// B0 baseline — quantized INT8 dot product on bare-metal RV64IMC.
//
// This program is the proof that the whole stack works: cross-compiler ->
// bare-metal runtime -> Spike. It also produces the project's first real
// measurement: the baseline cost of the ONE operation neural networks are
// made of (the multiply-accumulate), on the unmodified ISA.
//
// K = 192 matches a real inner dimension (ResNet-18's im2col K values are
// 147 / 576 / 1152 / 2304 / 4608 — see DESIGN.md §1).
//
//   build:    make            run:      make run
//   profile:  ./scripts/run_b0.sh   (count + instruction mix -> results/)
// =============================================================================
#include <stdint.h>
#include "util.h"

// printf lives in syscalls.c (copied from riscv-tests), which implements it
// on top of HTIF. There is no <stdio.h> in this world, so declare it by hand.
extern int printf(const char *, ...);

// crt.S starts EVERY hart (hardware thread) and _init() in syscalls.c calls
// thread_entry() on each. We are single-threaded: core 0 returns and goes on
// to main(); any other core parks in this loop forever.
void thread_entry(int cid, int nc) { while (cid != 0); }

// Read the M-mode "instructions retired" counter (CSR minstret, 0xB02).
// We run in machine mode, so no permission setup is needed. On Spike this is
// THE measurement primitive: exact, free, and it works on full-size runs —
// unlike the commit log, which costs ~100 bytes of I/O per instruction.
static inline uint64_t rd_instret(void) {
    uint64_t x;
    __asm__ volatile("csrr %0, minstret" : "=r"(x));
    return x;
}

#define K 192

// Static allocation only: there is no malloc here (no heap is set up, and the
// project brief requires static memory anyway). .bss is zeroed by crt.S.
static int8_t A[K], W[K];

// The B0 kernel — textbook quantized dot product, written naively ON PURPOSE:
// this is the honest starting point that B1 (software opt) and X1 (xqmac8)
// will be measured against.
//
//   a  = int8 activations        w  = int8 weights
//   za = activation zero point (TFLite affine quantization: real = S*(q - Z);
//        weights are symmetric, so they have no zero point to subtract)
//
// Overflow: |(a-za)*w| <= 255*128 < 2^15, so an int32 accumulator is safe up
// to K ~ 2^16 — far beyond any K in our model (max 4608). See DESIGN.md §4.1.
//
// noinline keeps this a separate ELF symbol so scripts/instr_mix.py can
// PC-filter the trace to exactly this function. Without that, the HTIF output
// poll loop dominates the mix (EXPERIMENTS.md E1, "trace the region").
__attribute__((noinline))
int32_t dot_b0(const int8_t *a, const int8_t *w, int n, int32_t za) {
    int32_t acc = 0;
    for (int k = 0; k < n; k++)
        acc += (int32_t)(a[k] - za) * (int32_t)w[k];
    return acc;
}

int main(int argc, char **argv) {
    // Deterministic test pattern. The (int8_t) cast wraps modulo 256;
    // scripts/ref_dot.py reproduces the identical values on the host, so both
    // sides must print the same dot product (96128). That comparison is the
    // correctness check in run_b0.sh.
    for (int i = 0; i < K; i++) {
        A[i] = (int8_t)(i * 7 + 3);
        W[i] = (int8_t)(i * 13 - 5);
    }
    const int32_t za = 11;

    // Bracket ONLY the kernel with minstret, so printf's cost is excluded.
    uint64_t t0 = rd_instret();
    int32_t r = dot_b0(A, W, K, za);
    uint64_t t1 = rd_instret();
    uint64_t n = t1 - t0;

    printf("hello from bare-metal RV64IMC\n");
    printf("dot(K=%d) = %ld\n", K, (long)r);
    printf("instructions = %lu   MACs = %d\n", (unsigned long)n, K);
    // There is no floating point on this machine, so print two fake decimals
    // by scaling by 100:  806 means 8.06 instructions per MAC.
    printf("instr/MAC x100 = %lu\n", (unsigned long)(n * 100 / K));
    return 0;   // exit() in syscalls.c reports this code to Spike over HTIF
}
