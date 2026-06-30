<script setup lang="ts">
import {
  VDJ_REGION_NAMES,
  type ParentRegionConfig,
  type RegionScheme,
} from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";
import {
  PlAlert,
  PlBtnGhost,
  PlDropdown,
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

function removeRegion(parentId: string, i: number) {
  const cfg = configFor(parentId);
  setConfig({ ...cfg, regions: cfg.regions.filter((_, j) => j !== i) });
}

// Per-parent region previews (begin/end + sliced nt/aa) and a coverage warning.
function previews(p: ParsedParent) {
  const cfg = configFor(p.id);
  const offs = cumulativeOffsets(cfg.regions.map((r) => r.length));
  const rows = cfg.regions.map((r, i) => {
    const { begin, end } = offs[i];
    const nt = p.sequence.slice(begin, end);
    const inFrame = r.length > 0 && r.length % 3 === 0;
    return { ...r, begin, end, nt, aa: inFrame ? translateDNA(nt) : "", inFrame };
  });
  const total = offs.length > 0 ? offs[offs.length - 1].end : 0;
  return { rows, total, overflow: total > p.sequence.length };
}
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

      <div v-for="(row, i) in previews(p).rows" :key="i" class="region-row">
        <div class="region-row__controls">
          <PlTextField
            v-if="configFor(p.id).scheme === 'custom'"
            class="region-row__grow"
            :model-value="row.name"
            label="Region"
            placeholder="name"
            @update:model-value="(v) => setRegion(p.id, i, { name: v })"
          />
          <PlTextField
            v-else
            class="region-row__grow"
            :model-value="row.name"
            label="Region"
            disabled
          />

          <PlNumberField
            class="region-row__grow"
            :model-value="row.length"
            label="Length (nt)"
            :min-value="0"
            @update:model-value="(v) => setRegion(p.id, i, { length: v ?? 0 })"
          />

          <PlBtnGhost
            v-if="configFor(p.id).scheme === 'custom'"
            @click.prevent="removeRegion(p.id, i)"
          >
            Remove
          </PlBtnGhost>
        </div>

        <div class="region-row__preview">
          <span class="region-row__span">{{ row.begin }}–{{ row.end }}</span>
          <span
            class="region-row__aa"
            :class="{ 'region-row__aa--off': row.length > 0 && !row.inFrame }"
          >
            {{ row.inFrame ? row.aa : "not ×3" }}
          </span>
        </div>
      </div>

      <PlBtnGhost v-if="configFor(p.id).scheme === 'custom'" @click.prevent="addRegion(p.id)">
        + Add region
      </PlBtnGhost>

      <PlAlert v-if="previews(p).overflow" type="warn" :icon="true">
        Regions span {{ previews(p).total }} nt — longer than the parent ({{ p.sequence.length }}
        nt).
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
.region-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.region-row__controls {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.region-row__grow {
  flex: 1 1 0;
  min-width: 0;
}
.region-row__preview {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.region-row__span {
  color: var(--txt-03);
  font-size: 12px;
  white-space: nowrap;
}
.region-row__aa {
  flex: 1 1 0;
  min-width: 0;
  font-family: monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
  word-break: break-all;
}
.region-row__aa--off {
  color: var(--txt-warning, #b26a00);
}
</style>
