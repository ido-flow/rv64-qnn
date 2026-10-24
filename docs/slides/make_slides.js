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
s.addText("Ido Ifergan   -   <course / team — fill in>", { x: 0.9, y: 6.55, w: 11.5, h: 0.4,
  fontFace: BODY, fontSize: 13, color: GREY, align: "center", margin: 0, isTextBox: true });
s.addNotes("The project in one sentence: a minimal RISC-V core runs integer neural-network inference badly for a structural reason, we measured exactly why, added the two smallest instructions that fix it, and proved every step bit-exact against the deployed model. Headlines: 5.6x over an OPTIMIZED software baseline, verified on 40,144 test vectors with zero failures.");

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
s.addNotes("We measured before designing anything. The naive kernel spends 8.06 instructions per MAC - verified three independent ways: the minstret hardware counter, the PC-filtered instruction trace, and the disassembly itself (8 instructions in the loop body). Only the copper bar is real work. Everything else is the overhead of feeding one byte at a time through a 64-bit machine.");

// S3 WHY -----------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Problem" });
s.addText("One register, eight numbers - one interpretation", { placeholder: "title" });
regStrip(s, 1.7, 1.55, 10, ["w7","w6","w5","w4","w3","w2","w1","w0"], PANEL, INK, 0.6);
s.addText("a single ld fills a register with eight consecutive INT8 weights - for free, since day one", {
  x: 1.7, y: 2.2, w: 10, h: 0.32, fontFace: BODY, fontSize: 12.5, color: MUT, align: "center", margin: 0, isTextBox: true });
card(s, 0.7, 3.0, 5.9, 2.9);
s.addText("What the base ISA sees", { x: 0.95, y: 3.2, w: 5.4, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: STEEL, margin: 0, isTextBox: true });
s.addText([
  { text: "Every instruction: the register is ONE 64-bit number", options: { bullet: true, breakLine: true } },
  { text: "One carry chain ripples across all 64 bits - carries leak across byte boundaries", options: { bullet: true, breakLine: true } },
  { text: "So software must extract bytes one at a time: lb, lb, mul ... eight round trips", options: { bullet: true } },
], { x: 0.95, y: 3.65, w: 5.4, h: 2.1, fontFace: BODY, fontSize: 13.5, color: MUT, paraSpaceAfter: 8, margin: 0, isTextBox: true });
card(s, 6.85, 3.0, 5.9, 2.9);
s.addText("What xqdot8 adds", { x: 7.1, y: 3.2, w: 5.4, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: COPPER, margin: 0, isTextBox: true });
s.addText([
  { text: "The MISSING INTERPRETATION: these 64 bits are 8 signed lanes", options: { bullet: true, breakLine: true } },
  { text: "Multiply lane-by-lane, carries fenced, sum the 8 products", options: { bullet: true, breakLine: true } },
  { text: "No new datapath width - the wires were already paid for", options: { bullet: true } },
], { x: 7.1, y: 3.65, w: 5.4, h: 2.1, fontFace: BODY, fontSize: 13.5, color: MUT, paraSpaceAfter: 8, margin: 0, isTextBox: true });
s.addText("Bits have no inherent meaning - instructions assign it. We added meaning, not hardware width.", {
  x: 0.7, y: 6.25, w: 12, h: 0.45, fontFace: HEAD, fontSize: 15, bold: true, color: INK, align: "center", margin: 0, isTextBox: true });
s.addNotes("The deep reason the waste exists: bits have no inherent meaning - the instruction decides the interpretation. Base RISC-V interprets every register as one number with one carry chain, so you cannot fake lanes with add: a carry from byte 0 corrupts byte 1. SIMD lanes are exactly the interpretation that is missing - the V and P extensions provide it in general, our core has neither, and xqdot8 is the narrow, measurement-justified version.");

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
s.addNotes("The loop is the point, not just the artifact. And the loop is enforceable because everything is integer: equality is transitive, so we can demand ZERO mismatches at every link rather than 'close enough'. Each link isolates one translation - understanding the math, porting it, implementing the instructions - so any failure names its own culprit. The NumPy file is the specification the hardware implements.");

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
s.addNotes("The workload: ResNet-18, 1.81 GMAC per image, already quantized to int8 - we performed no quantization ourselves, as directed. 98 percent of its arithmetic is multiply-accumulates, and every inner dimension is a multiple of eight, so the 8-lane instruction tiles every layer exactly. If asked why not a transformer, the full chain: we were directed to use pre-quantized downloads; no pre-quantized vision transformer was available at the designated source; and transformers carry LayerNorm, which needs the live input's statistics and cannot be folded away - ResNet's BatchNorm folds into the weights offline and vanishes from the deployed graph. ResNet-18 was also the highest-compute candidate, giving the most headroom to demonstrate speedup.");

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
s.addNotes("Both instructions obey one discipline: two reads, one write, like mul - so nothing in the existing core changes. The MAC-vs-dot decision is the key design point: accumulating needs a third register-file read port plus forwarding changes; we defer that to the RTL phase as a measured increment. xrq's story shows the method twice: its rounding was discovered empirically (TFLite is even internally inconsistent - its FC uses a different backend's rounding), and its parameter delivery was redesigned when measurement showed the CSR plan fired per output element.");

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
s.addNotes("Evaluated incrementally, as required. Software alone: 1.99x - that is why B1 exists, so the instruction is not credited with gains a compiler-grade kernel already had. xqdot8: 5.45x on top. xrq adds 3.6% - small BY STRUCTURE: requantize runs once per output against 14.5 million packed MACs; that is Amdahl's law measured, and its real payoff - removing two data-dependent branches per output - is a cycle-domain effect only the RTL phase can show. Headline: 5.6x against the optimized baseline.");

// S8 MIX -----------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
s.addText("The scalar multiply column dies", { placeholder: "title" });
s.addChart("bar", [
  { name: "scalar multiply %", labels: ["B0", "B1", "X1", "X2"], values: [14.1, 28.1, 0.3, 0.0] },
  { name: "custom instructions %", labels: ["B0", "B1", "X1", "X2"], values: [0, 0, 19.4, 20.4] },
], {
  x: 0.6, y: 1.5, w: 7.6, h: 5.2, barDir: "col", ...chartAxis,
  chartColors: [STEEL, COPPER], valAxisMaxVal: 30,
  showLegend: true, legendPos: "t", legendColor: MUT, legendFontFace: BODY, legendFontSize: 12,
  showValue: true, dataLabelPosition: "outEnd", dataLabelColor: INK, dataLabelFontSize: 11, dataLabelFormatCode: '0.0"%"',
  showTitle: true, title: "Instruction mix share by kernel (E7)", titleFontFace: HEAD, titleFontSize: 13, titleColor: INK,
});
card(s, 8.5, 1.5, 4.2, 5.2);
s.addText("Utilization is EXACT", { x: 8.75, y: 1.7, w: 3.7, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: INK, margin: 0, isTextBox: true });
s.addText([
  { text: "xqdot8 retired = MACs / 8, precisely (258,048 per row; 14,450,688 per layer)", options: { bullet: true, breakLine: true } },
  { text: "xrq retired = 1 per output element, precisely (3,584 / row)", options: { bullet: true, breakLine: true } },
  { text: "Scalar multiplies: 2,068,136 -> 168 (the identical count in B0 and B1 proves same work, different wrapping)", options: { bullet: true, breakLine: true } },
  { text: "The units are never idle-issued, never redundant", options: { bullet: true } },
], { x: 8.75, y: 2.2, w: 3.7, h: 4.3, fontFace: BODY, fontSize: 12.5, color: MUT, paraSpaceAfter: 8, margin: 0, isTextBox: true });
s.addNotes("Metric 7, custom-instruction utilization, measured exactly: one xqdot8 per eight MACs and one xrq per output - to the instruction. The steel bars are the scalar multiply population: identical count in B0 and B1 (same arithmetic, different wrapping), then absorbed entirely by the copper bars. The 168 residual multiplies are address computation.");

// S9 VERIFIED ------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
s.addText("Correct, verified - and smaller", { placeholder: "title" });
const tiles = [
  ["40,144", "directed + randomized vectors\nagainst independent C references\n0 failures", COPPER],
  ["2.18 M", "conv outputs matched bit-exactly\nacross all 20 layers when deriving\nthe rounding spec", STEEL],
  ["142.7 M", "instructions: a COMPLETE residual\nblock (conv-conv-add), bit-exact\nat every stage; xrq generalizes\nto the residual add", TEAL],
  ["650 B", "X2 kernel code - HALF of B1's\n1,320 B while 5.6x faster; and 0\nfloating-point instructions in\nevery binary (required)", INK],
];
tiles.forEach(([big, small, color], i) => {
  const x = 0.7 + (i % 2) * 6.2, y = 1.55 + Math.floor(i / 2) * 2.6;
  card(s, x, y, 5.9, 2.35);
  s.addText(big, { x: x + 0.3, y: y + 0.22, w: 5.3, h: 0.7, fontFace: HEAD, fontSize: 38, bold: true, color, margin: 0, isTextBox: true });
  s.addText(small, { x: x + 0.3, y: y + 0.95, w: 5.3, h: 1.3, fontFace: BODY, fontSize: 12.5, color: MUT, margin: 0, isTextBox: true });
});
s.addNotes("Verification is layered: the bit-exact chain against the deployed model, plus a directed-and-randomized suite against independent reference implementations - 40,144 vectors, zero failures. The residual block completes the required evaluation coverage and shows xrq is a general primitive: the residual add's output stage runs through the same instruction. And a result we did not expect until we measured it: the extension beats optimized software on code size too - half of B1's bytes.");

// S10 NEXT / CLOSE -------------------------------------------------------
pres.addSection({ title: "Next" });
s = pres.addSlide({ masterName: "DARK", sectionTitle: "Next" });
s.addText("The next bottleneck is already measured: memory", { x: 0.8, y: 0.55, w: 11.7, h: 0.7,
  fontFace: HEAD, fontSize: 30, bold: true, color: WHITE, margin: 0, isTextBox: true });
s.addText("After X2: loads + address arithmetic = ~70% of remaining instructions. The inner loop issues 5 loads against 4 MAC operations.", {
  x: 0.8, y: 1.35, w: 11.7, h: 0.55, fontFace: BODY, fontSize: 15, color: ICE, margin: 0, isTextBox: true });
const plan = [
  ["Post-increment load/store", "folds pointer bumps into loads: -18% of the inner loop, measurable in Spike first"],
  ["Accumulating xqmac8 (option A)", "the deferred variant - synthesis prices its 3rd read port; projected 0.31 instr/MAC"],
  ["Dual issue / pipelined cache", "cycle-domain attacks on the same 70% - invisible to instruction counts by design"],
];
plan.forEach(([a, b], i) => {
  const y = 2.3 + i * 1.0;
  s.addShape("roundRect", { x: 0.8, y, w: 11.7, h: 0.85, rectRadius: 0.06, fill: { color: "202A3C" }, line: { color: STEEL, width: 1 } });
  s.addText(a, { x: 1.05, y: y + 0.08, w: 4.3, h: 0.7, fontFace: HEAD, fontSize: 14.5, bold: true, color: LTCOP, valign: "middle", margin: 0, isTextBox: true });
  s.addText(b, { x: 5.5, y: y + 0.08, w: 6.8, h: 0.7, fontFace: BODY, fontSize: 12.5, color: ICE, valign: "middle", margin: 0, isTextBox: true });
});
s.addText("Hypotheses carried to RTL: xrq's branch elimination beats its 3.6% instruction saving - the 8-lane unit's adder tree does not touch Fmax - endgame metric: speedup per unit area (Synopsys DC, SAED 32/28nm)", {
  x: 0.8, y: 5.5, w: 11.7, h: 0.75, fontFace: BODY, fontSize: 12.5, italic: true, color: GREY, margin: 0, isTextBox: true });
s.addText("bit-exact   -   5.6x over optimized software   -   zero core surgery   -   ready for RTL", {
  x: 0.8, y: 6.5, w: 11.7, h: 0.5, fontFace: HEAD, fontSize: 17, bold: true, color: LTCOP, align: "center", margin: 0, isTextBox: true });
s.addNotes("We end on the closing question: what becomes the bottleneck after the optimization? Measured answer: memory - 70% of what remains is loads and addressing. The RTL phase is scoped around that: post-increment addressing, the accumulating variant priced by synthesis, dual issue for the cycle domain. Everything from here is a hypothesis with a named instrument to test it.");

pres.writeFile({ fileName: "rv64_midterm_slides.pptx" }).then(() => console.log("written"));
