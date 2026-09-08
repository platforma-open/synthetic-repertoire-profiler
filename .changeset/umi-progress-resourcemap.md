---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
---

Fix the Progress column never leaving "Queued"

The per-step log output was declared as a `Resource` with a `path`, the shape for one
resource per sample. The per-sample template returns a built resource map, so the
framework handed it over as a single opaque resource and `parseResourceMap` in the model
found nothing — the column stayed at "Queued" for the whole run and the Logs view's step
picker was empty. It is a `ResourceMap` now, matching how the per-step reports output has
always been declared.

Per-step progress also keeps entries with no data yet, so a step that has started but
printed no marker appears as itself rather than leaving the column on the previous step.
