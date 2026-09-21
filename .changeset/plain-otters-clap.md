---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": patch
---

Drop the repeated percentage from the right of the Progress column

The step label on the left already carries the percentage when there is one.
On steps that report none the right-hand value fell back to "0%", which looked
like no progress at all. The bar still fills as before.
