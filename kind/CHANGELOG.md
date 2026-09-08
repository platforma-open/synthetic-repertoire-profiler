# @platforma-open/milaboratories.synthetic-repertoire-profiler.kind

## 1.0.3

### Patch Changes

- 63078d4: Support UMI (molecular barcode) libraries

  A tag pattern carrying a UMI used to be refused outright. It now drives a molecule-level
  analysis: between `parse` and `repertoire analyze` the workflow runs mitool's
  `refine-tags` → `sort` → `consensus`, so each molecule contributes one consensus read
  instead of every PCR duplicate contributing its own.

  Abundance is then reported in molecules. `uniqueMoleculeCount` and its fraction land per
  sample and per variant at both the nucleotide and amino-acid level, with cross-sample
  totals, a known-set equivalent, and a molecule-weighted QC table led by reads-per-molecule.
  On such a run molecules are the primary, anchored abundance and read counts become
  secondary. A run without a UMI is unchanged throughout — no molecule column is emitted at
  all.

  Two settings appear under the pattern that creates the need for them, both required once a
  UMI is declared: reads a molecule needs before it yields a consensus, and the quality below
  which a barcode is discarded. A pattern the run gate would refuse now reports its reason on
  the pattern field itself, so a mistyped pattern shows up before a run rather than during
  one. Two UMI halves stay two grouping keys — the pair identifies the molecule, without
  being concatenated.

  The Progress column now names the pre-processing step a sample is in rather than sitting at
  "Queued" until the last command. The sample panel's Logs view carries one log per command,
  picked by step, so a failure in barcode correction or consensus has something to read. It
  replaces the separate Reports tab: a step's report text was already printed into its log,
  so the two tabs showed the same numbers under overlapping step lists.

  Requires mitool 2.3.1-155-main, which fills the per-variant molecule count.

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
