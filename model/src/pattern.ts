export type LengthRange = { min: number; max: number };

/** Length spec for the insert (R capture) in a mitool pattern:
 *   undefined   = variable length (`*`)
 *   number      = fixed length (`N{n}`)
 *   LengthRange = ranged length (`N{min:max}`)
 */
export type InsertLength = number | LengthRange | undefined;

export type PatternHalf = {
  umi?: LengthRange;
  umiName?: string; // e.g. "UMI", "UMI1", "UMI2", "CELL"
  insertName?: string; // e.g. "R1", "R2"
  leftAnchor: string; // may be empty
  rightAnchor: string; // may be empty
  rightTrim?: number;
  insertLength?: InsertLength;
  hasLeadingWildcard?: boolean; // pattern starts with `^*` before the (optional) UMI/anchor
  /** Anonymous `N{min:max}` span between `^[*]?` and the UMI. Used for
   *  heterogeneity spacers that diversify Illumina cluster signal without
   *  serving as a molecular barcode. */
  hetSpacer?: LengthRange;
};

export type PatternParts = {
  r1: PatternHalf;
  r2?: PatternHalf;
};

// Matches one half of a mitool parse pattern. Every part except the trailing
// `*` is optional, including the `(R<n>:...)` capture. A half with no
// R capture is valid when the read carries only UMI/flanks/spacer and the
// insert lives on the other read:
//
//   [^][*][N{min[:max]}][(umiName:N{min[:max]})][leftAnchor][(insertName:*|N{n}|N{min:max})[rightAnchor]][>{trim}][*]
//
// The leading `^` (start-of-read anchor) and the trailing `*` (match-rest
// wildcard) are both OPTIONAL — mitool accepts patterns without them (e.g.
// `(R1:*)\^(R2:*)`). This block's insert is typically the whole read, so it
// usually omits both.
//
// Groups:
//   1  = leading wildcard (`*`) or empty
//   2  = heterogeneity spacer min (if spacer present)
//   3  = heterogeneity spacer max (or empty when min == max)
//   4  = umiName (if UMI present)
//   5  = umiMin
//   6  = umiMax (or empty when min == max)
//   7  = leftAnchor (may be empty)
//   8  = insertName (R1, R2, ...) — absent when the half has no R capture
//   9  = `*` when the capture is variable-length
//   10 = insertLength min (fixed or ranged)
//   11 = insertLength max (only when ranged)
//   12 = rightAnchor (may be empty)
//   13 = right trim (or empty)
const HALF_RE =
  /^\^?(\*)?(?:N\{(\d+)(?::(\d+))?\})?(?:\(([Uu][Mm][Ii]\d*):N\{(\d+)(?::(\d+))?\}\))?([A-Za-z]*)(?:\(([Rr]\d+):(?:(\*)|N\{(\d+)(?::(\d+))?\})\)([A-Za-z]*))?(?:>\{(\d+)\})?\*?$/;

function parseHalf(s: string): PatternHalf | null {
  const m = HALF_RE.exec(s.trim());
  if (!m) return null;

  const hasLeadingWildcard = m[1] === "*";

  let hetSpacer: LengthRange | undefined;
  if (m[2] !== undefined) {
    const min = parseInt(m[2], 10);
    const max = m[3] !== undefined && m[3] !== "" ? parseInt(m[3], 10) : min;
    hetSpacer = { min, max };
  }

  let umi: LengthRange | undefined;
  let umiName: string | undefined;
  if (m[4] !== undefined) {
    umiName = m[4];
    const min = parseInt(m[5], 10);
    const max = m[6] !== undefined && m[6] !== "" ? parseInt(m[6], 10) : min;
    umi = { min, max };
  }

  const leftAnchor = m[7] ?? "";
  const insertName = m[8]; // undefined when the half has no (R<n>:...) capture

  let insertLength: InsertLength;
  if (insertName === undefined) {
    insertLength = undefined;
  } else if (m[9] === "*") {
    insertLength = undefined; // variable
  } else {
    const min = parseInt(m[10], 10);
    const max = m[11] !== undefined && m[11] !== "" ? parseInt(m[11], 10) : min;
    insertLength = min === max ? min : { min, max };
  }

  const rightAnchor = insertName !== undefined ? (m[12] ?? "") : "";
  const rightTrim = m[13] !== undefined && m[13] !== "" ? parseInt(m[13], 10) : undefined;

  return {
    hasLeadingWildcard,
    hetSpacer,
    umi,
    umiName,
    leftAnchor,
    insertName,
    rightAnchor,
    rightTrim,
    insertLength,
  };
}

/** Parse a full pattern string into parts, or return null if unparseable. */
export function parsePattern(str: string): PatternParts | null {
  const sep = str.indexOf("\\");
  if (sep === -1) {
    const r1 = parseHalf(str);
    return r1 ? { r1 } : null;
  }
  const r1 = parseHalf(str.slice(0, sep));
  const r2 = parseHalf(str.slice(sep + 1));
  if (!r1 || !r2) return null;

  // All defined tag names must be unique. Absent UMIs (undefined) are not tags.
  const tags = [r1.umiName, r1.insertName, r2.umiName, r2.insertName].filter(
    (t): t is string => t !== undefined,
  );
  if (new Set(tags).size !== tags.length) return null;

  return { r1, r2 };
}

/** True iff a UMI capture appears in either read half. */
export function patternHasUmi(parts: PatternParts): boolean {
  return parts.r1.umi !== undefined || parts.r2?.umi !== undefined;
}
