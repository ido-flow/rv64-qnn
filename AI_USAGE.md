# AI usage disclosure

## Policy context

LLM use was discussed with the course staff and permitted for this project,
including obtaining the pre-quantized model and writing implementation code
(instructor guidance, 15 Sep 2026: teams may use downloaded quantized models
directly; in-class confirmation that a non-transformer model and AI-assisted
implementation are acceptable).

## Tool

Claude (Anthropic), used through Claude Code on the development machine,
across working sessions from 2026-09-22 to the present. The assistant had
direct access to the repository, the RISC-V toolchain, Spike, and the
measurement scripts, and executed builds/runs under my direction.

## Division of work

**AI-implemented, under my direction:** environment setup (toolchain, Spike
build, bare-metal runtime integration); the C kernels (B0/B1/X1/X2, block);
the Spike implementations of `xqdot8` and `xrq`; the export, reference and
profiling scripts; the empirical rounding-rule search; measurement runs; and
the report draft. Explanations of every concept (bare metal, quantization,
ISA encoding, pipelines) were provided to me throughout as teaching.

**Mine:** the project's scoping and sequencing decisions, the design-
direction choices below, all instructor communication, privileged operations
on the machine, and the final say on what entered the report. I reviewed the
drafted sections and was quizzed on their claims until I could defend them
independently; the presentation is prepared and delivered by me.

**Neither's to decide:** every quantitative claim is produced by scripts in
`scripts/` and checked bit-exactly against the deployed model's own outputs
(EXPERIMENTS.md E1–E8) — results are machine-verified rather than taken from
either the AI's or my own reasoning.

## Decision log (my decisions, dated)

- **2026-09-15 — model scope.** Our team raised the transformer/LayerNorm
  floating-point concern with Prof. Liou's staff; following the ruling, I
  decided to use a downloaded pre-quantized model and confirmed in class
  that a non-transformer choice was acceptable.
- **2026-09-22 — model selection.** Chose ResNet-18 W8A8 (per-channel) from
  litert-community over quantizing a transformer ourselves (rationale in
  DESIGN.md §1 / report §2.2).
- **2026-09-22 — machine split.** Accepted the Mac/Linux split (midterm work
  local, RTL+synthesis on university Linux) and took on the access request.
- **2026-10-03 — ISA design direction.** After reviewing options A–D for the
  three-operand problem (including questioning the R-type register-field vs
  read-port distinction until I understood it), I chose the non-accumulating
  `xqdot8` (option D) first, deferring the accumulating variant to the RTL
  phase as a measured increment.
- **2026-10-08 — resource decisions.** Approved the disk-cache cleanup;
  deferred the Verilator/Wally environment setup in favor of midterm work.
- **2026-10-15 — scope freeze for the midterm.** Directed the order of the
  remaining work: finish the required technical items (xrq, verification
  suite, mix measurement, residual block) before any report drafting.
- **2026-10-19→ — report review.** Section-by-section review of the drafted
  report, including correcting my own initial reasoning on baseline choice
  (B1 vs B0 comparison) during the process; an unverified code-size estimate
  found during this review was replaced with measured values (commit
  4a8a20a).

## Verification of my understanding

The review process included answering challenge questions on each section
(baseline methodology, measurement validity, the three-operand design
decision) before moving on; the in-class presentation and Q&A are mine.
