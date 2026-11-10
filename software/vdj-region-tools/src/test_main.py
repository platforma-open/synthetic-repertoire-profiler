"""Unit tests for the VDJ region glue. Run with `python3 -I test_main.py` — no deps.

Covers the pure logic (motif split, anchor reassembly, the scheme expansion) without
repseqio: the anchor maps are hand-built, so the test owns every offset it checks.
"""

import json
import os
import sys
import tempfile
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import main  # noqa: E402

CODON = {"A": "GCT", "C": "TGT", "F": "TTT", "G": "GGT", "W": "TGG"}


def nt(aa):
    return "".join(CODON[c] for c in aa)


# An in-frame V-domain whose aa matches the CDR3 motif after position 80.
VDOM_AA = "A" * 85 + "C" + "AAAA" + "F" + "G" + "A" + "G"
VDOM = nt(VDOM_AA)  # 282 nt
LINK = nt("WWW")  # 9 nt


def test_split_domain_cuts_at_mid_cdr3():
    v, j, off = main.split_domain("d", VDOM)
    assert off == 264, off
    assert v + j == VDOM.replace("N", "A")
    assert len(v) == off


def test_split_domain_missing_motif_exits():
    try:
        main.split_domain("d", nt("A" * 90))
    except SystemExit as e:
        assert e.code == 1
        return
    raise AssertionError("expected SystemExit on a missing CDR3 motif")


def v_anchors():
    return {"FR1Begin": 0, "CDR1Begin": 30, "FR2Begin": 60,
            "CDR2Begin": 90, "FR3Begin": 120, "CDR3Begin": 252}


def j_anchors():
    return {"FR4Begin": 6, "FR4End": 18}


def test_domain_regions_shifts_into_parent_frame():
    regions = main.domain_regions("d", v_anchors(), j_anchors(), 264, 291)
    names = [r["name"] for r in regions]
    assert names == ["FR1", "CDR1", "FR2", "CDR2", "FR3", "CDR3", "FR4"], names
    assert regions[0] == {"name": "FR1", "begin": 291, "end": 321}
    # CDR3 = CDR3Begin(252)+shift .. vLen(264)+FR4Begin(6)+shift; FR4 ends at vLen+FR4End+shift.
    assert regions[5] == {"name": "CDR3", "begin": 291 + 252, "end": 291 + 270}
    assert regions[6] == {"name": "FR4", "begin": 291 + 270, "end": 291 + 282}


def test_domain_regions_unplaced_anchor_exits():
    bad = dict(v_anchors(), CDR3Begin=-1)  # inferPoints leaves -1 when unsure
    try:
        main.domain_regions("d", bad, j_anchors(), 264, 0)
    except SystemExit as e:
        assert e.code == 1
        return
    raise AssertionError("expected SystemExit on an unplaced anchor")


def write(path, text):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def run_scheme_roundtrip(tmp):
    scfv = VDOM + LINK + VDOM
    write(f"{tmp}/parents.fa", f">P1\n{scfv}\n")
    scheme = {"version": 1, "parents": {"P1": {"scheme": "custom", "regions": [
        {"name": "VH", "begin": 0, "end": 282, "autoDetect": True},
        {"name": "LINK", "begin": 282, "end": 291, "ignored": True},
        {"name": "VL", "begin": 291, "end": 573, "autoDetect": True},
    ]}}}
    write(f"{tmp}/scheme.json", json.dumps(scheme))
    main.cmd_split(SimpleNamespace(
        input=f"{tmp}/parents.fa", v_out=f"{tmp}/v.fa", j_out=f"{tmp}/j.fa",
        splits_out=f"{tmp}/splits.json", scheme=f"{tmp}/scheme.json"))
    splits = json.load(open(f"{tmp}/splits.json"))
    assert {s["domain"] for s in splits.values()} == {"VH", "VL"}, splits

    # Hand-build the compiled library the assemble step would read.
    keys = {s["domain"]: k for k, s in splits.items()}
    genes = []
    for dom in ("VH", "VL"):
        genes.append({"name": f"{keys[dom]}_Vgene", "anchorPoints": v_anchors()})
        genes.append({"name": f"{keys[dom]}_Jgene", "anchorPoints": j_anchors()})
    write(f"{tmp}/lib.json", json.dumps([{"genes": genes}]))
    main.cmd_assemble(SimpleNamespace(
        library=f"{tmp}/lib.json", splits=f"{tmp}/splits.json",
        out=f"{tmp}/overlay.json", scheme=f"{tmp}/scheme.json"))
    return json.load(open(f"{tmp}/overlay.json"))


def test_scheme_overlay_shape():
    with tempfile.TemporaryDirectory() as tmp:
        overlay = run_scheme_roundtrip(tmp)
    p = overlay["parents"]["P1"]
    assert p["scheme"] == "custom", p["scheme"]
    assert "completeFeatureName" not in p  # two chains, no single whole-variant feature
    # Three top-level regions: the two whole-domain containers (O9) and the ignored linker.
    names = [r["name"] for r in p["regions"]]
    assert names == ["VH", "LINK", "VL"], names
    link = next(r for r in p["regions"] if r["name"] == "LINK")
    assert link == {"name": "LINK", "begin": 282, "end": 291, "ignored": True}, link
    # Each container holds its seven prefixed FR/CDR children, tiling it exactly.
    for dom in ("VH", "VL"):
        c = next(r for r in p["regions"] if r["name"] == dom)
        kids = c["children"]
        assert [k["name"] for k in kids] == [f"{dom}_{n}" for n in main.VDJ_REGIONS_NAMES], kids
        assert kids[0]["begin"] == c["begin"] and kids[-1]["end"] == c["end"], (c, kids)
        assert all(kids[i]["end"] == kids[i + 1]["begin"] for i in range(len(kids) - 1)), kids
    # Top-level regions are non-overlapping and sorted, as mitool's custom scheme requires.
    offs = [(r["begin"], r["end"]) for r in p["regions"]]
    assert all(offs[i][1] <= offs[i + 1][0] for i in range(len(offs) - 1)), offs


def test_no_scheme_keeps_whole_parent():
    with tempfile.TemporaryDirectory() as tmp:
        write(f"{tmp}/parents.fa", f">P1\n{VDOM}\n")
        main.cmd_split(SimpleNamespace(
            input=f"{tmp}/parents.fa", v_out=f"{tmp}/v.fa", j_out=f"{tmp}/j.fa",
            splits_out=f"{tmp}/splits.json", scheme=None))
        splits = json.load(open(f"{tmp}/splits.json"))
        assert list(splits.keys()) == ["P1"], splits
        genes = [{"name": "P1_Vgene", "anchorPoints": v_anchors()},
                 {"name": "P1_Jgene", "anchorPoints": j_anchors()}]
        write(f"{tmp}/lib.json", json.dumps([{"genes": genes}]))
        main.cmd_assemble(SimpleNamespace(
            library=f"{tmp}/lib.json", splits=f"{tmp}/splits.json",
            out=f"{tmp}/overlay.json", scheme=None))
        p = json.load(open(f"{tmp}/overlay.json"))["parents"]["P1"]
    assert p["scheme"] == "vdj", p
    assert p["completeFeatureName"] == "VDJRegion", p
    assert [r["name"] for r in p["regions"]] == main.VDJ_REGIONS_NAMES, p


def main_run():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"PASS: {t.__name__}")
    print(f"{len(tests)} tests passed")


if __name__ == "__main__":
    main_run()
