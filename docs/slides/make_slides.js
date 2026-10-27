// Midterm presentation generator. Every number is from EXPERIMENTS.md E1-E8.
const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";                   // 13.33 x 7.5
pres.author = "Ido Ifergan";
pres.title  = "Eight MACs per Instruction";

// palette (project identity: copper interconnect on ink/steel)
const INK = "161B26", STEEL = "3D5A80", COPPER = "A9552A", LTCOP = "E08C57";
const GREY = "8B96A8", MUT = "4C5769", PANEL = "EEF1F5", RULE = "DDE1E8";
const TEAL = "0E7C6B", WHITE = "FFFFFF", ICE = "C9D6E8";
const HEAD = "Arial", BODY = "Calibri", MONO = "Courier New";

pres.defineSlideMaster({ title: "DARK", background: { color: INK }, objects: [] });
pres.defineSlideMaster({
  title: "CONTENT", background: { color: WHITE },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.28, w: 12.1, h: 0.75,
        fontFace: HEAD, fontSize: 28, bold: true, color: INK, align: "left", margin: 0 }, text: "" } },
    { text: { text: "RV64IMC term project - midterm", options: { x: 0.6, y: 7.12, w: 4, h: 0.3,
        fontFace: BODY, fontSize: 9, color: GREY, align: "left", margin: 0 } } },
  ],
  slideNumber: { x: 12.6, y: 7.12, w: 0.5, h: 0.3, fontFace: BODY, fontSize: 9, color: GREY },
});

// helpers ---------------------------------------------------------------
function regStrip(s, x, y, w, labels, fill, txt, cellH = 0.52) {
  const cw = w / labels.length;
  labels.forEach((lb, i) => {
    s.addShape("rect", { x: x + i * cw, y, w: cw - 0.04, h: cellH, fill: { color: fill }, line: { color: INK, width: 1 } });
    s.addText(lb, { x: x + i * cw, y, w: cw - 0.04, h: cellH, fontFace: MONO, fontSize: 12,
      color: txt, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
}
function stat(s, x, y, w, big, small, color, bigSize = 40) {
  s.addText(big,   { x, y, w, h: 0.75, fontFace: HEAD, fontSize: bigSize, bold: true, color, align: "left", margin: 0, isTextBox: true });
  s.addText(small, { x, y: y + 0.72, w, h: 0.55, fontFace: BODY, fontSize: 12.5, color: MUT, align: "left", margin: 0, isTextBox: true });
}
function card(s, x, y, w, h) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.06, fill: { color: PANEL }, line: { color: RULE, width: 1 } });
}
const chartAxis = {
  catAxisLabelColor: MUT, catAxisLabelFontFace: BODY, catAxisLabelFontSize: 12,
  valAxisLabelColor: MUT, valAxisLabelFontFace: BODY, valAxisLabelFontSize: 10,
  valGridLine: { color: RULE, size: 1 }, catGridLine: { style: "none" },
  dataLabelFontFace: HEAD, chartArea: { fill: { color: WHITE } },
};

// S1 TITLE ---------------------------------------------------------------
pres.addSection({ title: "Problem" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "Problem" });
regStrip(s, 2.07, 0.85, 9.2, ["a7","a6","a5","a4","a3","a2","a1","a0"], "243048", LTCOP);
s.addText("one 64-bit register = eight INT8 values", { x: 2.07, y: 1.42, w: 9.2, h: 0.3,
  fontFace: MONO, fontSize: 11, color: GREY, align: "center", margin: 0, isTextBox: true });
s.addText("Eight MACs per Instruction", { x: 0.9, y: 2.35, w: 11.5, h: 1.1,
  fontFace: HEAD, fontSize: 48, bold: true, color: WHITE, align: "center", margin: 0, isTextBox: true });
s.addText("Accelerating quantized ResNet-18 inference on RV64IMC\nMidterm: ISA design and Spike implementation", {
  x: 0.9, y: 3.55, w: 11.5, h: 0.85, fontFace: BODY, fontSize: 17, color: ICE, align: "center", margin: 0, isTextBox: true });
[["5.6x", "vs optimized software"], ["bit-exact", "vs the deployed model"], ["40,144", "test vectors, 0 failures"]].forEach(([b, t], i) => {
  const x = 2.26 + i * 3.1;
  s.addShape("roundRect", { x, y: 4.85, w: 2.8, h: 1.05, rectRadius: 0.08, fill: { color: "202A3C" }, line: { color: STEEL, width: 1 } });
  s.addText(b, { x, y: 4.95, w: 2.8, h: 0.5, fontFace: HEAD, fontSize: 22, bold: true, color: LTCOP, align: "center", margin: 0, isTextBox: true });
  s.addText(t, { x, y: 5.44, w: 2.8, h: 0.35, fontFace: BODY, fontSize: 11, color: ICE, align: "center", margin: 0, isTextBox: true });
});
s.addText("Ido Ifergan   -   <course name — fill in>", { x: 0.9, y: 6.55, w: 11.5, h: 0.4,
  fontFace: BODY, fontSize: 13, color: GREY, align: "center", margin: 0, isTextBox: true });
s.addNotes("(~15 sec) One sentence: a minimal RISC-V core runs integer neural-network inference badly for a structural reason; we measured why, added the two smallest instructions that fix it, and proved every step bit-exact against the deployed model itself.");

// S2 PROBLEM MEASURED ----------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Problem" });
s.addText("The problem, measured", { placeholder: "title" });
stat(s, 0.7, 1.45, 4.6, "8.06", "instructions per multiply-accumulate\nnaive INT8 dot product, GCC -O2 (E1)", COPPER, 54);
stat(s, 0.7, 3.1, 4.6, "12.5%", "of retired instructions are the multiplies\nthat do the actual work", INK, 36);
card(s, 0.7, 4.6, 4.6, 1.9);
s.addText([
  { text: "Each load moves ONE byte through an 8-byte-wide path", options: { bullet: true, breakLine: true } },
  { text: "Two pointer bumps + a zero-point subtract per MAC", options: { bullet: true, breakLine: true } },
  { text: "One branch per MAC", options: { bullet: true } },
], { x: 0.9, y: 4.75, w: 4.25, h: 1.65, fontFace: BODY, fontSize: 13, color: MUT, paraSpaceAfter: 6, margin: 0, isTextBox: true });
s.addChart("bar", [{ name: "share of instructions", labels: ["int ALU", "load", "branch", "multiply"], values: [43.0, 28.3, 14.3, 14.1] }], {
  x: 5.8, y: 1.45, w: 6.9, h: 5.0, barDir: "bar", ...chartAxis,
  chartColors: [GREY, GREY, GREY, COPPER], showLegend: false,
  showValue: true, dataLabelPosition: "outEnd", dataLabelColor: INK, dataLabelFontSize: 12, dataLabelFormatCode: '0.0"%"',
  valAxisMaxVal: 50, showTitle: true, title: "Where the baseline's instructions go (B0, real layer)",
  titleFontFace: HEAD, titleFontSize: 13, titleColor: INK,
});
s.addText("A 64-bit register already carries eight INT8 values - the base ISA just reads them as ONE number. We add the missing interpretation, not hardware width.", {
  x: 0.7, y: 6.58, w: 12, h: 0.45, fontFace: HEAD, fontSize: 13.5, bold: true, color: INK, align: "center", margin: 0, isTextBox: true });
s.addNotes("(~55 sec) We measured before designing. The naive kernel spends 8.06 instructions per MAC - confirmed three independent ways: the minstret hardware counter, the PC-filtered instruction trace, and the disassembly itself, which shows exactly 8 instructions in the loop body. Only the copper bar is real work. The reason is structural: a 64-bit register already holds eight INT8 values, but every base instruction reads it as ONE number with one carry chain - so software must feed the machine one byte at a time. The fix is an interpretation, not more hardware.");

// S4 METHOD --------------------------------------------------------------
pres.addSection({ title: "Design" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Design" });
s.addText("Method: measure, propose, implement, evaluate", { placeholder: "title" });
["Measure\nSpike + minstret,\nPC-filtered traces", "Propose\nsmallest extension the\nnumbers justify", "Implement\n~15 lines of semantics\nper instruction in Spike", "Evaluate\nincremental: B0 - B1 - X1 - X2,\nbit-exact at every stage"].forEach((t, i) => {
  const x = 0.7 + i * 3.1, parts = t.split("\n");
  s.addShape("roundRect", { x, y: 1.55, w: 2.85, h: 1.5, rectRadius: 0.08, fill: { color: i === 3 ? COPPER : PANEL }, line: { color: RULE, width: 1 } });
  s.addText(parts[0], { x: x + 0.15, y: 1.68, w: 2.55, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: i === 3 ? WHITE : INK, margin: 0, isTextBox: true });
  s.addText(parts.slice(1).join("\n"), { x: x + 0.15, y: 2.1, w: 2.55, h: 0.85, fontFace: BODY, fontSize: 11.5, color: i === 3 ? WHITE : MUT, margin: 0, isTextBox: true });
  if (i < 3) s.addText(">", { x: x + 2.83, y: 2.05, w: 0.3, h: 0.5, fontFace: HEAD, fontSize: 20, bold: true, color: GREY, align: "center", margin: 0, isTextBox: true });
});
s.addText("Correctness = a bit-exact verification chain", { x: 0.7, y: 3.5, w: 12, h: 0.45,
  fontFace: HEAD, fontSize: 18, bold: true, color: INK, margin: 0, isTextBox: true });
const chain = [["TFLite interpreter", "the deployed model itself - ground truth"],
  ["NumPy reference", "rounding rules reverse-engineered until exact - THE SPEC"],
  ["bare-metal C", "same arithmetic in the target's world"],
  ["Spike + custom instructions", "same arithmetic, hot parts in 'hardware'"]];
chain.forEach(([a, b], i) => {
  const y = 4.1 + i * 0.72;
  s.addShape("roundRect", { x: 1.6, y, w: 3.8, h: 0.56, rectRadius: 0.06, fill: { color: i === 0 ? STEEL : PANEL }, line: { color: RULE, width: 1 } });
  s.addText(a, { x: 1.72, y, w: 3.6, h: 0.56, fontFace: MONO, fontSize: 13, color: i === 0 ? WHITE : INK, valign: "middle", margin: 0, isTextBox: true });
  s.addText(b, { x: 5.7, y, w: 7.0, h: 0.56, fontFace: BODY, fontSize: 12.5, color: MUT, valign: "middle", margin: 0, isTextBox: true });
  if (i < 3) s.addText("v  0 mismatches", { x: 1.75, y: y + 0.53, w: 3.6, h: 0.22, fontFace: MONO, fontSize: 9, color: TEAL, margin: 0, isTextBox: true });
});
s.addNotes("(~45 sec) The loop is the point, not just the artifact - and it is enforceable because everything is integer: equality is transitive, so we demand ZERO mismatches at every link, never close-enough. Each link isolates one translation - understanding the math, porting it, implementing the instructions - so any failure names its own culprit. The NumPy file is the specification the hardware implements.");

// S5 WORKLOAD ------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Design" });
s.addText("The workload: ResNet-18, quantized (W8A8)", { placeholder: "title" });
const facts = [
  ["1.81 GMAC", "per inference - 11.7 M parameters, INT8 weights and activations, per-channel scales"],
  ["20 convs + 1 FC", "8 residual blocks; a published pre-quantized model - no quantization performed here"],
  ["K divides by 8", "inner dimensions 576 / 1152 / 2304 / 4608 tile the 8-lane instruction exactly (stem K=147, padded)"],
];
facts.forEach(([a, b], i) => {
  const y = 1.8 + i * 1.3;
  card(s, 0.7, y, 7.4, 1.1);
  s.addText(a, { x: 0.95, y: y + 0.12, w: 2.45, h: 0.86, fontFace: HEAD, fontSize: 17, bold: true, color: COPPER, valign: "middle", margin: 0, isTextBox: true });
  s.addText(b, { x: 3.5, y: y + 0.12, w: 4.45, h: 0.86, fontFace: BODY, fontSize: 12.5, color: MUT, valign: "middle", margin: 0, isTextBox: true });
});
s.addText("CNN rather than transformer: BatchNorm folds into the weights offline and vanishes; LayerNorm cannot (it needs the live input's statistics - and there is no FPU).", {
  x: 0.7, y: 5.9, w: 7.4, h: 0.75, fontFace: BODY, fontSize: 12, italic: true, color: GREY, margin: 0, isTextBox: true });
card(s, 8.4, 1.8, 4.3, 4.7);
stat(s, 8.7, 2.05, 3.8, "98%", "of arithmetic is MACs", COPPER, 40);
stat(s, 8.7, 3.4, 3.8, "0", "normalization ops in the deployed\ngraph - BatchNorm folded away", INK, 40);
stat(s, 8.7, 4.8, 3.8, "free", "ReLU: output zero point is -128,\nso the int8 clamp IS the ReLU", TEAL, 40);
s.addNotes("(~40 sec) ResNet-18, 1.81 GMAC per image, already quantized - we performed no quantization ourselves, as directed. 98 percent of its arithmetic is MACs, and every inner dimension is a multiple of eight, so the 8-lane instruction tiles every layer exactly. If asked why not a transformer: no pre-quantized vision transformer was available to download, and LayerNorm needs the live input statistics and cannot fold away - ResNet BatchNorm folds into the weights offline and vanishes.");

// S6 INSTRUCTIONS --------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Design" });
s.addText("Two instructions on custom-0 - zero core surgery", { placeholder: "title" });
card(s, 0.7, 1.45, 5.95, 4.35);
s.addText("xqdot8  rd, rs1, rs2", { x: 0.95, y: 1.62, w: 5.45, h: 0.42, fontFace: MONO, fontSize: 17, bold: true, color: COPPER, margin: 0, isTextBox: true });
s.addText("rd = sum of 8 lane-wise INT8 products", { x: 0.95, y: 2.06, w: 5.45, h: 0.35, fontFace: MONO, fontSize: 11.5, color: MUT, margin: 0, isTextBox: true });
s.addText([
  { text: "2-read / 1-write - structurally identical to mul", options: { bullet: true, breakLine: true } },
  { text: "Register file, forwarding, pipeline: UNTOUCHED", options: { bullet: true, breakLine: true } },
  { text: "Deliberately non-accumulating: a true MAC needs a 3rd register read. That variant (xqmac8) is deferred to the RTL phase as a measured increment - synthesis will price the port", options: { bullet: true, breakLine: true } },
  { text: "Bonus: consecutive xqdot8 are independent - latency-tolerant", options: { bullet: true } },
], { x: 0.95, y: 2.55, w: 5.45, h: 3.1, fontFace: BODY, fontSize: 12.5, color: MUT, paraSpaceAfter: 7, margin: 0, isTextBox: true });
card(s, 6.95, 1.45, 5.75, 4.35);
s.addText("xrq  rd, rs1, rs2", { x: 7.2, y: 1.62, w: 5.25, h: 0.42, fontFace: MONO, fontSize: 17, bold: true, color: COPPER, margin: 0, isTextBox: true });
s.addText("int32 acc -> rounded, scaled, clamped int8", { x: 7.2, y: 2.06, w: 5.25, h: 0.35, fontFace: MONO, fontSize: 11.5, color: MUT, margin: 0, isTextBox: true });
s.addText([
  { text: "Replaces ~13 instructions incl. 2 data-dependent branches (RV64IMC has no min/max)", options: { bullet: true, breakLine: true } },
  { text: "Semantics REVERSE-ENGINEERED to bit-exactness: single rounding, not textbook double rounding (which is +1 on 0.065% of outputs)", options: { bullet: true, breakLine: true } },
  { text: "Design corrected by measurement: CSR parameters would fire per-output (pixel-outermost loops) - so per-channel constants pack into rs2 instead", options: { bullet: true } },
], { x: 7.2, y: 2.55, w: 5.25, h: 3.1, fontFace: BODY, fontSize: 12.5, color: MUT, paraSpaceAfter: 7, margin: 0, isTextBox: true });
regStrip(s, 2.7, 6.15, 8, ["funct7", "rs2", "rs1", "f3", "rd", "0001011"], PANEL, INK, 0.45);
s.addText("standard R-type encoding on the reserved custom-0 opcode", { x: 2.7, y: 6.63, w: 8, h: 0.3,
  fontFace: BODY, fontSize: 10.5, color: GREY, align: "center", margin: 0, isTextBox: true });
s.addNotes("(~60 sec) Both instructions obey one discipline: two reads, one write, like mul - nothing in the existing core changes. The MAC-versus-dot decision is the key design point: accumulating needs a third register-file read port plus forwarding changes; we defer that to the RTL phase as a measured increment. xrq shows the method twice: its rounding was discovered empirically - TFLite is even internally inconsistent, its FC layer rounds differently - and its parameter delivery was redesigned when measurement showed the CSR plan would fire per output element.");

// S7 RESULTS -------------------------------------------------------------
pres.addSection({ title: "Results" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
s.addText("Results: 7.13 to 0.63 instructions per MAC", { placeholder: "title" });
s.addChart("bar", [{ name: "instr/MAC", labels: ["B0 naive", "B1 sw-optimized", "X1 +xqdot8", "X2 +xrq"], values: [7.13, 3.57, 0.66, 0.63] }], {
  x: 0.6, y: 1.5, w: 8.1, h: 5.2, barDir: "col", ...chartAxis,
  chartColors: [COPPER], showLegend: false, valAxisMaxVal: 8,
  showValue: true, dataLabelPosition: "outEnd", dataLabelColor: INK, dataLabelFontSize: 14, dataLabelFormatCode: "0.00",
  showTitle: true, title: "layer1.0.conv1 - 115.6 M MACs - every bar bit-exact vs TFLite",
  titleFontFace: HEAD, titleFontSize: 13, titleColor: INK,
});
s.addText("x1.99 software", { x: 2.42, y: 4.15, w: 1.9, h: 0.3, fontFace: HEAD, fontSize: 11, bold: true, color: STEEL, margin: 0, isTextBox: true });
s.addText("x5.45 xqdot8",   { x: 4.3, y: 5.5, w: 1.9, h: 0.3, fontFace: HEAD, fontSize: 11, bold: true, color: STEEL, margin: 0, isTextBox: true });
s.addText("x1.036 xrq (Amdahl)", { x: 6.2, y: 5.5, w: 2.2, h: 0.3, fontFace: HEAD, fontSize: 11, bold: true, color: STEEL, margin: 0, isTextBox: true });
card(s, 9.0, 1.5, 3.7, 5.2);
stat(s, 9.3, 1.75, 3.2, "5.6x", "vs the OPTIMIZED baseline\n(the honest comparison)", COPPER, 44);
stat(s, 9.3, 3.25, 3.2, "11.3x", "vs naive - mentioned,\nnot the headline", INK, 36);
stat(s, 9.3, 4.6, 3.2, ">=2x", "the project target -\ncleared 2.8x over", TEAL, 36);
s.addText("Utilization exact: xqdot8 = MACs/8\n(14,450,688); xrq = 1 per output.\nScalar multiplies: 2,068,136 -> 168.", {
  x: 9.3, y: 5.75, w: 3.2, h: 0.85, fontFace: BODY, fontSize: 10.5, color: MUT, margin: 0, isTextBox: true });
s.addNotes("(~60 sec) Evaluated incrementally, as required. Software alone gives 1.99x - that is why B1 exists: the instruction must not be credited with gains a compiler-grade kernel already had. xqdot8 gives 5.45x on top; xrq adds 3.6 percent, small BY STRUCTURE - requantize runs once per output against 14.5 million packed MACs; Amdahl, measured. The mix confirms the mechanism: scalar multiplies fall from 2.07 million to 168, absorbed by exactly MACs-over-eight xqdot8 operations and one xrq per output - the units are never idle, never redundant. Headline: 5.6x against the optimized baseline.");

// CLOSE — verified + next bottleneck (merged) -----------------------------
pres.addSection({ title: "Close" });
s = pres.addSlide({ masterName: "DARK", sectionTitle: "Close" });
s.addText("Verified end to end - and the next bottleneck is measured", { x: 0.8, y: 0.5, w: 11.7, h: 0.65,
  fontFace: HEAD, fontSize: 28, bold: true, color: WHITE, margin: 0, isTextBox: true });
[["40,144 / 0", "directed + randomized vectors vs independent references - zero failures"],
 ["bit-exact block", "a complete residual block, conv-conv-add; xrq generalizes to the add"],
 ["650 B", "X2 kernel code: half the size of optimized B1, 5.6x faster; zero FP instructions"]].forEach(([b, t], i) => {
  const x = 0.8 + i * 4.03;
  s.addShape("roundRect", { x, y: 1.5, w: 3.75, h: 1.6, rectRadius: 0.08, fill: { color: "202A3C" }, line: { color: STEEL, width: 1 } });
  s.addText(b, { x: x + 0.22, y: 1.64, w: 3.3, h: 0.5, fontFace: HEAD, fontSize: 21, bold: true, color: LTCOP, margin: 0, isTextBox: true });
  s.addText(t, { x: x + 0.22, y: 2.16, w: 3.3, h: 0.9, fontFace: BODY, fontSize: 11, color: ICE, margin: 0, isTextBox: true });
});
s.addText("What remains, measured: loads + address arithmetic are ~70% of X2 instructions - the inner loop issues 5 loads against 4 MAC operations. The RTL phase is scoped on exactly that:", {
  x: 0.8, y: 3.45, w: 11.7, h: 0.6, fontFace: BODY, fontSize: 13.5, color: ICE, margin: 0, isTextBox: true });
[["Post-increment load/store", "folds pointer bumps into loads: -18% of the inner loop, measurable in Spike first"],
 ["Accumulating xqmac8", "the deferred variant - synthesis prices its 3rd read port; projected 0.31 instr/MAC"],
 ["Dual issue / pipelined cache", "cycle-domain attacks on the same 70% - invisible to instruction counts by design"]].forEach(([a, b], i) => {
  const y = 4.2 + i * 0.72;
  s.addShape("roundRect", { x: 0.8, y, w: 11.7, h: 0.6, rectRadius: 0.06, fill: { color: "202A3C" }, line: { color: STEEL, width: 1 } });
  s.addText(a, { x: 1.05, y, w: 3.95, h: 0.6, fontFace: HEAD, fontSize: 13.5, bold: true, color: LTCOP, valign: "middle", margin: 0, isTextBox: true });
  s.addText(b, { x: 5.15, y, w: 7.15, h: 0.6, fontFace: BODY, fontSize: 12, color: ICE, valign: "middle", margin: 0, isTextBox: true });
});
s.addText("bit-exact   -   5.6x over optimized software   -   zero core surgery   -   ready for RTL", {
  x: 0.8, y: 6.55, w: 11.7, h: 0.5, fontFace: HEAD, fontSize: 16, bold: true, color: LTCOP, align: "center", margin: 0, isTextBox: true });
s.addNotes("(~50 sec) Correctness in three tiles: forty thousand directed and randomized vectors, zero failures; a complete residual block bit-exact at every stage, with xrq reused for the residual add output - the primitive generalizes; and a result we only believed after measuring: the extension also HALVES code size versus the optimized kernel. The closing question answers itself in the data: what remains is seventy percent loads and addressing, and the RTL phase attacks exactly that - post-increment addressing, the accumulating variant priced by synthesis, and dual issue. Thank you.");

// ===== APPENDIX — experimental record (not part of the 5-6 min talk) =====
pres.addSection({ title: "Appendix" });
s = pres.addSlide({ masterName: "DARK", sectionTitle: "Appendix" });
s.addText("Appendix", { x: 0.9, y: 2.6, w: 11.5, h: 0.9, fontFace: HEAD, fontSize: 40, bold: true, color: WHITE, align: "center", margin: 0, isTextBox: true });
s.addText("Experimental results and analysis (E1-E8), beyond the talk.\nEvery number regenerates with ./scripts/run_all.sh - expected outputs are tabulated in the README.", {
  x: 0.9, y: 3.6, w: 11.5, h: 0.9, fontFace: BODY, fontSize: 14, color: ICE, align: "center", margin: 0, isTextBox: true });
s.addNotes("Appendix divider - the talk ends at the previous slide.");

function tbl(slide, x, y, w, colW, header, rows, fs) {
  const hdr = header.map(h => ({ text: h, options: { bold: true, color: INK, fill: { color: PANEL }, fontFace: HEAD, fontSize: fs - 1 } }));
  const body = rows.map(r => r.map(c => ({ text: c, options: { color: MUT, fontFace: BODY, fontSize: fs } })));
  slide.addTable([hdr].concat(body), { x, y, w, colW, border: { type: "solid", color: RULE, pt: 0.5 }, margin: 0.05, valign: "middle" });
}

// A1 — main results
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Appendix" });
s.addText("A1 - Main results (layer1.0.conv1, 115,605,504 MACs)", { placeholder: "title" });
tbl(s, 0.7, 1.45, 12.0, [2.7, 2.5, 1.6, 1.4, 1.9, 1.9],
  ["config", "dynamic instructions", "instr/MAC", "step", "cumulative", "mismatches"],
  [["B0  naive C, -O2", "824,959,988", "7.13", "-", "1.00x", "0 / 200,704"],
   ["B1  tile4 + unroll8", "413,848,076", "3.57", "1.99x", "1.99x", "0 / 200,704"],
   ["X1  + xqdot8", "75,926,769", "0.657", "5.45x", "10.86x", "0 / 200,704"],
   ["X2  + xqdot8 + xrq", "73,267,673", "0.634", "1.036x", "11.26x", "0 / 200,704"]], 12);
s.addText([
  { text: "Complete residual block (E8): conv1 69,554,877 + conv2 69,554,877 + quantized add 3,612,690 instructions - 0 mismatches at every stage vs TFLite", options: { bullet: true, breakLine: true } },
  { text: "Microbenchmark (E1): 1,548 instructions / 192 MACs = 8.06/MAC - matches the static loop count (192 x 8 + 12 call overhead)", options: { bullet: true, breakLine: true } },
  { text: "Kernel code size: B0 476 B - B1 1,320 B - X1 860 B - X2 650 B (the extension halves the optimized kernel)", options: { bullet: true, breakLine: true } },
  { text: "Target: >=2x dynamic-instruction reduction - achieved 5.6x vs B1 (the optimized baseline), 11.3x vs naive", options: { bullet: true } },
], { x: 0.7, y: 4.35, w: 12.0, h: 2.4, fontFace: BODY, fontSize: 12.5, color: MUT, paraSpaceAfter: 7, margin: 0, isTextBox: true });
s.addNotes("Backup - full result table.");

// A2 — instruction mix + utilization
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Appendix" });
s.addText("A2 - Instruction mix and custom-instruction utilization (E7)", { placeholder: "title" });
tbl(s, 0.7, 1.45, 8.2, [2.4, 1.45, 1.45, 1.45, 1.45],
  ["class (% of retired)", "B0", "B1", "X1", "X2"],
  [["int ALU", "43.0", "34.3", "42.8", "41.4"],
   ["load", "28.3", "35.6", "26.9", "27.7"],
   ["scalar multiply", "14.1", "28.1", "0.3", "0.0"],
   ["XQDOT8", "-", "-", "19.4", "20.1"],
   ["XRQ", "-", "-", "-", "0.3"],
   ["branch", "14.3", "1.5", "8.0", "7.8"],
   ["store", "0.2", "0.5", "2.7", "2.8"]], 12);
s.addText([
  { text: "Utilization is exact by count: XQDOT8 retired = MACs/8 precisely (258,048 per measured row; 14,450,688 per layer); XRQ = 1 per output element (3,584)", options: { bullet: true, breakLine: true } },
  { text: "Scalar multiplies: 2,068,136 -> 168. The identical count in B0 and B1 proves same arithmetic, different wrapping; the 168 residue is address computation", options: { bullet: true, breakLine: true } },
  { text: "Method: one-output-row runs (mix is loop-invariant), commit log PC-filtered to the kernel symbol. Whole-program traces are invalid here: the HTIF output poll loop dominates them", options: { bullet: true, breakLine: true } },
  { text: "After X2, loads + address arithmetic ~70% of retired instructions: the measured next bottleneck", options: { bullet: true } },
], { x: 9.2, y: 1.45, w: 3.5, h: 5.2, fontFace: BODY, fontSize: 11.5, color: MUT, paraSpaceAfter: 8, margin: 0, isTextBox: true });
s.addNotes("Backup - required mix metric and utilization, measured.");

// A3 — requantization semantics, empirically derived
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Appendix" });
s.addText("A3 - Requantization semantics, derived to bit-exactness (E2)", { placeholder: "title" });
tbl(s, 0.7, 1.45, 9.6, [5.2, 2.2, 2.2],
  ["candidate rounding rule", "mismatches (1 conv)", "all 20 convs"],
  [["two-step gemmlowp (SRDHM + RDBPOT), floor variant", "130 / 200,704 (+1)", "-"],
   ["two-step gemmlowp, truncating variant", "130 / 200,704 (+1)", "-"],
   ["SINGLE rounding: rdbpot(acc x M0, 31+rs)  [adopted]", "0", "0 / 2,183,168"]], 12);
s.addText([
  { text: "The +1 pattern is a double-rounding artifact: the textbook two-step rounds twice; TFLite's conv backend rounds once", options: { bullet: true, breakLine: true } },
  { text: "TFLite is internally inconsistent: its FC layer uses a different backend (ruy) with different rounding. We implement the conv semantics only - the cheaper datapath - accepting <=3 of 1000 FC logits off by +-1 (argmax unaffected)", options: { bullet: true, breakLine: true } },
  { text: "xrq rd, rs1, rs2:  rd = clamp_int8( rdbpot(acc x M0, shift) + zp ), with M0 | shift | zp packed per channel into rs2 offline. The original CSR-parameter design was corrected when measurement showed pixel-outermost loops make CSR writes fire per output", options: { bullet: true, breakLine: true } },
  { text: "The residual add's output stage reuses xrq unchanged - the primitive generalizes beyond convolution (E8)", options: { bullet: true } },
], { x: 0.7, y: 3.35, w: 12.0, h: 3.4, fontFace: BODY, fontSize: 12.5, color: MUT, paraSpaceAfter: 8, margin: 0, isTextBox: true });
s.addNotes("Backup - the empirical rounding derivation.");

// A4 — design-space analysis
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Appendix" });
s.addText("A4 - ISA design space: the three-operand problem", { placeholder: "title" });
tbl(s, 0.7, 1.45, 12.0, [1.0, 3.1, 4.4, 3.5],
  ["opt", "form", "modifications to the existing core", "assessment"],
  [["A", "xqmac8 rd += dot8(rs1,rs2)", "3rd register-file read port + forwarding/hazard extension", "best density (~0.28 instr/MAC); deferred to RTL as a measured increment"],
   ["B", "R4-type with explicit rs3", "same as A, nonstandard integer format", "dominated by A - rejected"],
   ["C", "accumulators inside the unit", "none, but new architectural state + move instructions", "self-contained; compiler cannot allocate accumulators"],
   ["D", "xqdot8 rd = dot8(rs1,rs2)", "NONE - 2-read/1-write like mul; add accumulates", "CHOSEN: zero core surgery; ~45% more loop instructions than A, still 5.6x"]], 11.5);
s.addText([
  { text: "Choice rationale: (i) risk - additions fail their own tests loudly, modifications to the register file and bypass network fail silently and late; (ii) sufficiency - D already exceeds the 2x target by 2.8x; (iii) method - A becomes the RTL phase's measured increment, priced by synthesis", options: { bullet: true, breakLine: true } },
  { text: "Latency bonus of D: consecutive xqdot8 results are independent (only cheap adds chain), so a multi-cycle unit pipelines without stalls", options: { bullet: true } },
], { x: 0.7, y: 4.6, w: 12.0, h: 2.1, fontFace: BODY, fontSize: 12.5, color: MUT, paraSpaceAfter: 8, margin: 0, isTextBox: true });
s.addNotes("Backup - design-space analysis and the documented choice.");

// A5 — methodology and reproducibility
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Appendix" });
s.addText("A5 - Measurement methodology and reproducibility", { placeholder: "title" });
s.addText([
  { text: "Counts: minstret CSR read around the region of interest - exact, zero overhead, works at full scale. Mixes: commit-log trace, decoded by opcode field, PC-filtered to kernel symbols (noinline keeps them addressable)", options: { bullet: true, breakLine: true } },
  { text: "The 8.06 baseline is triple-checked: hardware counter (1,548/192), filtered trace (1,541 in-symbol), and static disassembly (8-instruction loop body) agree independently", options: { bullet: true, breakLine: true } },
  { text: "Correctness chain, each link bit-exact (0 mismatches): TFLite interpreter (deployed model, fusing delegate disabled) -> NumPy reference (the spec) -> bare-metal C -> Spike custom instructions", options: { bullet: true, breakLine: true } },
  { text: "Instruction verification: directed corners (saturation, lane isolation, shift/zp bounds) + 20,000 random vectors per instruction vs independent C references - 40,144 vectors, 0 failures", options: { bullet: true, breakLine: true } },
  { text: "Anti-artifact hygiene: outputs always consumed by checkers; every binary scanned for FP instructions (0, as required); quantized padding fills with the zero point", options: { bullet: true, breakLine: true } },
  { text: "Reproduce everything: ./scripts/run_all.sh (add --with-mix for E7). Environment: xPack riscv-none-elf-gcc 15.2, Spike @1960943 + src/spike/custom-insns-spike.patch, -march=rv64imc_zicsr_zifencei -mabi=lp64. Expected outputs: README tables", options: { bullet: true } },
], { x: 0.7, y: 1.55, w: 12.0, h: 5.3, fontFace: BODY, fontSize: 13, color: MUT, paraSpaceAfter: 10, margin: 0, isTextBox: true });
s.addNotes("Backup - how every number was produced and how to reproduce it.");

pres.writeFile({ fileName: "rv64_midterm_slides.pptx" }).then(() => console.log("written"));
