---
"@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow": patch
"@platforma-open/milaboratories.synthetic-repertoire-profiler.block": patch
---

Export which regions each parent subdivides

A region partition may split a region one level deep, so a span named for a canonical
region (CDR2, say) can be a container holding an insert plus its flanks. Nothing downstream
could tell that apart from an ordinary CDR2, and a consumer whose behaviour depends on
region identity — the sequence liabilities scan, whose conserved-cysteine rules assume a
canonical immunoglobulin region — would read a graft as the region its name claims.

Adds `pl7.app/repertoire/subdividedRegions`, keyed `[parentId]`: a comma-separated list of
that parent's regions that hold sub-regions. Rows exist only for parents that subdivide
something, and the column is emitted only when at least one parent does — so a run without
sub-regions is unchanged, and the column's mere presence answers "does this dataset hold
non-canonical regions" from the spec alone, with no data read.

Keyed per parent rather than per variant because the fact is a property of the reference,
not of any one variant: two scaffolds in the same run can put their insert in different
regions, and a run-wide flag could not distinguish them. A consumer resolves it per variant
through the existing parent to variant linker (`pl7.app/repertoire/parentLink`).

The column carries the run scope in its domain, unlike the other parent-keyed columns. Those
are reached by walking the exported frame; this one is meant to be discovered from the result
pool, and the parent axis deliberately carries no domain, so without the run scope two
profiler runs in one project would be indistinguishable.

The list names containers, not the sub-regions inside them — that is what identifies the
region holding the insert. The insert's own sequence needs nothing new: every sub-region is
already an ordinary span downstream with a sequence column of its own.
