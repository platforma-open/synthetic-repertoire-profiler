# Overview

Analyzes sequencing data from synthetic or designed antibody/TCR libraries built on one or more known parent (reference) sequences. This block is specialized for amplicon libraries where diversity is introduced into defined regions of a fixed backbone — for example phage or yeast display campaigns, deep mutational scanning (DMS) experiments, or rationally designed variant libraries.

Reads are aligned directly against the user-provided parent sequences (rather than a germline gene database), mutations are called relative to each parent, and identical variants are collapsed into a single repertoire of nucleotide and amino-acid variants with per-sample abundances. An amino-acid state matrix (and, optionally, a nucleotide state matrix) records the residue at every position of every variant for downstream mutational analysis. When a set of known variants is supplied, each variant is additionally assigned to its matching known entry.

Unlike the MiXCR Clonotyping block, which discovers novel clonotypes by aligning to a germline gene database, this block aligns reads against explicit reference backbones. This makes it suited to precise analysis of randomized regions and detailed quality control of synthetic libraries.

The output variant dataset can then be used in downstream blocks for deeper analysis, such as tracking variants in the Clonotype Browser block, diversity assessment, or building antibody/TCR lead lists for functional characterization.

This block is powered by MiTool, developed by MiLaboratories Inc. For more information, please see the [MiLaboratories website](https://milaboratories.com/).
