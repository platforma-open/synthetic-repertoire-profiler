"""VDJ region auto-annotation glue for synthetic-repertoire-profiler.

Two file-content steps that bracket repseqio (which does the germline inference):

  split    parent FASTA -> per-domain V-half / J-half FASTA (+ split offsets),
           cutting each domain at mid-CDR3. Mirrors the mixcr-amplicon-alignment
           client-side `parseFasta.ts` split so repseqio sees clean V and J genes.

  assemble repseqio's compiled library (anchor points) + the split offsets ->
           mitool's `--parent-regions` overlay JSON, reassembling FR1..FR4 onto the
           whole parent (V anchors as-is; J anchors shifted by the split offset;
           CDR3 = the span between the V-side CDR3Begin and the shifted FR4Begin).

Two modes:

  No `--scheme`: the whole parent is one V-domain. The overlay names its regions
  FR1..FR4 on the `vdj` scheme with a `VDJRegion` complete feature. This is the
  whole-dataset `vdjAutoDetect` path.

  With `--scheme` (per-parent region list, each region's `autoDetect` / `ignored`
  flagged): only the auto-detect V-domains are subdivided by germline. Each one becomes
  a container region (the whole-domain VH / VL sequence column) whose FR/CDR children,
  reassembled inside that domain's own span (anchors shifted by the domain's parent
  offset) and prefixed with the domain name (`VH_FR1`…), tile it exactly. Non-auto
  regions (manual spans, ignored linkers/hinges) pass through as drawn. The overlay uses
  the `custom` scheme with no complete feature — an scFv construct spans two chains, so
  there is no single whole-variant feature. This is the per-domain scFv path. Chain is
  not in the overlay (mitool's reader rejects unknown fields); the model carries it.

Fail-fast (per-domain, named) when a CDR3 motif isn't found or repseqio did not place
the required anchors — the run stops rather than mis-annotating.
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

# The seven canonical FR/CDR names, in order. The model (buildRegionChains) and the
# workflow (region-config scfvAuto) expand the same list with the same `<domain>_<name>`
# prefix, so the scFv column names, their chain tags and this overlay all agree.
VDJ_REGIONS_NAMES = ["FR1", "CDR1", "FR2", "CDR2", "FR3", "CDR3", "FR4"]


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


def split_domain(label, seq):
    """Return (v_seq, j_seq, split_offset). Raise on a missing/short CDR3 motif."""
    clean = re.sub(r"[^ACGT]", "N", seq.upper().replace(" ", ""))  # IUPAC/unknown -> N
    # repseqio fromFasta rejects wildcard nucleotides, so N -> A for the gene sequences
    # (only affects flanking bases; anchor inference is amino-acid based).
    no_n = clean.replace("N", "A")
    aa = translate(clean)
    m = MOTIF.search(aa[SEARCH_START_AA:])
    if not m:
        die(f"{label}: CDR3 motif not found (not a canonical V-domain?). "
            f"Turn off VDJ auto-detect and annotate this dataset manually.")
    pattern_start = SEARCH_START_AA + m.start()
    cdr3_aa_len = len(m.group(1)) + 1  # include leading Cys
    cdr3_start_nt = pattern_start * 3
    cdr3_end_nt = (pattern_start + cdr3_aa_len) * 3
    v_end = cdr3_start_nt + (cdr3_end_nt - cdr3_start_nt) // 2  # split at mid-CDR3
    return no_n[:v_end], no_n[v_end:], v_end


# An anchor is "placed" only if present AND non-negative: repseqio inferPoints run with
# --force leaves a key present with value -1 when it can't confidently place that point,
# which would otherwise slip past a bare presence check and surface later as a misleading
# "not codon-aligned" error.
def placed(anchors, keys):
    return anchors is not None and all(k in anchors and int(anchors[k]) >= 0 for k in keys)


def missing(anchors, keys):
    if anchors is None:
        return list(keys)
    return [k for k in keys if k not in anchors or int(anchors[k]) < 0]


def domain_regions(label, v, j, v_len, shift):
    """FR1..FR4 for one V-domain, in parent coordinates. [v]/[j] are the domain's V/J
    anchor maps (J in the J-half frame, so offset by [v_len]); [shift] moves the whole
    domain into the parent frame. Every region must be codon-aligned at frame 0 — mitool
    emits aaSeq{region} only then, and the block declares all FR/CDR aa columns
    statically — so a misframed span fails here rather than dropping a column at import."""
    if not placed(v, V_REQUIRED) or not placed(j, J_REQUIRED):
        # Name the anchors, so the cause is readable. A missing V anchor usually means the
        # domain really is an engineered scaffold. A missing J anchor more often means the
        # J half scored below the inferPoints threshold, which is easy to retune.
        gaps = ([f"V:{k}" for k in missing(v, V_REQUIRED)]
                + [f"J:{k}" for k in missing(j, J_REQUIRED)])
        die(f"{label}: germline inference did not place {', '.join(gaps)} "
            f"(engineered scaffold, or the half scored below the inferPoints threshold). "
            f"Turn off VDJ auto-detect and annotate manually.")
    # V anchors start at 0 of the V-half; J anchors shift by the V length. CDR3 spans
    # CDR3Begin (V) -> FR4Begin (J). Then the whole domain shifts into the parent frame.
    cdr3_end = v_len + int(j["FR4Begin"])
    regions = [
        {"name": "FR1", "begin": int(v["FR1Begin"]), "end": int(v["CDR1Begin"])},
        {"name": "CDR1", "begin": int(v["CDR1Begin"]), "end": int(v["FR2Begin"])},
        {"name": "FR2", "begin": int(v["FR2Begin"]), "end": int(v["CDR2Begin"])},
        {"name": "CDR2", "begin": int(v["CDR2Begin"]), "end": int(v["FR3Begin"])},
        {"name": "FR3", "begin": int(v["FR3Begin"]), "end": int(v["CDR3Begin"])},
        {"name": "CDR3", "begin": int(v["CDR3Begin"]), "end": cdr3_end},
        {"name": "FR4", "begin": cdr3_end, "end": v_len + int(j["FR4End"])},
    ]
    for r in regions:
        r["begin"] += shift
        r["end"] += shift
        if r["begin"] % 3 != 0 or r["end"] % 3 != 0:
            die(f"{label}: region {r['name']} is not codon-aligned "
                f"([{r['begin']},{r['end']})); VDJ auto-detect needs in-frame parents. "
                f"Turn it off and annotate this dataset manually.")
    return regions


def write_fasta(path, records):
    with open(path, "w", encoding="utf-8") as fh:
        for name, seq in records:
            fh.write(f">{name}\n{seq}\n")


def read_scheme(path):
    """parentId -> parent dict (regions plus completeFeatureName and any other settings)."""
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("parents", {})


def copy_manual_region(r):
    """A drawn (non-auto) region passed through verbatim, keeping its ignored flag and any
    sub-regions — dropping them would lose a manual graft's columns in a run that also
    auto-detects another parent."""
    span = {"name": r["name"], "begin": int(r["begin"]), "end": int(r["end"])}
    if r.get("ignored"):
        span["ignored"] = True
    children = r.get("children")
    if children:
        span["children"] = [copy_manual_region(c) for c in children]
    return span


def cmd_split(args):
    with open(args.input, encoding="utf-8") as fh:
        parents = parse_fasta(fh.read())
    if not parents:
        die("no parent sequences found in the input FASTA.")

    v_records, j_records, splits = [], [], {}
    if args.scheme:
        # scFv: subdivide only the auto-detect domains, each within its own drawn span.
        # Gene keys are sequential (`g0`, `g1`…) so a parent id with odd characters cannot
        # collide with repseqio's gene-name parsing; splits.json maps each key back.
        scheme = read_scheme(args.scheme)
        by_id = dict(parents)
        n = 0
        for pid, ps in scheme.items():
            seq = by_id.get(pid)
            if seq is None:
                die(f"parent '{pid}': in the region scheme but not in the parents FASTA.")
            for r in ps.get("regions", []):
                if not r.get("autoDetect"):
                    continue
                begin, end = int(r["begin"]), int(r["end"])
                label = f"parent '{pid}' domain '{r['name']}'"
                v_seq, j_seq, offset = split_domain(label, seq[begin:end])
                key = f"g{n}"
                n += 1
                v_records.append((f"{key}_Vgene", v_seq))
                j_records.append((f"{key}_Jgene", j_seq))
                splits[key] = {"pid": pid, "domain": r["name"], "domainBegin": begin, "vLen": offset}
        if not splits:
            die("the region scheme marks no domain for auto-detect.")
    else:
        for pid, seq in parents:
            v_seq, j_seq, offset = split_domain(f"parent '{pid}'", seq)
            v_records.append((f"{pid}_Vgene", v_seq))
            j_records.append((f"{pid}_Jgene", j_seq))
            splits[pid] = {"vLen": offset}

    write_fasta(args.v_out, v_records)
    write_fasta(args.j_out, j_records)
    with open(args.splits_out, "w", encoding="utf-8") as fh:
        json.dump(splits, fh)


def load_anchors(path):
    """Compiled library -> (v_anchors, j_anchors), each gene key -> anchor-point map."""
    with open(path, encoding="utf-8") as fh:
        library = json.load(fh)
    v_anchors, j_anchors = {}, {}
    for entry in library:
        for gene in entry.get("genes", []):
            name = gene.get("name", "")
            ap = gene.get("anchorPoints", {})
            if name.endswith("_Vgene"):
                v_anchors[name[:-len("_Vgene")]] = ap
            elif name.endswith("_Jgene"):
                j_anchors[name[:-len("_Jgene")]] = ap
    return v_anchors, j_anchors


def cmd_assemble(args):
    v_anchors, j_anchors = load_anchors(args.library)
    with open(args.splits, encoding="utf-8") as fh:
        splits = json.load(fh)

    if args.scheme:
        # scFv: each auto-detect domain's FR/CDR reassembled inside its own span (prefixed
        # with the domain name); every other region passes through as drawn. The `custom`
        # scheme tolerates the gaps between a germline FR4 and the next drawn region, and
        # there is no single complete feature across two chains.
        scheme = read_scheme(args.scheme)
        domain_key = {(s["pid"], s["domain"]): key for key, s in splits.items()}
        parents = {}
        for pid, ps in scheme.items():
            out = []
            for r in ps.get("regions", []):
                if r.get("autoDetect"):
                    key = domain_key.get((pid, r["name"]))
                    if key is None:
                        die(f"parent '{pid}' domain '{r['name']}': no split record "
                            f"(the split step did not emit this domain).")
                    s = splits[key]
                    label = f"parent '{pid}' domain '{r['name']}'"
                    sub = domain_regions(label, v_anchors.get(key), j_anchors.get(key),
                                         int(s["vLen"]), int(s["domainBegin"]))
                    # The domain is one container region (the whole-domain VH / VL sequence
                    # column) holding its FR/CDR as children, prefixed and unique across the
                    # parent. The children tile the container exactly, which mitool requires.
                    children = [{"name": f"{r['name']}_{g['name']}",
                                 "begin": g["begin"], "end": g["end"]} for g in sub]
                    out.append({"name": r["name"],
                                "begin": children[0]["begin"], "end": children[-1]["end"],
                                "children": children})
                else:
                    out.append(copy_manual_region(r))
            parent_obj = {"scheme": "custom", "regions": out}
            # Keep a manual parent's whole-feature name so mitool still emits its whole-variant
            # column; an scFv parent has none (its two domains span two chains).
            af = ps.get("completeFeatureName")
            if af:
                parent_obj["completeFeatureName"] = af
            parents[pid] = parent_obj
    else:
        parents = {}
        for pid, split in splits.items():
            regions = domain_regions(f"parent '{pid}'", v_anchors.get(pid), j_anchors.get(pid),
                                     int(split["vLen"]), 0)
            parents[pid] = {
                "scheme": "vdj",
                "completeFeatureName": "VDJRegion",
                "regions": regions,
            }

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump({"version": 1, "parents": parents}, fh)


def main():
    parser = argparse.ArgumentParser(description="VDJ region auto-annotation glue.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_split = sub.add_parser("split", help="split parent FASTA at mid-CDR3 into V/J genes")
    p_split.add_argument("--input", required=True)
    p_split.add_argument("--v-out", dest="v_out", required=True)
    p_split.add_argument("--j-out", dest="j_out", required=True)
    p_split.add_argument("--splits-out", dest="splits_out", required=True)
    p_split.add_argument("--scheme", help="scFv region scheme; subdivide only its auto-detect domains")
    p_split.set_defaults(func=cmd_split)

    p_asm = sub.add_parser("assemble", help="compiled library + splits -> mitool overlay JSON")
    p_asm.add_argument("--library", required=True)
    p_asm.add_argument("--splits", required=True)
    p_asm.add_argument("--out", required=True)
    p_asm.add_argument("--scheme", help="scFv region scheme; pass through non-auto regions")
    p_asm.set_defaults(func=cmd_assemble)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
