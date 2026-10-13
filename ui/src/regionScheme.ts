// Helpers for the region-scheme editor: parse the parent FASTA, translate a
// nucleotide region for the amino-acid preview, and derive cumulative offsets.

export { parseParentFasta } from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";
export type { ParsedParent } from "@platforma-open/milaboratories.synthetic-repertoire-profiler.model";

const CODONS: Record<string, string> = {
  TTT: "F",
  TTC: "F",
  TTA: "L",
  TTG: "L",
  CTT: "L",
  CTC: "L",
  CTA: "L",
  CTG: "L",
  ATT: "I",
  ATC: "I",
  ATA: "I",
  ATG: "M",
  GTT: "V",
  GTC: "V",
  GTA: "V",
  GTG: "V",
  TCT: "S",
  TCC: "S",
  TCA: "S",
  TCG: "S",
  CCT: "P",
  CCC: "P",
  CCA: "P",
  CCG: "P",
  ACT: "T",
  ACC: "T",
  ACA: "T",
  ACG: "T",
  GCT: "A",
  GCC: "A",
  GCA: "A",
  GCG: "A",
  TAT: "Y",
  TAC: "Y",
  TAA: "*",
  TAG: "*",
  CAT: "H",
  CAC: "H",
  CAA: "Q",
  CAG: "Q",
  AAT: "N",
  AAC: "N",
  AAA: "K",
  AAG: "K",
  GAT: "D",
  GAC: "D",
  GAA: "E",
  GAG: "E",
  TGT: "C",
  TGC: "C",
  TGA: "*",
  TGG: "W",
  CGT: "R",
  CGC: "R",
  CGA: "R",
  CGG: "R",
  AGT: "S",
  AGC: "S",
  AGA: "R",
  AGG: "R",
  GGT: "G",
  GGC: "G",
  GGA: "G",
  GGG: "G",
};

/** Translate a nucleotide sequence from position 0; trailing partial codon dropped. */
export function translateDNA(nt: string): string {
  const s = nt.toUpperCase().replace(/\s/g, "");
  let out = "";
  for (let i = 0; i + 3 <= s.length; i += 3) out += CODONS[s.substring(i, i + 3)] ?? "X";
  return out;
}

/** Cumulative 0-based [begin, end) offsets for a list of region lengths. `start` seeds
 *  the running position — 0 for a parent's top-level regions, and the containing
 *  region's `begin` for the sub-regions tiling it, so a child's offsets come out
 *  absolute in the parent's frame like every other span. */
export function cumulativeOffsets(lengths: number[], start = 0): { begin: number; end: number }[] {
  let pos = start;
  return lengths.map((len) => {
    const begin = pos;
    pos += Math.max(0, len);
    return { begin, end: pos };
  });
}
