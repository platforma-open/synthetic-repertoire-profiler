<script setup lang="ts">
import {
  VDJ_REGION_NAMES,
  type ParentRegionConfig,
  type RegionDef,
  type RegionScheme,
} from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";
import {
  PlAlert,
  PlBtnGhost,
  PlDropdown,
  PlElementList,
  PlNumberField,
  PlTextField,
  ReactiveFileContent,
} from "@platforma-sdk/ui-vue";
import { computed, ref } from "vue";
import { useApp } from "./app";
import {
  cumulativeOffsets,
  parseParentFasta,
  translateDNA,
  type ParsedParent,
} from "./regionScheme";

const app = useApp();
const reactiveFileContent = ReactiveFileContent.useGlobal();

const schemeOptions = [
  { label: "None", value: "none" as const },
  { label: "VDJ", value: "vdj" as const },
  { label: "Custom regions", value: "custom" as const },
];

// Parent ids + sequences from the FASTA the user supplied (pasted directly, or
// read from the uploaded file's bytes once the prerun delivers them).
const parents = computed<ParsedParent[]>(() => {
  if (app.model.data.parentInputMode === "fastaSequence")
    return parseParentFasta(app.model.data.parentSequence);
  const h = app.model.outputs.parentFileContent;
  const bytes = h ? reactiveFileContent.getContentBytes(h.handle).value : undefined;
  return bytes ? parseParentFasta(new TextDecoder().decode(bytes)) : [];
});

function configFor(parentId: string): ParentRegionConfig {
  return (
    app.model.data.parentRegions?.find((c) => c.parentId === parentId) ?? {
      parentId,
      scheme: "none",
      regions: [],
    }
  );
}

// Persist an updated config, dropping entries that carry nothing (scheme none and
// no complete feature name) so a cleared parent leaves no trace in args.
function setConfig(cfg: ParentRegionConfig) {
  const rest = (app.model.data.parentRegions ?? []).filter((c) => c.parentId !== cfg.parentId);
  const empty = cfg.scheme === "none" && !cfg.completeFeatureName?.trim();
  app.model.data.parentRegions = empty ? rest : [...rest, cfg];
}

function onScheme(parentId: string, scheme: RegionScheme) {
  const cur = configFor(parentId);
  // Switching scheme resets the full sequence name: VDJ gets its conventional
  // default, custom/none start blank so a previous scheme's value doesn't leak.
  if (scheme === "vdj") {
    const byName = new Map(cur.regions.map((r) => [r.name, r.length]));
    setConfig({
      parentId,
      scheme,
      completeFeatureName: "VDJRegion",
      regions: VDJ_REGION_NAMES.map((name) => ({ name, length: byName.get(name) ?? 0 })),
    });
  } else if (scheme === "custom") {
    // Keep regions only when coming from a previous custom layout; switching from
    // VDJ must start fresh so the fixed VDJ regions don't leak into custom mode.
    const keep = cur.scheme === "custom" && cur.regions.length > 0;
    setConfig({
      parentId,
      scheme,
      completeFeatureName: undefined,
      regions: keep ? cur.regions : [{ name: "", length: 0 }],
    });
  } else {
    setConfig({ parentId, scheme: "none", completeFeatureName: undefined, regions: [] });
  }
}

function setCompleteFeatureName(parentId: string, name: string) {
  setConfig({ ...configFor(parentId), completeFeatureName: name });
}

function setRegion(parentId: string, i: number, patch: Partial<{ name: string; length: number }>) {
  const cfg = configFor(parentId);
  const regions = cfg.regions.map((r, j) => (j === i ? { ...r, ...patch } : r));
  setConfig({ ...cfg, regions });
}

function addRegion(parentId: string) {
  const cfg = configFor(parentId);
  setConfig({ ...cfg, regions: [...cfg.regions, { name: "", length: 0 }] });
}

function setChild(
  parentId: string,
  i: number,
  j: number,
  patch: Partial<{ name: string; length: number }>,
) {
  const cfg = configFor(parentId);
  const regions = cfg.regions.map((r, k) =>
    k === i
      ? { ...r, children: (r.children ?? []).map((c, m) => (m === j ? { ...c, ...patch } : c)) }
      : r,
  );
  setConfig({ ...cfg, regions });
}

// Splits a region's length into flank / graft / flank. The flanks are kept on codon
// boundaries and the graft absorbs the remainder, so a region of nine nt or more that is
// codon-aligned stays fully codon-aligned after subdividing and all three parts keep their
// amino-acid columns. Below nine there is no room for a codon in each flank, so the flanks
// fall back to one nt and the graft takes the rest — valid, but the out-of-frame warning
// will say the parts carry no amino-acid columns until the lengths are adjusted.
function splitThree(len: number): [number, number, number] {
  // Lengths are not typed yet on a freshly picked scheme — every region starts at 0.
  // Give the graft the whole (empty) span rather than refuse: the row is created, tiling
  // holds at 0 = 0, and the user fills the numbers in the same pass as everything else.
  if (len < 3) return [0, len, 0];
  const flank = Math.max(1, Math.floor(Math.floor(len / 3) / 3) * 3);
  if (2 * flank + 1 > len) return [1, len - 2, 1];
  return [flank, len - 2 * flank, flank];
}

// Seeds the three rows a graft needs, so the tiling invariant holds the moment the region
// is subdivided rather than after the user gets the arithmetic right. The flanks are named
// by protein directionality — the sequence runs N-terminus to C-terminus — and the graft
// row is left blank because only the user knows what it is. All three stay editable.
function subdivide(parentId: string, i: number, rowId: number) {
  const cfg = configFor(parentId);
  const r = cfg.regions[i];
  const base = r.name.trim();
  const [n, graft, c] = splitThree(r.length);
  const children: RegionDef[] = [
    { name: `${base}_N`, length: n },
    { name: "", length: graft },
    { name: `${base}_C`, length: c },
  ];
  setConfig({ ...cfg, regions: cfg.regions.map((x, k) => (k === i ? { ...x, children } : x)) });
  expanded.value = new Set([...expanded.value, rowId]); // show what was just created
}

// A region can hold more parts than the three a single graft needs — two grafts inside one
// region make five. The new row is seeded at length 0, which leaves the children's total
// unchanged and so keeps the region tiled; the user redistributes the lengths from there.
// It is left unnamed because only the first graft's flanks have names the editor can guess:
// _N and _C describe two ends, and a third part sits at neither.
function addChild(parentId: string, i: number) {
  const cfg = configFor(parentId);
  const regions = cfg.regions.map((r, k) =>
    k === i ? { ...r, children: [...(r.children ?? []), { name: "", length: 0 }] } : r,
  );
  setConfig({ ...cfg, regions });
}

// PlElementList emits the whole new array for reorder and remove alike, at either level.
// Dropping to an empty child list returns the region to undivided rather than leaving an
// empty `children`, which the overlay would carry as a subdivided region with nothing in it.
function applyChildRows(
  parentId: string,
  i: number,
  regionRowId: number,
  rows: (RegionDef & { id: number })[],
) {
  rowIds.set(
    `${parentId}#${regionRowId}`,
    rows.map((r) => r.id),
  );
  const cfg = configFor(parentId);
  const children = rows.map((r) => ({ name: r.name, length: r.length }));
  const regions = cfg.regions.map((r, k) =>
    k === i ? { ...r, children: children.length > 0 ? children : undefined } : r,
  );
  setConfig({ ...cfg, regions });
}

// Which region rows are open, by stable row id. View-local: it is not the user's
// configuration, so it stays out of `data`. Rows start closed so a seven-region VDJ list
// reads at a glance; opening one shows its sub-regions, or the way to create them.
const expanded = ref(new Set<number>());
function toggleExpanded(rowId: number) {
  const next = new Set(expanded.value);
  if (!next.delete(rowId)) next.add(rowId);
  expanded.value = next;
}

// PlElementList emits the whole new array for both reorder and remove, so one
// handler covers both. Only name/length are persisted; begin/end and the aa
// preview are recomputed from the new order on the next render.
function applyRows(parentId: string, rows: (RegionDef & { id: number })[]) {
  rowIds.set(
    parentId,
    rows.map((r) => r.id),
  );
  const cfg = configFor(parentId);
  // Carry `children` through: the rows here are previews built by spreading the region,
  // so a reorder or a remove must not quietly flatten the sub-regions of the rows that
  // survive it.
  setConfig({
    ...cfg,
    regions: rows.map((r) => ({
      name: r.name,
      length: r.length,
      ...(r.children && r.children.length > 0 ? { children: r.children } : {}),
    })),
  });
}

// Stable identity for the list rows. A region carries no id — RegionDef is part
// of the kind's init-params contract — and two structurally equal rows collide
// under the component's default JSON.stringify key. Positions are worse still:
// PlElementList compares item keys before and after a drag to decide whether to
// resync its DOM against the data, and keys that ARE positions can never differ,
// so a dragged row snaps back or jumps to the end. A key derived from the name is
// out too — it would change on every keystroke and remount the input mid-edit.
//
// The ids stay here and never reach `data`: they are not the user's configuration.
// A plain Map rather than a ref, so building the previews cannot trigger a render.
const rowIds = new Map<string, number[]>();
let nextRowId = 0;

/** One parent's row ids, grown or trimmed to the current region count. */
function idsFor(parentId: string, count: number): number[] {
  let ids = rowIds.get(parentId) ?? [];
  if (ids.length !== count) {
    ids = ids.slice(0, count);
    while (ids.length < count) ids.push(nextRowId++);
    rowIds.set(parentId, ids);
  }
  return ids;
}

const rowKey = (row: { id: number }) => row.id;

// Reseed the VDJ scheme with the conventional FR1-FR4 partition. Same path as
// picking the scheme in the dropdown, so a length already typed for a surviving
// name carries over and a renamed region loses its length.
function resetToVdjRegions(parentId: string) {
  onScheme(parentId, "vdj");
}

// Slices a span out of the parent and works out whether it can carry an amino-acid
// column. The rule is the workflow's (workflow/src/region-config.lib.tengo): BOTH ends
// must sit on a codon boundary, so a length that is not a multiple of three pushes every
// later span out of frame too, not only its own.
function spanPreview(p: ParsedParent, r: RegionDef, begin: number, end: number, id: number) {
  const nt = p.sequence.slice(begin, end);
  const inFrame = r.length > 0 && begin % 3 === 0 && end % 3 === 0;
  return { ...r, id, begin, end, nt, aa: inFrame ? translateDNA(nt) : "", inFrame };
}

// Per-parent region previews (begin/end + sliced nt/aa) and the warnings. Recurses one
// level: a region's sub-regions are laid out by the same cumulative rule, seeded at the
// region's own begin, which is exactly what buildParentRegionsJson does on the model side.
function previews(p: ParsedParent) {
  const cfg = configFor(p.id);
  const offs = cumulativeOffsets(cfg.regions.map((r) => r.length));
  const ids = idsFor(p.id, cfg.regions.length);
  const rows = cfg.regions.map((r, i) => {
    const { begin, end } = offs[i];
    const row = spanPreview(p, r, begin, end, ids[i]);
    const kids = r.children ?? [];
    const childOffs = cumulativeOffsets(
      kids.map((c) => c.length),
      begin,
    );
    const childIds = idsFor(`${p.id}#${ids[i]}`, kids.length);
    const childRows = kids.map((c, j) =>
      spanPreview(p, c, childOffs[j].begin, childOffs[j].end, childIds[j]),
    );
    // Tiling is exactly what the model checks: the children's lengths must add up to
    // their region's own. Surfacing the shortfall here means the number is visible while
    // it is being typed, not only when the run is assembled.
    const childEnd = childOffs.length > 0 ? childOffs[childOffs.length - 1].end : begin;
    const childGap = childRows.length > 0 ? childEnd - end : 0;
    return { ...row, childRows, childGap };
  });
  const allRows = rows.flatMap((r) => [r, ...r.childRows]);
  const total = offs.length > 0 ? offs[offs.length - 1].end : 0;
  const outOfFrame = allRows
    .filter((r) => r.length > 0 && !r.inFrame)
    .map((r) => r.name || "(unnamed)");
  const untiled = rows
    .filter((r) => r.childGap !== 0)
    .map((r) => `${r.name || "(unnamed)"} (${r.childGap > 0 ? "+" : ""}${r.childGap} nt)`);
  return { rows, total, overflow: total > p.sequence.length, outOfFrame, untiled };
}

// previews() slices and translates sequences, and the template reads it four
// times per parent — compute it once per render pass instead.
const previewByParent = computed(() => {
  const byId: Record<string, ReturnType<typeof previews>> = {};
  for (const p of parents.value) byId[p.id] = previews(p);
  return byId;
});
</script>

<template>
  <div v-if="parents.length === 0" class="region-hint">
    Supply parent sequences above to define regions.
  </div>

  <div v-for="p in parents" :key="p.id" class="region-parent">
    <div class="region-parent__head">
      <span class="region-parent__id">{{ p.id }}</span>
      <span class="region-parent__len">{{ p.sequence.length }} nt</span>
    </div>

    <PlDropdown
      :model-value="configFor(p.id).scheme"
      :options="schemeOptions"
      label="Scheme"
      @update:model-value="(v) => onScheme(p.id, v as RegionScheme)"
    />

    <template v-if="configFor(p.id).scheme !== 'none'">
      <PlTextField
        :model-value="configFor(p.id).completeFeatureName ?? ''"
        label="Full sequence name (optional)"
        placeholder="e.g. VDJRegion"
        @update:model-value="(v) => setCompleteFeatureName(p.id, v)"
      >
        <template #tooltip>
          Names the whole assembled variant sequence (the full span), as opposed to the named
          sub-regions below. Shown as the sequence column label, e.g. VDJRegion for an antibody.
        </template>
      </PlTextField>

      <PlElementList
        :items="previewByParent[p.id].rows"
        :get-item-key="rowKey"
        :is-expanded="(row) => expanded.has(row.id)"
        :on-expand="(row) => toggleExpanded(row.id)"
        item-class-content="region-subs"
        @update:items="(rows) => applyRows(p.id, rows)"
      >
        <template #item-title="{ item: row, index: i }">
          <div class="region-row">
            <div class="region-row__controls">
              <PlTextField
                class="region-row__name"
                :model-value="row.name"
                placeholder="name"
                @update:model-value="(v) => setRegion(p.id, i, { name: v })"
              />

              <PlNumberField
                class="region-row__len"
                :model-value="row.length"
                placeholder="length"
                :min-value="0"
                @update:model-value="(v) => setRegion(p.id, i, { length: v ?? 0 })"
              />

              <span class="region-row__span">{{ row.begin }}–{{ row.end }}</span>
            </div>

            <span
              class="region-row__aa"
              :class="{ 'region-row__aa--off': row.length > 0 && !row.inFrame }"
            >
              {{ row.inFrame ? row.aa : "out of frame" }}
            </span>
          </div>
        </template>

        <template #item-content="{ item: row, index: i }">
          <!-- Sub-regions. Dragging is confined to this list, and to the parent list
               above: a row never moves between levels, because a graft belongs to the
               region it was cut out of. -->
          <PlElementList
            v-if="row.childRows.length > 0"
            :items="row.childRows"
            :get-item-key="rowKey"
            @update:items="(rows) => applyChildRows(p.id, i, row.id, rows)"
          >
            <template #item-title="{ item: child, index: j }">
              <div class="region-row">
                <div class="region-row__controls">
                  <PlTextField
                    class="region-row__name"
                    :model-value="child.name"
                    placeholder="sub-region name"
                    @update:model-value="(v) => setChild(p.id, i, j, { name: v })"
                  />

                  <PlNumberField
                    class="region-row__len"
                    :model-value="child.length"
                    placeholder="length"
                    :min-value="0"
                    @update:model-value="(v) => setChild(p.id, i, j, { length: v ?? 0 })"
                  />

                  <span class="region-row__span">{{ child.begin }}–{{ child.end }}</span>
                </div>

                <span
                  class="region-row__aa"
                  :class="{ 'region-row__aa--off': child.length > 0 && !child.inFrame }"
                >
                  {{ child.inFrame ? child.aa : "out of frame" }}
                </span>
              </div>
            </template>
          </PlElementList>

          <div v-if="row.childGap !== 0" class="region-row__gap">
            Sub-regions must add up to {{ row.length }} nt — they are
            {{ row.childGap > 0 ? "over" : "under" }} by {{ Math.abs(row.childGap) }} nt.
          </div>

          <PlBtnGhost v-if="row.childRows.length > 0" @click.prevent="addChild(p.id, i)">
            + Add sub-region
          </PlBtnGhost>

          <PlBtnGhost v-if="row.childRows.length === 0" @click.prevent="subdivide(p.id, i, row.id)">
            Divide Into Sub-regions
          </PlBtnGhost>
        </template>
      </PlElementList>

      <div class="region-actions">
        <PlBtnGhost @click.prevent="addRegion(p.id)"> + Add region </PlBtnGhost>
        <PlBtnGhost
          v-if="configFor(p.id).scheme === 'vdj'"
          @click.prevent="resetToVdjRegions(p.id)"
        >
          Reset to FR1–FR4
        </PlBtnGhost>
      </div>

      <PlAlert v-if="previewByParent[p.id].overflow" type="warn" :icon="true">
        Regions span {{ previewByParent[p.id].total }} nt — longer than the parent ({{
          p.sequence.length
        }}
        nt).
      </PlAlert>

      <PlAlert v-if="previewByParent[p.id].untiled.length > 0" type="warn" :icon="true">
        Sub-regions do not tile their region: {{ previewByParent[p.id].untiled.join(", ") }}. They
        must add up to exactly the region's own length.
      </PlAlert>

      <PlAlert v-if="previewByParent[p.id].outOfFrame.length > 0" type="warn" :icon="true">
        No amino-acid columns for {{ previewByParent[p.id].outOfFrame.join(", ") }}. A region is
        translated only when it starts and ends on a codon boundary, so a length that is not a
        multiple of 3 also shifts every region after it out of frame.
      </PlAlert>
    </template>
  </div>
</template>

<style scoped>
.region-hint {
  color: var(--txt-03);
  font-size: 12px;
}
.region-parent {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px 0;
  border-top: 1px solid var(--border-color-div-grey, #e0e0e0);
}
.region-parent__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.region-parent__id {
  font-weight: 600;
}
.region-parent__len {
  color: var(--txt-03);
  font-size: 12px;
}
.region-actions {
  display: flex;
  gap: 8px;
}
.region-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  /* The item's remove button is absolutely positioned over the right edge of the
     head, so reserve a gutter for it rather than let it sit on the stepper. */
  padding-right: 28px;
}
.region-row__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* Fields carry no label: the pair reads as name + length, and a floating label on
   every row is what made the list tall (and got clipped by the item's overflow). */
.region-row__name {
  flex: 1 1 0;
  min-width: 0;
}
.region-row__len {
  flex: 0 0 112px;
}
.region-row__span {
  color: var(--txt-03);
  font-size: 12px;
  white-space: nowrap;
}
.region-row__aa {
  font-family: monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
  word-break: break-all;
}
.region-row__aa--off {
  color: var(--txt-warning, #b26a00);
}
.region-row__gap {
  color: var(--txt-warning, #b26a00);
  font-size: 12px;
}
/* The list item's own body is padded for arbitrary content (24px all round, 12px gap).
   Here it holds one button, or a compact sub-region list that already sits under a
   region row — so it is tightened via the component's own `itemClassContent` hook
   rather than by overriding its styles. */
:deep(.region-subs) {
  padding: 4px 12px 12px;
  gap: 8px;
}
</style>
