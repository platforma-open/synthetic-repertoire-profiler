---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
---

Fix the Mutation Distribution and Residue Composition plots failing to render in projects created by an earlier version of the block.

Such projects are stamped at data version v12, but their saved data never got the `graphStateMutationHistogram`, `graphStateStateHeatmap` and `knownVariantsNtTableState` fields. Those fields were added to the model's `.init()` after the project was created, and no migration backfilled them, so a project already at v12 ran no migration and kept the fields missing. GraphMaker then received an undefined state and threw.

A v13 migration backfills the three fields, keeping any values a project already has. Both GraphMaker pages also fall back to the default state, so they can never be handed an undefined value again.
