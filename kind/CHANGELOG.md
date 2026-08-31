# @platforma-open/milaboratories.synthetic-repertoire-profiler.kind

## 1.0.2

### Patch Changes

- 6406b12: Let the user edit the region list in the VDJ scheme

  The VDJ scheme locked the region list to FR1, CDR1, FR2, CDR2, FR3, CDR3, FR4 and allowed
  only the lengths to be edited. An engineered V-domain does not always fit that layout: a
  grafted insert sits between two canonical regions, or in place of one. Such a parent had to fall back to the custom scheme, which drops the VDJ modality
  from the whole run.

  The VDJ scheme now seeds from those seven names but lets the user add, remove and rename
  regions, the same as the custom scheme. A "Reset to FR1–FR4" button reseeds the
  conventional partition. Switching schemes still clears the list, unchanged.

  Also fixes the amino-acid preview. A region was marked in-frame from its own length alone,
  so once an earlier region shifted the frame the editor showed a translation read at the
  wrong offset. It now applies the workflow's rule — both ends on a codon boundary — and
  warns per parent which regions will have no amino-acid columns.

  Requires a mitool release carrying the matching validator change (MILAB-6853); mitool
  rejected a non-canonical VDJ region list too.

## 1.0.1

### Patch Changes

- c872b9d: Add the mandatory kind component and upgrade the SDK

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
