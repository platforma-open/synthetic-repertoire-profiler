---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': minor
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': minor
---

Residue Composition: pick the parent with graph-maker tabs instead of a custom dropdown

The page used its own `PlDropdown` in the chart's settings slot and preset a parent
filter from it. The parent axis now also goes into the chart's "Tab by" basket, so
graph-maker draws the tab bar, picks the first parent itself and persists the choice
in the saved graph state. The dropdown and the parent enumeration behind it are gone.

The axis stays in "X group" as well. The region band and the parent-residue track are
keyed on `[parentId, position]`, and graph-maker only offers an X annotation when
every axis of it maps to X or X group — moving the parent out would report both
tracks inconsistent and blank the chart.

A `v9` data migration resets `graphStateStateHeatmap`. A saved state keeps whatever
sits in a basket the new defaults no longer name, so an old project would carry a
parent filter that fights the new tab.
