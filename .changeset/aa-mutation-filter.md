---
"@platforma-open/milaboratories.synthetic-repertoire-profiler": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.vdj-region-tools": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": patch
---

Add an amino-acid mutation-load filter (count + fraction), mirroring the existing
nucleotide filter. Feeds mitool's call-mutations step via
`-Mcall-mutations.maxAaMutations` / `-Mcall-mutations.maxAaMutationFraction`;
drops in-frame variants whose translated sequence diverges from the parent by more
than the configured amino-acid edit count / fraction. Empty = off (default).
