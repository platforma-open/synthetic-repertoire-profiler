---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.kind': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
---

Add the UMI consensus settings to the init-params contract and the model

A tag pattern carrying a UMI now has two settings behind it: `minReadsPerConsensus`
(reads needed before a molecule yields a consensus) and `minUmiQuality` (barcodes below
this Phred are discarded unless corrected). Both are part of the kind's init-params
contract, so a template can pin them, and both are required once the pattern declares a
UMI — neither has a safe implicit default, and each trades molecules kept against
confidence in the ones kept. Existing projects are migrated to the defaults (2 and 20).

The pattern parser gains `patternUmiSpec`, which reports the per-half UMI tag names, the
combined barcode length, and whether a half declares a length range. Two new rejections
follow from it: a ranged UMI (`N{4:8}`), which cannot identify a molecule, and a combined
barcode under 8 nt, which is too small for barcode correction to distinguish an error
from a real neighbour.

`mitool refine-tags --max-indels` is deliberately not exposed. mitool already clamps the
indel budget per barcode from its read count, so at `minUmiQuality` 20 a second indel is
only searched above ~450 reads per barcode — a no-op across this block's depth regime.
Its default stays mitool's.

The UMI chain itself is not wired yet; a UMI pattern is still refused by the workflow.
