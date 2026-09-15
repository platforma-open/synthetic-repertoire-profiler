---
'@platforma-open/milaboratories.synthetic-repertoire-profiler.block': minor
---

Add a "Export state matrix" setting, and stop re-running mitool on every run.

**New setting — Export state matrix (Advanced Settings, on by default).** The state matrix
records which residue each variant carries at every position of the parent sequence. It holds one
entry per variant per position, so it grows with library size and can dominate a run on a very
large repertoire. Turning it off skips the per-sample chunking, the cross-sample dedup and the
exported state columns, and hides the Residue Composition page that reads it. Existing projects
migrate with the setting on, so their behaviour is unchanged.

**Deduplication.** `mitool parse` and `mitool repertoire analyze` re-ran on every run, including
runs with no settings change, because neither the exec results nor the per-sample iterations were
retained. Both now carry an explicit cache, so an unchanged rerun recovers instead of recomputing.

**Workflow structure.** `parse`, the UMI chain and everything after parse are now separate
subtemplates, each memoized on the values it actually reads. Changing an analyze or export setting
no longer re-parses every sample. Per-process CPU and RAM ride as meta inputs, so changing them no
longer invalidates cached results.

**State matrix sizing.** The state-matrix chunking moved into its own ptabler workflow, separate
from the per-sample abundance, histogram and QC tables, so the dense matrix no longer sets the
resource budget for all of them.

**mitool 2.3.1-169-main**, and `repertoire analyze` now runs with `--threads` bound to the granted
CPU quota rather than the host's processor count.
