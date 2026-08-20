---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.kind': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.model': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': patch
'@platforma-open/milaboratories.synthetic-repertoire-profiler.ui': patch
---

Add the mandatory kind component and upgrade the SDK

block-tools 2.14 makes a `kind/` package a mandatory fourth block component
alongside model, workflow and ui. The kind carries the block's identity and its
init-params contract — what a creator or a project template supplies to seed a
new instance.

This block's contract is the run recipe: the tag pattern, the parent (reference)
setup and its region schemes, the export toggles, the mutation and quality gates,
and the per-process resource overrides. Uploaded files, the known-set column
mappings derived from them, and view state stay out of it.

The model now declares its kind (`new DataModelBuilder({ kind })`,
`BlockModelV3.create({ dataModel, kind })`), consumes the contract in `init`, and
projects the same fields back out through the newly mandatory
`.templateParams(...)`.

Catalog bump: model / ui-vue 1.81 -> 1.82, test 1.82.4, block-tools 2.14.3,
tengo-builder 4.0.23, package-builder 3.15.0, ts-builder 1.7.0. CI moves to
node 22.x.
