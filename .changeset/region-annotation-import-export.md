---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.kind": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.model": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.ui": patch
---

Import and export the region annotation as a JSON file

The Region annotation section now has a file input and an export button. Export
writes the whole annotation — every configured parent, its scheme, its regions
and their sub-regions — to `region-annotation.json`. Import reads such a file
back and replaces the annotation with it.

The file is the same list the kind already carries as the `parentRegions`
init-param, and it is read by the same parser, so an annotation exported here
can be pasted straight into a block template.

A file with two entries for the same parent is now refused, by the import and by a
block template alike. Before, the editor showed the first entry and the run used the
last, with nothing saying they differed.

The editor also warns when a configured parent id matches no sequence in the
current parent FASTA. Those regions still reach the run, but no editor row shows
them — which happens after importing an annotation written for different parent
ids, or after replacing the FASTA under an annotation already in place.
