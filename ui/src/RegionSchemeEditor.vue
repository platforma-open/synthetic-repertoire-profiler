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
import { computed } from "vue";
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

// PlElementList emits the whole new array for both reorder and remove, so one
// handler covers both. Only name/length are persisted; begin/end and the aa
// preview are recomputed from the new order on the next render.
function applyRows(parentId: string, rows: (RegionDef & { id: number })[]) {
  rowIds.set(
    parentId,
    rows.map((r) => r.id),
  );
  const cfg = configFor(parentId);
  setConfig({ ...cfg, regions: rows.map((r) => ({ name: r.name, length: r.length })) });
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

// Per-parent region previews (begin/end + sliced nt/aa) and the warnings.
function previews(p: ParsedParent) {
  const cfg = configFor(p.id);
  const offs = cumulativeOffsets(cfg.regions.map((r) => r.length));
  const ids = idsFor(p.id, cfg.regions.length);
  const rows = cfg.regions.map((r, i) => {
    const { begin, end } = offs[i];
    const nt = p.sequence.slice(begin, end);
    // The rule the workflow applies when it decides which aaSeq{region} columns exist
    // (workflow/src/region-config.lib.tengo). BOTH ends must sit on a codon boundary,
    // so a region whose length is not a multiple of 3 pushes every later region out
    // of frame as well — not only itself.
    const inFrame = r.length > 0 && begin % 3 === 0 && end % 3 === 0;
    return { ...r, id: ids[i], begin, end, nt, aa: inFrame ? translateDNA(nt) : "", inFrame };
  });
  const total = offs.length > 0 ? offs[offs.length - 1].end : 0;
  const outOfFrame = rows
    .filter((r) => r.length > 0 && !r.inFrame)
    .map((r) => r.name || "(unnamed)");
  return { rows, total, overflow: total > p.sequence.length, outOfFrame };
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
</style>
