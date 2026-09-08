---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
---

Give the Progress column room, and drop the outputs it no longer reads

The step label is longer than the bare stage name it replaced
(`[2/5] Correcting UMI: 40.0%` against `Aligning: 55.0%`), and the column had no width
floor, so it clipped. It now has a `minWidth`; the Alignments chart beside it keeps the
flexible space, since that is what benefits from it.

Two outputs went dead when the column moved to the per-step map, and both are removed.
The `progress` output scraped the analyze log alone — which is exactly the behaviour that
left a UMI sample at "Queued" for three commands. The `logs` output carried the analyze
stream, which `stepLogs` now publishes as its `5-analyze` entry, so the workflow was
emitting the same stream twice per sample and nothing was reading one of them.
