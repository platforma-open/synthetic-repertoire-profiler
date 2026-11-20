---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.kind": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": minor
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": minor
---

New "Search both strands" option next to the tag pattern. It matches reads in either orientation, so Nanopore amplicon reads that arrive reverse-complemented are no longer dropped at parse.

The Alignments bar now shows reads that did not match the tag pattern as "No tag pattern match", so reads lost at parse are visible on the main table and in the sample report. Runs with a UMI keep the old bar.
