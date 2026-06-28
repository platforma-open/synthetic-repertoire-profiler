import type { KnownColumnInfo } from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";

// Lightweight TSV header + type discovery for the known-set column mapping.
// Known sets are TSV (no xlsx dep needed). We only need the header and a sample
// of values per column to infer Int / Double / String.

const MAX_SAMPLE_ROWS = 1000;

function inferValueType(value: string): "Int" | "Double" | "String" {
  const s = value.trim();
  if (s === "") return "String";
  const asInt = parseInt(s, 10);
  if (!isNaN(asInt) && String(asInt) === s) return "Int";
  if (!isNaN(parseFloat(s)) && /^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(s)) return "Double";
  return "String";
}

function inferColumnType(values: string[]): "Int" | "Double" | "String" {
  const counts = { Int: 0, Double: 0, String: 0 };
  let nonEmpty = 0;
  for (const v of values) {
    if (v.trim() === "") continue;
    nonEmpty++;
    counts[inferValueType(v)]++;
  }
  if (nonEmpty === 0) return "String";
  // Any string forces String; any double (but no string) forces Double; else Int.
  if (counts.String > 0) return "String";
  if (counts.Double > 0) return "Double";
  return "Int";
}

export type ParseKnownResult = { columns?: KnownColumnInfo[]; error?: string };

/** Parse a known-set TSV's bytes into per-column {header, inferred type}. */
export function parseKnownTsv(bytes: Uint8Array): ParseKnownResult {
  const text = new TextDecoder().decode(bytes);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { error: "File is empty." };

  const header = lines[0].split("\t").map((h) => h.trim());
  if (header.length < 2)
    return { error: "Expected a tab-separated file with at least two columns." };
  if (new Set(header).size !== header.length) return { error: "Column headers must be unique." };

  const sample = lines.slice(1, 1 + MAX_SAMPLE_ROWS).map((l) => l.split("\t"));
  const columns: KnownColumnInfo[] = header.map((h, i) => ({
    header: h,
    type: inferColumnType(sample.map((row) => row[i] ?? "")),
  }));
  return { columns };
}

/** Case-insensitive header match — used to pre-pick the obvious ID/Sequence columns. */
export function findHeader(
  columns: KnownColumnInfo[] | undefined,
  name: string,
): string | undefined {
  return columns?.find((c) => c.header.toLowerCase() === name.toLowerCase())?.header;
}
