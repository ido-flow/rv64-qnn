// xrq rd, rs1, rs2 : requantize an int32 accumulator to int8.
//   rs1[31:0] = accumulator;  rs2 = packed constants:
//     [31:0] M0 (Q31, positive) | [39:32] total shift (=31+rs) | [47:40] zp (int8)
//   rd = clamp( RoundingDivideByPOT(acc * M0, shift) + zp )
// Single-round, gemmlowp tie rule (rv64-qnn EXPERIMENTS.md E2).
// NB: locals deliberately avoid `p` etc. — Spike pastes this into a template
// where `p` is the processor pointer used by the RS1/WRITE_RD macros.
require_rv64;
int64_t xr_acc  = (int64_t)(int32_t)RS1;
uint64_t xr_prm = RS2;
int64_t xr_m0   = (int64_t)(uint32_t)(xr_prm & 0xFFFFFFFFu);
int     xr_sh   = (int)((xr_prm >> 32) & 0xFF);
int64_t xr_zp   = (int64_t)(int8_t)((xr_prm >> 40) & 0xFF);
int64_t xr_prod = xr_acc * xr_m0;
int64_t xr_mask = (((int64_t)1) << xr_sh) - 1;
int64_t xr_rem  = xr_prod & xr_mask;
int64_t xr_thr  = (xr_mask >> 1) + (xr_prod < 0 ? 1 : 0);
int64_t xr_q    = (xr_prod >> xr_sh) + (xr_rem > xr_thr ? 1 : 0) + xr_zp;
if (xr_q > 127) xr_q = 127;
if (xr_q < -128) xr_q = -128;
WRITE_RD(sext_xlen((reg_t)xr_q));
