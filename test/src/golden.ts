/**
 * Golden snapshot of what the block publishes: every exported column and every
 * p-frame output, as a normalised spec plus sorted row values.
 *
 * Normalisation keeps the snapshot stable across runs and across storage changes:
 * - block, sample and dataset ids are replaced by stable names;
 * - rows are sorted; doubles are rounded to 12 significant digits, so
 *   summation-order rounding does not count as a change;
 * - data is read through the p-frame driver, so parquet layout and partitioning
 *   do not count either.
 */
import type {
  PColumnIdAndSpec,
  PColumnSpec,
  PFrameDriver,
  PFrameHandle,
  PTableVector,
} from "@platforma-sdk/model";
import { isValueNA } from "@platforma-sdk/model";

export type GoldenColumn = {
  key: string;
  spec: unknown;
  rows: string[];
};

export type Replacements = Record<string, string>;

function replaceIds(value: unknown, ids: Replacements): unknown {
  let s = JSON.stringify(value);
  for (const [from, to] of Object.entries(ids)) s = s.split(from).join(to);
  return JSON.parse(s);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  return value;
}

// Annotation values are strings; a JSON-valued one (pl7.app/trace) is parsed so its
// key order, which varies between runs, does not count as a change.
function normalizeSpec(spec: PColumnSpec): unknown {
  const annotations: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(spec.annotations ?? {})) {
    if (v.startsWith("[") || v.startsWith("{")) annotations[k] = sortKeys(JSON.parse(v));
    else annotations[k] = v;
  }
  return sortKeys({ ...spec, annotations });
}

function cell(v: PTableVector, row: number): string {
  if (isValueNA(v, row)) return "NA";
  const x = (v.data as ArrayLike<unknown>)[row];
  if (v.type === "Double" || v.type === "Float") {
    const n = Number(x);
    return Number.isInteger(n) ? String(n) : Number(n.toPrecision(12)).toString();
  }
  return String(x);
}

/** Stable identity of a column: its name, axes and domain, with ids replaced. */
export function columnKey(spec: PColumnSpec, ids: Replacements): string {
  return JSON.stringify(
    replaceIds(
      sortKeys({
        name: spec.name,
        domain: spec.domain ?? {},
        axes: spec.axesSpec.map((a) => ({ name: a.name, domain: a.domain ?? {} })),
      }),
      ids,
    ),
  );
}

export async function readColumn(
  driver: PFrameDriver,
  handle: PFrameHandle,
  col: PColumnIdAndSpec,
  ids: Replacements,
): Promise<GoldenColumn> {
  const data = await driver.calculateTableData(handle, {
    src: { type: "column", column: col.columnId },
    filters: [],
    sorting: [],
  });
  const n = data.length > 0 ? data[0].data.data.length : 0;
  const rows: string[] = [];
  for (let r = 0; r < n; r++) rows.push(data.map((c) => cell(c.data, r)).join("\t"));
  rows.sort();
  return {
    key: columnKey(col.spec, ids),
    spec: replaceIds(normalizeSpec(col.spec), ids),
    rows: replaceIds(rows, ids) as string[],
  };
}

export async function readFrame(
  driver: PFrameDriver,
  handle: PFrameHandle,
  ids: Replacements,
  keep: (spec: PColumnSpec) => boolean = () => true,
): Promise<GoldenColumn[]> {
  const cols = (await driver.listColumns(handle)).filter((c) => keep(c.spec));
  const out: GoldenColumn[] = [];
  for (const c of cols) out.push(await readColumn(driver, handle, c, ids));
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
