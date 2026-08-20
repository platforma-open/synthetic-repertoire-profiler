---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.workflow': patch
---

Chunk the cross-sample state-matrix dedup by position, to bound its peak memory

The state matrix is dense: mitool writes one row per (variant, parent position),
unmutated positions included. So `aggregate-state-matrix` was deduping
`distinctVariants x parentLength` rows in one job, and a dedup hash table is
Theta(distinct rows) whatever operator is used. Polars does not spill it — ptabler's
`--spill-dir` reaches `pframe_source` and the duckdb sort in `write_frame`, not
`collect_all`. Measured on polars 1.33.1 (the version ptabler ships): ~200 bytes of
peak RSS per distinct row. A 127-aa parent with 12M distinct aa variants is ~1.5G
rows and ~305 GB, far past the 64 GiB ceiling pt's auto-sizing can request.

`position` is part of the dedup key, so any partition of the position axis splits the
work into independent jobs with an identical result: two rows that are duplicates of
each other share a position, so they always land in the same chunk. Each per-sample
job now writes its state matrix as 16 disjoint slices, and the cross-sample dedup runs
once per slice — peak RAM drops by 16x.

The chunk key is a hex prefix of `sha256(position)`, NOT an arithmetic function of the
label. `position` is deliberately a String axis (column-specs positionAxisSpec, "String
value (v2 IMGT-readiness)"), so nothing may assume the label parses as a number — IMGT
labels like `111A` or `112.1` are the point of the String type. A derived index is the
other option, but it would have to be computed identically in every per-sample job; a
per-sample dense-rank is not, because a sample missing a position shifts every rank
after it, which would split duplicate rows across chunks and silently stop the dedup
from deduping. A hash of the label is stateless and cannot drift between jobs.

The last chunk takes the complement of all the others rather than a 16th equality, so
the partition is total and disjoint by construction — independent of what the hash
encoding actually emits. In the worst case (a constant hash) every row lands in one
chunk: still correct, just no memory benefit. Enumerating 16 equalities instead would
send any unmatched row to no chunk at all.

The split is done in the per-sample job, not in the aggregate. Doing it in the
aggregate would make each of the 16 jobs re-scan every sample's full state matrix,
because mitool writes variant-major and `position` therefore has no locality that
row-group pruning could exploit. Splitting per sample costs one extra pass over
per-sample data (polars shares the scan across the 16 sinks) and leaves total I/O
unchanged.

The chunks are disjoint and already deduped, so `merge-state-matrix` recombines them
with a plain streaming concat. Row order does not matter: `xsv.importFile` sorts by
axes when it builds the PColumn.

Also replaces `groupBy().agg(first())` + `sort()` with `unique({ keep: "any" })`.
ptabler hardcodes `maintain_order: true` on groupBy, and an ordered group-by cannot
run incrementally under the streaming engine. `keep: "any"` is exact here — the state
matrix is a pure function of the variant, so every duplicate row carries an identical
state.

Per-sample outputs `aaStateMatrixTsv` / `ntStateMatrixTsv` are replaced by
`aaStateMatrixChunks` / `ntStateMatrixChunks` (ResourceMap keyed by chunk). The
whole-file `aaStateMatrixTsv` block output is dropped; nothing read it.

Size the state-matrix pt runs explicitly and move them to the heavy queue

The chunked dedup succeeded at ~1M variants but the MERGE step OOMed at ~2.5M on a
K8s backend — the one step whose peak should be O(row group), since it is lazy scans
into a lazy vertical concat into a sink. Two things were starving it, both inherited
from the original `inMediumQueue()` + unsized `pt.workflow()`:

- The queue caps the request. `medium` tops out near a third of host RAM (~12.7 GiB on
  a 32 GB host); `heavy` gets 2-3x that and is the exec default. "If you request more
  memory than a queue can provide, your request will be capped at the queue's limit."
- The unsized pt formula is `between(2 GiB + 4 x size, 2 GiB, 64 GiB)` with a
  `staticFallback("4GiB")`. A batch executor that cannot evaluate resource formulas
  takes the 4 GiB fallback, and a step whose inputs are futures from other execs can
  measure size 0 and land on the 2 GiB floor.

`aggregate-state-matrix`, `merge-state-matrix` and `compute-state-heatmap` now run on
the heavy queue with an explicit STATIC memory request: 48 GiB for the per-chunk dedup,
16 GiB for the merge, 32 GiB for the composition heat map.

Static rather than a formula, because `pt.workflow().mem()` cannot carry one.
Its value is handed to the separate `pt.workflow-run` template as a metaInput, so it
crosses a template boundary as JSON; an `exec.formula` is a Tengo object with an AST
behind it and arrives as a structure `resources()` rejects ("RAM amount should be a
number or string"). The SDK's own data-driven formula works only because it is built
INSIDE workflow-run, on the near side of that boundary.

Over-requesting is safe: "if you request more memory than a queue can provide, your
request will be capped at the queue's limit", so a generous request degrades to the
queue cap rather than failing to schedule.

Fix a null-position hole in the chunk partition

An empty TSV field parses as NULL, not "". `hash(null)` is null, and in three-valued
logic `null != "x"` evaluates to NULL rather than true — so a null chunk key failed the
equality branches AND the complement branch, and the row was dropped from every chunk.
The complement makes the partition total over unexpected NON-NULL values; it cannot
cover nulls, which is exactly where it looks like it should. `chunkKeyExpr` now
fillNulls to the last key, routing such rows into the catch-all branch.

Not reachable from mitool, which always writes `${i + 1}` — but the partition is now
total by construction rather than by trusting the producer.
