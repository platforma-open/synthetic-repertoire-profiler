"""VDJ region auto-annotation glue for synthetic-repertoire-profiler.

Two file-content steps that bracket repseqio (which does the germline inference):

  split    parent FASTA -> per-parent V-half / J-half FASTA (+ split offsets),
           cutting each parent at mid-CDR3. Mirrors the mixcr-amplicon-alignment
           client-side `parseFasta.ts` split so repseqio sees clean V and J genes.

  assemble repseqio's compiled library (anchor points) + the split offsets ->
           mitool's `--parent-regions` overlay JSON, reassembling FR1..FR4 onto the
           whole parent (V anchors as-is; J anchors shifted by the split offset;
           CDR3 = the span between the V-side CDR3Begin and the shifted FR4Begin).

Fail-fast (per-parent, named) when a parent's CDR3 motif isn't found or repseqio
did not place the required anchors — the run stops rather than mis-annotating.
"""

import argparse
import json
import re
import sys

# Standard codon table (frame 0). '*' = stop.
CODON = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L", "CTT": "L", "CTC": "L",
    "CTA": "L", "CTG": "L", "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V", "TCT": "S", "TCC": "S",
    "TCA": "S", "TCG": "S", "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T", "GCT": "A", "GCC": "A",
    "GCA": "A", "GCG": "A", "TAT": "Y", "TAC": "Y", "TAA": "*", "TAG": "*",
    "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q", "AAT": "N", "AAC": "N",
    "AAA": "K", "AAG": "K", "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "TGT": "C", "TGC": "C", "TGA": "*", "TGG": "W", "CGT": "R", "CGC": "R",
    "CGA": "R", "CGG": "R", "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}

# CDR3 anchor motif: conserved Cys ... conserved aromatic ... W/F-G-x-G (FR4 start).
# Same regex the amplicon block uses client-side (parseFasta.ts); searched from aa 80.
MOTIF = re.compile(
    r"C([ACDEFGHIKLMNPQRSTVWYX]{4,50}[FWYLIX])[ACDEFGHIKLMNPQRSTVWYX]{0,5}G[ACDEFGHIKLMNPQRSTVWYX]G"
)
SEARCH_START_AA = 80

# Anchor points repseqio's inferPoints places on the V and J genes. VEnd/JBegin are
# germline-contribution markers we don't need for the region partition.
V_REQUIRED = ["FR1Begin", "CDR1Begin", "FR2Begin", "CDR2Begin", "FR3Begin", "CDR3Begin"]
J_REQUIRED = ["FR4Begin", "FR4End"]


def die(msg):
    print(f"vdj-region-tools: {msg}", file=sys.stderr)
    sys.exit(1)


def translate(nt):
    """Frame-0 translation; stops at the first stop codon (matches parseFasta.ts)."""
    out = []
    for i in range(0, len(nt) - 2, 3):
        aa = CODON.get(nt[i:i + 3], "X")
        if aa == "*":
            break
        out.append(aa)
    return "".join(out)


def parse_fasta(text):
    """[(id, sequence)]; id = first whitespace token of the header (mitool parent id)."""
    records = []
    header = None
    body = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith(">"):
            if header is not None:
                records.append((header, "".join(body)))
            header = line[1:].strip().split()[0] if line[1:].strip() else ""
            body = []
        elif header is not None:
            body.append(line)
    if header is not None:
        records.append((header, "".join(body)))
    return records


def split_parent(pid, seq):
    """Return (v_seq, j_seq, split_offset). Raise on a missing/short CDR3 motif."""
    clean = re.sub(r"[^ACGT]", "N", seq.upper().replace(" ", ""))  # IUPAC/unknown -> N
    # repseqio fromFasta rejects wildcard nucleotides, so N -> A for the gene sequences
    # (only affects flanking bases; anchor inference is amino-acid based).
    no_n = clean.replace("N", "A")
    aa = translate(clean)
    m = MOTIF.search(aa[SEARCH_START_AA:])
    if not m:
        die(f"parent '{pid}': CDR3 motif not found (not a canonical V-domain?). "
            f"Turn off VDJ auto-detect and annotate this dataset manually.")
    pattern_start = SEARCH_START_AA + m.start()
    cdr3_aa_len = len(m.group(1)) + 1  # include leading Cys
    cdr3_start_nt = pattern_start * 3
    cdr3_end_nt = (pattern_start + cdr3_aa_len) * 3
    v_end = cdr3_start_nt + (cdr3_end_nt - cdr3_start_nt) // 2  # split at mid-CDR3
    return no_n[:v_end], no_n[v_end:], v_end


def write_fasta(path, records):
    with open(path, "w") as fh:
        for name, seq in records:
            fh.write(f">{name}\n{seq}\n")


def cmd_split(args):
    parents = parse_fasta(open(args.input).read())
    if not parents:
        die("no parent sequences found in the input FASTA.")
    v_records, j_records, splits = [], [], {}
    for pid, seq in parents:
        v_seq, j_seq, offset = split_parent(pid, seq)
        v_records.append((f"{pid}_Vgene", v_seq))
        j_records.append((f"{pid}_Jgene", j_seq))
        splits[pid] = {"vLen": offset}
    write_fasta(args.v_out, v_records)
    write_fasta(args.j_out, j_records)
    json.dump(splits, open(args.splits_out, "w"))


def cmd_assemble(args):
    library = json.load(open(args.library))
    splits = json.load(open(args.splits))

    v_anchors, j_anchors = {}, {}
    for entry in library:
        for gene in entry.get("genes", []):
            name = gene.get("name", "")
            ap = gene.get("anchorPoints", {})
            if name.endswith("_Vgene"):
                v_anchors[name[:-len("_Vgene")]] = ap
            elif name.endswith("_Jgene"):
                j_anchors[name[:-len("_Jgene")]] = ap

    parents = {}
    for pid, split in splits.items():
        offset = int(split["vLen"])
        v = v_anchors.get(pid)
        j = j_anchors.get(pid)
        if v is None or any(k not in v for k in V_REQUIRED) \
                or j is None or any(k not in j for k in J_REQUIRED):
            die(f"parent '{pid}': germline inference did not place all VDJ anchors "
                f"(engineered scaffold?). Turn off VDJ auto-detect and annotate manually.")
        # V anchors are already in parent coordinates (the V-half starts at 0);
        # J anchors shift by the split offset. CDR3 spans CDR3Begin (V) -> FR4Begin (J).
        cdr3_end = offset + int(j["FR4Begin"])
        regions = [
            {"name": "FR1", "begin": int(v["FR1Begin"]), "end": int(v["CDR1Begin"])},
            {"name": "CDR1", "begin": int(v["CDR1Begin"]), "end": int(v["FR2Begin"])},
            {"name": "FR2", "begin": int(v["FR2Begin"]), "end": int(v["CDR2Begin"])},
            {"name": "CDR2", "begin": int(v["CDR2Begin"]), "end": int(v["FR3Begin"])},
            {"name": "FR3", "begin": int(v["FR3Begin"]), "end": int(v["CDR3Begin"])},
            {"name": "CDR3", "begin": int(v["CDR3Begin"]), "end": cdr3_end},
            {"name": "FR4", "begin": cdr3_end, "end": offset + int(j["FR4End"])},
        ]
        # Every region must be codon-aligned (frame 0): mitool emits aaSeq{region}
        # only when begin%3==0 && end%3==0, and the block declares all seven aa
        # region columns statically (it can't see these offsets at graph-build time).
        # A non-aligned region (out-of-frame parent / junction) would make mitool
        # drop that aaSeq column and crash the block's import — so fail cleanly here.
        for r in regions:
            if r["begin"] % 3 != 0 or r["end"] % 3 != 0:
                die(f"parent '{pid}': region {r['name']} is not codon-aligned "
                    f"([{r['begin']},{r['end']})); VDJ auto-detect needs in-frame parents. "
                    f"Turn it off and annotate this dataset manually.")
        parents[pid] = {
            "scheme": "vdj",
            "completeFeatureName": "VDJRegion",
            "regions": regions,
        }
    json.dump({"version": 1, "parents": parents}, open(args.out, "w"))


def main():
    parser = argparse.ArgumentParser(description="VDJ region auto-annotation glue.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_split = sub.add_parser("split", help="split parent FASTA at mid-CDR3 into V/J genes")
    p_split.add_argument("--input", required=True)
    p_split.add_argument("--v-out", dest="v_out", required=True)
    p_split.add_argument("--j-out", dest="j_out", required=True)
    p_split.add_argument("--splits-out", dest="splits_out", required=True)
    p_split.set_defaults(func=cmd_split)

    p_asm = sub.add_parser("assemble", help="compiled library + splits -> mitool overlay JSON")
    p_asm.add_argument("--library", required=True)
    p_asm.add_argument("--splits", required=True)
    p_asm.add_argument("--out", required=True)
    p_asm.set_defaults(func=cmd_assemble)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
