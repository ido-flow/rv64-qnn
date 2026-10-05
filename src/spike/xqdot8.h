// xqdot8 rd, rs1, rs2 : rd = sum over i of sext8(rs1.byte[i]) * sext8(rs2.byte[i])
// Packed 8-lane INT8 dot product, no accumulate (design option D: plain
// 2-read/1-write, so the register file needs no changes). Result range is
// +-131072 (18 bits), sign-extended into rd. See rv64-qnn DESIGN.md §4.1.
require_rv64;
sreg_t acc = 0;
for (int i = 0; i < 8; i++) {
  sreg_t a = (int8_t)(RS1 >> (8 * i));
  sreg_t w = (int8_t)(RS2 >> (8 * i));
  acc += a * w;
}
WRITE_RD(sext_xlen(acc));
