import { platforma } from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";
import { defineAppV3 } from "@platforma-sdk/ui-vue";
import { computed, watch } from "vue";
import KnownVariantsAaPage from "./KnownVariantsAaPage.vue";
import KnownVariantsNtPage from "./KnownVariantsNtPage.vue";
import MainPage from "./MainPage.vue";
import MutationHistogramPage from "./MutationHistogramPage.vue";
import QcReportPage from "./QcReportPage.vue";
import StateHeatmapPage from "./StateHeatmapPage.vue";

export const sdkPlugin = defineAppV3(platforma, (app) => {
  syncSubtitleLabel(app.model);

  return {
    routes: {
      "/": () => MainPage,
      "/qc": () => QcReportPage,
      "/mutation-histogram": () => MutationHistogramPage,
      "/state-heatmap": () => StateHeatmapPage,
      "/known-variants-nt": () => KnownVariantsNtPage,
      "/known-variants-aa": () => KnownVariantsAaPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;

type AppModel = ReturnType<typeof useApp>["model"];

// `.subtitle` is args-only, so the selected dataset's name is kept in data. It
// never reaches args, so following the pool here cannot stale the block.
function syncSubtitleLabel(model: AppModel) {
  // "" when no dataset is picked; undefined while the picked dataset is not among
  // the options yet.
  const subtitleLabel = computed<string | undefined>(() => {
    const ref = model.data.input;
    if (!ref) return "";
    return model.outputs.inputOptions?.find(
      (o) => o.ref.blockId === ref.blockId && o.ref.name === ref.name,
    )?.label;
  });

  watch(
    subtitleLabel,
    (label) => {
      if (label !== undefined && label !== model.data.subtitleLabel)
        model.data.subtitleLabel = label;
    },
    { immediate: true },
  );
}
