// =============================================================================
// Directed + randomized verification for the two custom instructions
// (brief §5, Functional: "passes directed and randomized verification tests").
//
// Method: every instruction result is compared against an independent C
// reference computing the SAME specified semantics with ordinary operations.
// Directed vectors pin the corners (saturation extremes, zeros, single-lane
// isolation, shift/zero-point bounds); 20,000 random vectors per instruction
// sweep the interior. Any mismatch prints the operands and fails the run.
// =============================================================================
#include <stdint.h>
#include "util.h"
extern int printf(const char *, ...);
void thread_entry(int cid, int nc) { while (cid != 0); }

#define XQDOT8(d, a, w) \
    __asm__ volatile(".insn r 0x0B, 0, 0, %0, %1, %2" : "=r"(d) : "r"(a), "r"(w))
#define XRQ(d, acc, prm) \
    __asm__ volatile(".insn r 0x0B, 1, 0, %0, %1, %2" : "=r"(d) : "r"(acc), "r"(prm))

// ---- independent references (plain C, no packed tricks) ----
static int64_t dot8_ref(uint64_t a, uint64_t w) {
    int64_t s = 0;
    for (int i = 0; i < 8; i++) {
        int8_t ai = (int8_t)(a >> (8 * i));
        int8_t wi = (int8_t)(w >> (8 * i));
        s += (int64_t)ai * (int64_t)wi;
    }
    return s;
}
static int64_t xrq_ref(int32_t acc, uint64_t prm) {
    int64_t m0    = (int64_t)(uint32_t)(prm & 0xFFFFFFFFu);
    int     shift = (int)((prm >> 32) & 0xFF);
    int64_t zp    = (int64_t)(int8_t)((prm >> 40) & 0xFF);
    int64_t p     = (int64_t)acc * m0;
    int64_t mask  = (((int64_t)1) << shift) - 1;
    int64_t rem   = p & mask;
    int64_t thr   = (mask >> 1) + (p < 0 ? 1 : 0);
    int64_t q     = (p >> shift) + (rem > thr ? 1 : 0) + zp;
    if (q > 127) q = 127;
    if (q < -128) q = -128;
    return q;
}

// xorshift64: deterministic pseudo-random vectors, no libc needed
static uint64_t rng = 0x243F6A8885A308D3ull;    // seed: pi digits
static uint64_t rnd(void) {
    rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17; return rng;
}
static uint64_t pack(uint32_t m0, uint8_t sh, int8_t zp) {
    return (uint64_t)m0 | ((uint64_t)sh << 32) | (((uint64_t)(uint8_t)zp) << 40);
}

static long fails = 0;
static void chk_dot(uint64_t a, uint64_t w) {
    int64_t got; XQDOT8(got, a, w);
    int64_t ref = dot8_ref(a, w);
    if (got != ref) {
        printf("FAIL xqdot8 a=%lx w=%lx got=%ld ref=%ld\n",
               (unsigned long)a, (unsigned long)w, (long)got, (long)ref);
        fails++;
    }
}
static void chk_rq(int32_t acc, uint64_t prm) {
    int64_t got; XRQ(got, (int64_t)acc, prm);
    int64_t ref = xrq_ref(acc, prm);
    if (got != ref) {
        printf("FAIL xrq acc=%ld prm=%lx got=%ld ref=%ld\n",
               (long)acc, (unsigned long)prm, (long)got, (long)ref);
        fails++;
    }
}

int main(int argc, char **argv) {
    long n = 0;

    // ---- xqdot8 directed: saturation corners, zeros, lane isolation ----
    const uint64_t P7F = 0x7F7F7F7F7F7F7F7Full;   // all +127
    const uint64_t N80 = 0x8080808080808080ull;   // all -128
    const uint64_t ONE = 0x0101010101010101ull;
    uint64_t dvec[][2] = {
        {0, 0}, {P7F, P7F}, {N80, N80}, {P7F, N80}, {N80, P7F},
        {ONE, P7F}, {P7F, ONE}, {0x80ull, 0x80ull},      // single lane, max product
        {0xFFull, ONE},                                   // -1 * 1 in lane 0
        {0x0102030405060708ull, 0xF1F2F3F4F5F6F7F8ull},
    };
    for (unsigned i = 0; i < sizeof(dvec)/sizeof(dvec[0]); i++, n++)
        chk_dot(dvec[i][0], dvec[i][1]);
    for (int lane = 0; lane < 8; lane++, n++)             // isolate each lane
        chk_dot((uint64_t)0x80 << (8*lane), (uint64_t)0x80 << (8*lane));

    // ---- xqdot8 randomized ----
    for (int i = 0; i < 20000; i++, n++) chk_dot(rnd(), rnd());

    // ---- xrq directed: value corners x multiplier corners x shift/zp bounds ----
    const int32_t  accs[]  = {0, 1, -1, 2147483647, (int32_t)-2147483648, 131072, -131072};
    const uint32_t m0s[]   = {0x40000000u, 0x7FFFFFFFu};   // Q31 min/max
    const uint8_t  shs[]   = {31, 38, 45};
    const int8_t   zps[]   = {-128, 0, 127};
    for (unsigned a = 0; a < 7; a++)
      for (unsigned m = 0; m < 2; m++)
        for (unsigned s = 0; s < 3; s++)
          for (unsigned z = 0; z < 3; z++, n++)
            chk_rq(accs[a], pack(m0s[m], shs[s], zps[z]));

    // ---- xrq randomized (random acc, legal-range m0/shift, any zp) ----
    for (int i = 0; i < 20000; i++, n++) {
        int32_t  acc = (int32_t)rnd();
        uint32_t m0  = 0x40000000u | ((uint32_t)rnd() & 0x3FFFFFFFu);
        uint8_t  sh  = 31 + (uint8_t)(rnd() % 15);
        int8_t   zp  = (int8_t)rnd();
        chk_rq(acc, pack(m0, sh, zp));
    }

    printf("isa_test: %ld vectors, %ld failures — %s\n",
           n, fails, fails ? "FAIL" : "ALL PASS");
    return fails ? 1 : 0;
}
