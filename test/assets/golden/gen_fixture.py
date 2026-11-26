"""Deterministic paired FASTQs for the golden block test.

Two parents: P1 and P2. P2 differs from P1 only by synonymous substitutions, so one
amino-acid variant can come from either parent. Three samples share some variants
and hold private ones. Edge cases written on purpose:

- the same aa variant reached from P1 in one sample and from P2 in another;
- two nt variants with the same aa sequence (a synonymous pair) in one sample;
- a stop codon and a one-base deletion (frame shift);
- a stop-codon variant in two samples, so a non-productive variant has an owner to pick;
- read counts that differ per variant and per sample.

R1 captures 110 nt: two template bases, then parent[0:108]. R2 captures 111 nt: the
reverse complement of parent[108:219].

UMI set: the same captures with a 10-nt UMI right before the R1 anchor. Each molecule
has a read count; a 1-read molecule falls below the default consensus minimum (2) and
drops, so p2_m70 is absent from s2. One read of a 3-read molecule carries a base error.

Empty sample: s0 holds reads that match the tag pattern but carry a random sequence in
place of a parent, so the sample yields no variant.
Its id sorts before the other samples.

Known aa set: a TSV of full-length aa sequences, four present in the reads, two absent.
Known nt set: the same four variants and two absent ones as full-length nt sequences.

usage: gen_fixture.py OUT_DIR [base|umi|known-aa|known-nt]
  base     (default) parents.fasta and s{0,1,2,3}_R{1,2}.fastq.gz
  umi      umi_s{1,2,3}_R{1,2}.fastq.gz
  known-aa known_aa.tsv
  known-nt known_nt.tsv
"""
import gzip
import random
import sys

P1 = ("GGAACGTTTTCTTCCTACGCCATTTCTTGGGTGAGGCAAGCTCCAGGGCAGGGGTTGGAG"
      "TGGATGGGGGGAATTATTCCCATATTTGGCACCGCGAATTACGCTCAGATTACCGCGGAT"
      "AAAAGCACTTCCACGGCCTATATGGAATTAAGCAGTCTAAGATCAGAAGATACCGCTGTT"
      "TACTATTGTGCTAAGCATATGGGCTATCAACTTAGAGAG")
assert len(P1) == 219

A1, A2 = "CTTGTAAGGCCAGCG", "CCAGACATCCATCGT"
PRE1, PRE2 = "ACGTACGTACGTACGTA", "ACGTACGTACGTACGTACGT"
SUF1, SUF2 = "ACGTACGTA", "ACGTA"
LEAD = "GG"  # two template bases before the parent in the R1 capture

CODONS = {}
for a, codons in {
    "A": "GCT GCC GCA GCG", "R": "CGT CGC CGA CGG AGA AGG", "N": "AAT AAC", "D": "GAT GAC",
    "C": "TGT TGC", "Q": "CAA CAG", "E": "GAA GAG", "G": "GGT GGC GGA GGG", "H": "CAT CAC",
    "I": "ATT ATC ATA", "L": "TTA TTG CTT CTC CTA CTG", "K": "AAA AAG", "M": "ATG",
    "F": "TTT TTC", "P": "CCT CCC CCA CCG", "S": "TCT TCC TCA TCG AGT AGC",
    "T": "ACT ACC ACA ACG", "W": "TGG", "Y": "TAT TAC", "V": "GTT GTC GTA GTG", "*": "TAA TAG TGA",
}.items():
    for c in codons.split():
        CODONS[c] = a


def translate(s):
    return "".join(CODONS[s[i:i + 3]] for i in range(0, len(s) - 2, 3))


def rc(s):
    return s[::-1].translate(str.maketrans("ACGT", "TGCA"))


def synonymous(seq, codon_idx, rng):
    c = seq[codon_idx * 3:codon_idx * 3 + 3]
    alts = [x for x, a in CODONS.items() if a == CODONS[c] and x != c]
    return seq[:codon_idx * 3] + rng.choice(alts) + seq[codon_idx * 3 + 3:] if alts else seq


def missense(seq, codon_idx, rng):
    c = seq[codon_idx * 3:codon_idx * 3 + 3]
    alts = [x for x, a in CODONS.items() if a not in (CODONS[c], "*") and sum(p != q for p, q in zip(x, c)) == 1]
    return seq[:codon_idx * 3] + rng.choice(sorted(alts)) + seq[codon_idx * 3 + 3:]


rng = random.Random(7409)
# P2: synonymous changes at 12 codons, away from the R1/R2 junction (codon 36).
P2 = P1
for ci in sorted(rng.sample([i for i in range(73) if abs(i - 36) > 2], 12)):
    P2 = synonymous(P2, ci, rng)
assert translate(P2) == translate(P1) and P2 != P1


def mutate(parent, codon_idxs, seed):
    r = random.Random(seed)
    s = parent
    for ci in codon_idxs:
        s = missense(s, ci, r)
    return s


def stop(parent, ci):
    return parent[:ci * 3] + "TAG" + parent[ci * 3 + 3:]


def frameshift(parent, pos):
    # delete one base and pad at the end so both captures keep their length
    return parent[:pos] + parent[pos + 1:] + "A"


# Variant catalogue: name -> nt sequence (219 nt).
V = {
    "p1_m5": mutate(P1, [5], "a"),
    "p1_m5_m40": mutate(P1, [5, 40], "b"),
    "p1_m20": mutate(P1, [20], "c"),
    "p1_m60_m61": mutate(P1, [60, 61], "d"),
    "p1_stop30": stop(P1, 30),
    "p1_fs50": frameshift(P1, 50),
    "p2_m20": None,  # same aa as p1_m20, background P2
    "p2_m70": mutate(P2, [70], "e"),
    "p2_parent": P2,
    "p1_parent": P1,
}
# p2_m20 carries the same codon change as p1_m20 on the P2 background, so its aa matches p1_m20.
c20 = V["p1_m20"][60:63]
V["p2_m20"] = P2[:60] + c20 + P2[63:]
assert translate(V["p2_m20"]) == translate(V["p1_m20"]) and V["p2_m20"] != V["p1_m20"]
# A synonymous twin of p1_m5_m40: same aa, one extra synonymous change.
V["p1_m5_m40_syn"] = synonymous(V["p1_m5_m40"], 10, random.Random("f"))
assert translate(V["p1_m5_m40_syn"]) == translate(V["p1_m5_m40"])

SAMPLES = {
    "s1": {"p1_parent": 6, "p1_m5": 5, "p1_m5_m40": 4, "p1_m5_m40_syn": 2, "p1_m20": 3, "p1_stop30": 2},
    "s2": {"p2_parent": 7, "p2_m20": 4, "p2_m70": 3, "p1_m5": 2, "p1_fs50": 2, "p1_m60_m61": 5},
    "s3": {"p1_parent": 3, "p2_parent": 3, "p1_m20": 2, "p2_m20": 2, "p1_m60_m61": 1, "p1_m5_m40": 6,
           "p1_stop30": 3},
}


def reads(nt):
    r1 = PRE1 + A1 + LEAD + nt[:108] + SUF1
    r2 = PRE2 + A2 + rc(nt[108:219]) + SUF2
    return r1, r2


def write_base(out):
    with open(f"{out}/parents.fasta", "w") as f:
        f.write(f">P1\n{P1}\n>P2\n{P2}\n")
    for s, counts in SAMPLES.items():
        n = 0
        with gzip.GzipFile(f"{out}/{s}_R1.fastq.gz", "wb", mtime=0) as f1, \
             gzip.GzipFile(f"{out}/{s}_R2.fastq.gz", "wb", mtime=0) as f2:
            for name, c in counts.items():
                r1, r2 = reads(V[name])
                for _ in range(c):
                    n += 1
                    f1.write(f"@{s}.{n} {name}\n{r1}\n+\n{'I' * len(r1)}\n".encode())
                    f2.write(f"@{s}.{n} {name}\n{r2}\n+\n{'I' * len(r2)}\n".encode())
        print(s, "read pairs", n)
    write_empty(out)


def write_empty(out):
    r = random.Random("empty")
    with gzip.GzipFile(f"{out}/s0_R1.fastq.gz", "wb", mtime=0) as f1, \
         gzip.GzipFile(f"{out}/s0_R2.fastq.gz", "wb", mtime=0) as f2:
        for n in range(1, 7):
            r1, r2 = reads("".join(r.choice("ACGT") for _ in range(219)))
            f1.write(f"@s0.{n} none\n{r1}\n+\n{'I' * len(r1)}\n".encode())
            f2.write(f"@s0.{n} none\n{r2}\n+\n{'I' * len(r2)}\n".encode())
    print("s0 read pairs", 6)


# variant -> reads per molecule
UMI_SAMPLES = {
    "s1": {"p1_parent": [3, 2], "p1_m5": [2, 2, 1], "p1_m5_m40": [3], "p1_m20": [2], "p1_stop30": [2]},
    "s2": {"p2_parent": [2, 3], "p2_m20": [2], "p1_m5": [2], "p1_m60_m61": [3, 2], "p2_m70": [1]},
    "s3": {"p1_parent": [2], "p2_parent": [2], "p1_m20": [2], "p2_m20": [3], "p1_m5_m40": [2, 2, 2]},
}
UMI_LEN = 10
ERROR_AT = ("s1", "p1_m5_m40", 0, 2)  # sample, variant, molecule, read: one base wrong in R1


def write_umi(out):
    r = random.Random("umi")
    used = set()
    for s, mols in UMI_SAMPLES.items():
        n = 0
        with gzip.GzipFile(f"{out}/umi_{s}_R1.fastq.gz", "wb", mtime=0) as f1, \
             gzip.GzipFile(f"{out}/umi_{s}_R2.fastq.gz", "wb", mtime=0) as f2:
            for name, sizes in mols.items():
                r1, r2 = reads(V[name])
                for m, size in enumerate(sizes):
                    umi = "".join(r.choice("ACGT") for _ in range(UMI_LEN))
                    assert umi not in used
                    used.add(umi)
                    for k in range(size):
                        n += 1
                        u1 = PRE1 + umi + r1[len(PRE1):]
                        if (s, name, m, k) == ERROR_AT:
                            i = len(PRE1) + UMI_LEN + len(A1) + 40
                            u1 = u1[:i] + ("A" if u1[i] != "A" else "C") + u1[i + 1:]
                        f1.write(f"@{s}.{n} {name} {umi}\n{u1}\n+\n{'I' * len(u1)}\n".encode())
                        f2.write(f"@{s}.{n} {name} {umi}\n{r2}\n+\n{'I' * len(r2)}\n".encode())
        print(s, "umi read pairs", n)


def write_known_aa(out):
    present = [("K1", "p1_m5", "A", 1.5), ("K2", "p1_m20", "A", 0.25),
               ("K3", "p1_parent", "B", 2.0), ("K4", "p1_m5_m40", "B", 0.75)]
    absent = [("K5", mutate(P1, [45], "x"), "A", 3.0), ("K6", mutate(P1, [10, 11], "y"), "C", 0.5)]
    rows = [(k, translate(V[v]), g, sc) for k, v, g, sc in present]
    rows += [(k, translate(nt), g, sc) for k, nt, g, sc in absent]
    seen = {translate(V[v]) for c in SAMPLES.values() for v in c}
    assert all(r[1] not in seen for r in rows[4:])
    with open(f"{out}/known_aa.tsv", "w") as f:
        f.write("knownId\taaSequence\tgroup\tscore\n")
        for k, aa, g, sc in rows:
            f.write(f"{k}\t{aa}\t{g}\t{sc}\n")


def write_known_nt(out):
    present = [("N1", "p1_m5", "A", 1.5), ("N2", "p1_m20", "A", 0.25),
               ("N3", "p1_parent", "B", 2.0), ("N4", "p1_m5_m40", "B", 0.75)]
    absent = [("N5", mutate(P1, [45], "x"), "A", 3.0), ("N6", mutate(P1, [10, 11], "y"), "C", 0.5)]
    rows = [(k, V[v], g, sc) for k, v, g, sc in present] + absent
    seen = {V[v] for c in SAMPLES.values() for v in c}
    assert all(r[1] not in seen for r in rows[4:])
    with open(f"{out}/known_nt.tsv", "w") as f:
        f.write("knownId\tntSequence\tgroup\tscore\n")
        for k, nt, g, sc in rows:
            f.write(f"{k}\t{nt}\t{g}\t{sc}\n")


{"base": write_base, "umi": write_umi, "known-aa": write_known_aa,
 "known-nt": write_known_nt}[
    sys.argv[2] if len(sys.argv) > 2 else "base"](sys.argv[1])
