import { platforma } from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";
import { defineAppV3 } from "@platforma-sdk/ui-vue";
import KnownVariantsAaPage from "./KnownVariantsAaPage.vue";
import KnownVariantsNtPage from "./KnownVariantsNtPage.vue";
import MainPage from "./MainPage.vue";
import MutationHistogramPage from "./MutationHistogramPage.vue";
import QcReportPage from "./QcReportPage.vue";

export const sdkPlugin = defineAppV3(platforma, () => ({
  routes: {
    "/": () => MainPage,
    "/qc": () => QcReportPage,
    "/mutation-histogram": () => MutationHistogramPage,
    "/known-variants-nt": () => KnownVariantsNtPage,
    "/known-variants-aa": () => KnownVariantsAaPage,
  },
}));

export const useApp = sdkPlugin.useApp;
