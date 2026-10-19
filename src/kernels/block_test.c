// =============================================================================
// ONE COMPLETE RESIDUAL BLOCK on bare-metal RV64IMC — brief §5 coverage
// ("complete model inference or one complete CNN block").
//
//   BK_IN ──> conv1(+relu) ──> conv2 ──> [+] ──> relu ──> out
//      └────────────── skip ─────────────┘
//
// Every stage is checked bit-exact against TFLite's own recorded output
// (BK_EXP1/BK_EXP2/BK_EXPB), so a failure names its kernel. The conv here is
// conv2d_q(): the X2 kernel generalized to take its layer as parameters —
// the shape every later layer (and eventually full-model inference) will use.
// =============================================================================
#include <stdint.h>
#include "util.h"
#include "block_data.h"

extern int printf(const char *, ...);
extern void *memcpy(void *, const void *, unsigned long);
void thread_entry(int cid, int nc) { while (cid != 0); }

static inline uint64_t rd_instret(void) {
    uint64_t x; __asm__ volatile("csrr %0, minstret" : "=r"(x)); return x;
}
#define XQDOT8(d, a, w) \
    __asm__ volatile(".insn r 0x0B, 0, 0, %0, %1, %2" : "=r"(d) : "r"(a), "r"(w))
#define XRQ(d, acc, prm) \
    __asm__ volatile(".insn r 0x0B, 1, 0, %0, %1, %2" : "=r"(d) : "r"(acc), "r"(prm))

#define WIN_CAP 4608                       // largest K in ResNet-18
static int8_t __attribute__((aligned(8))) win[WIN_CAP];

// X2 kernel, parameterized. Requires K % 8 == 0 and Cout % 4 == 0 (true for
// every ResNet-18 layer except the K=147 stem, handled by padding — DESIGN.md).
__attribute__((noinline))
static void conv2d_q(const int8_t *in, int H, int W, int Cin,
                     const int8_t *wts, int Cout, int KH, int KW,
                     int stride, int pt, int pl, int za,
                     const int32_t *bias, const int32_t *wsum,
                     const uint64_t *rq, int8_t *out, int Ho, int Wo) {
    const int K = KH * KW * Cin;
    for (int oy = 0; oy < Ho; oy++) {
        for (int ox = 0; ox < Wo; ox++) {
            int p = 0;
            for (int ky = 0; ky < KH; ky++) {
                int iy = oy * stride - pt + ky;
                for (int kx = 0; kx < KW; kx++) {
                    int ix = ox * stride - pl + kx;
                    if (iy < 0 || iy >= H || ix < 0 || ix >= W) {
                        for (int c = 0; c < Cin; c++) win[p++] = (int8_t)za;
                    } else {
                        const int8_t *src = &in[(iy * W + ix) * Cin];
                        for (int c = 0; c < Cin; c++) win[p++] = src[c];
                    }
                }
            }
            for (int oc = 0; oc < Cout; oc += 4) {
                const int8_t *w0 = &wts[(oc + 0) * K];
                const int8_t *w1 = &wts[(oc + 1) * K];
                const int8_t *w2 = &wts[(oc + 2) * K];
                const int8_t *w3 = &wts[(oc + 3) * K];
                int32_t a0 = bias[oc + 0] - za * wsum[oc + 0];
                int32_t a1 = bias[oc + 1] - za * wsum[oc + 1];
                int32_t a2 = bias[oc + 2] - za * wsum[oc + 2];
                int32_t a3 = bias[oc + 3] - za * wsum[oc + 3];
                for (int k = 0; k < K; k += 8) {
                    uint64_t x, y0, y1, y2, y3;
                    memcpy(&x,  &win[k], 8);
                    memcpy(&y0, &w0[k],  8);
                    memcpy(&y1, &w1[k],  8);
                    memcpy(&y2, &w2[k],  8);
                    memcpy(&y3, &w3[k],  8);
                    int64_t d0, d1, d2, d3;
                    XQDOT8(d0, x, y0);  a0 += (int32_t)d0;
                    XQDOT8(d1, x, y1);  a1 += (int32_t)d1;
                    XQDOT8(d2, x, y2);  a2 += (int32_t)d2;
                    XQDOT8(d3, x, y3);  a3 += (int32_t)d3;
                }
                int8_t *o = &out[(oy * Wo + ox) * Cout + oc];
                int64_t r0, r1, r2, r3;
                XRQ(r0, a0, rq[oc + 0]);  o[0] = (int8_t)r0;
                XRQ(r1, a1, rq[oc + 1]);  o[1] = (int8_t)r1;
                XRQ(r2, a2, rq[oc + 2]);  o[2] = (int8_t)r2;
                XRQ(r3, a3, rq[oc + 3]);  o[3] = (int8_t)r3;
            }
        }
    }
}

// Rounding right shift, gemmlowp tie rule — same primitive as inside xrq.
static inline int64_t rdbpot64(int64_t x, int sh) {
    int64_t mask = (((int64_t)1) << sh) - 1;
    int64_t rem  = x & mask;
    int64_t thr  = (mask >> 1) + (x < 0 ? 1 : 0);
    return (x >> sh) + (rem > thr ? 1 : 0);
}

// Quantized residual add (semantics confirmed bit-exact in scripts/ref_add.py):
// pre-shift both operands by 2^20, rescale each to a common scale (Q31,
// single-round), add, then one OUTPUT rescale + zero point + clamp — which is
// exactly the xrq instruction, reused here on a non-conv operator.
__attribute__((noinline))
static void qadd(const int8_t *mn, const int8_t *sk, int8_t *out, long n) {
    for (long i = 0; i < n; i++) {
        int64_t sm = ((int64_t)(mn[i] - BK_ADD_ZM)) << BK_ADD_LS;
        int64_t ss = ((int64_t)(sk[i] - BK_ADD_ZS)) << BK_ADD_LS;
        int32_t raw = (int32_t)(rdbpot64(sm * BK_ADD_MM, BK_ADD_SHM)
                              + rdbpot64(ss * BK_ADD_MS, BK_ADD_SHS));
        int64_t r;
        XRQ(r, raw, BK_ADD_RQO);
        out[i] = (int8_t)r;
    }
}

#define N_OUT (BK_H * BK_W * BK_C)
static int8_t mid1[N_OUT], mid2[N_OUT], outb[N_OUT];

static long check(const char *name, const int8_t *got, const int8_t *exp,
                  uint64_t instr) {
    long bad = 0;
    for (long i = 0; i < N_OUT; i++) if (got[i] != exp[i]) bad++;
    printf("%s  instr = %lu   mismatches = %ld\n",
           name, (unsigned long)instr, bad);
    return bad;
}

int main(int argc, char **argv) {
    printf("layer1.0 residual block, %d outputs/stage, bit-exact required\n", N_OUT);
    uint64_t t0, t1; long bad = 0;

    t0 = rd_instret();
    conv2d_q(BK_IN, BK_H, BK_W, BK_C, BK_W1, BK_C, 3, 3, 1, 1, 1,
             BK_ZA1, BK_B1, BK_WS1, BK_RQ1, mid1, BK_H, BK_W);
    t1 = rd_instret();
    bad += check("conv1 (x2 kernel) ", mid1, BK_EXP1, t1 - t0);

    t0 = rd_instret();
    conv2d_q(mid1, BK_H, BK_W, BK_C, BK_W2, BK_C, 3, 3, 1, 1, 1,
             BK_ZA2, BK_B2, BK_WS2, BK_RQ2, mid2, BK_H, BK_W);
    t1 = rd_instret();
    bad += check("conv2 (x2 kernel) ", mid2, BK_EXP2, t1 - t0);

    t0 = rd_instret();
    qadd(mid2, BK_IN, outb, N_OUT);
    t1 = rd_instret();
    bad += check("residual add+relu ", outb, BK_EXPB, t1 - t0);

    printf("BLOCK: %s\n", bad ? "FAIL" : "COMPLETE — bit-exact end to end");
    return bad ? 1 : 0;
}
