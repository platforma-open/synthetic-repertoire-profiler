---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
---

Surface the molecule consensus settings and echo the declared UMI

A tag pattern carrying a UMI now reveals its two settings, Min reads per UMI and Min
UMI quality, directly under the pattern in the Barcodes section rather than in Advanced
— they are required, and a required field behind an Advanced accordion is a field a user
cannot find. Each tooltip names the report field its effect shows up in.

Below the pattern the panel reads the declared UMI back in the terms the chain uses, for
example "UMI: 6 nt on Read 1 (UMI) + 6 nt on Read 2 (UMI2), used together as the
molecule key (12 nt in total)". A ranged capture reports its range and says so instead
of quietly showing its minimum, which is the number the chain would never use.

The pattern tooltip now describes what a UMI capture actually does — correction,
collapsing to one consensus read per molecule, abundance in molecules — and states the
two constraints: a fixed length per capture, and at least 8 nt in total.

The required-settings error message points at Barcodes to match.
