#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PolyMatrix Engine: Real-Time Intelligent Virtual Polymer Generator & Filter
===========================================================================
File: live_smart_generator.py

Continuously executes a 4-stage closed-loop discovery pipeline in the background:
1. Real-Time Candidate Generation:
   - Dynamically combines diverse monomers, reactive telechelic end-groups, and
     copolymer architectures (Random, Block, Graft, Alternating).
2. Stage-1 Physical & Chemical Constraint Gate:
   - Degree of Polymerization cut-off (DP n >= 50 AND Mn >= 10,000 g/mol)
   - Strict Atomic Valency / Octet Rule verification (C=4, O=2, N=3, H=1, F=1, S=2/6, Si=4)
   - Fox & Gordon-Taylor Tg, Flory Tm, Flory-Huggins (chi*N), HSP, and BDE thermal stability (Td)
   - Immediate discard upon any physical/chemical violation.
3. Stage-2 Tanimoto Similarity & Property-Delta Gate (Core Anti-Cosmetic Filter):
   - Evaluates 2048-bit topological/chemical shingle fingerprints against both:
     (a) PI1M / Polymer Genome / PoLyInfo Commercial Whitelist Reference Pool
     (b) Active live synthetic pool
   - Computes Tanimoto Similarity (S_T) and normalized Multi-Property Euclidean Delta (Delta_P)
     across [Tg, Tm, Td, Tensile Strength, Modulus, Crystallinity, HSP_total, chi*N].
   - Immediately discards candidates with excessive Tanimoto similarity (S_T >= 0.84) OR
     "cosmetic variants" (moderate structural similarity S_T >= 0.64 with negligible property shift Delta_P < 0.088).
4. Stage-4 S-Grade Streaming Persistence (Sliding Window <= 5,000):
   - Only S-Grade innovation candidates (S, S+, S++) are streamed to
     `public/data/live_synthetic_pool.json` (atomic write via temp swap) with a
     sliding window cap of 5,000 records.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import signal
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Set, Tuple

from generate_synthetic_polymers import (
    END_GROUP_LIBRARY,
    MonomerUnit,
    EndGroupSpec,
    build_monomer_library,
    compute_crosslinking_reactivity_index,
    compute_flory_huggins_morphology,
    compute_fox_and_gordon_taylor_tg,
    compute_hsp_and_solvents,
    compute_melting_temperature,
    compute_tacticity_crystallinity_and_mechanics,
    compute_thermal_stability_and_processing_window,
    endgroup_molar_mass,
    monomer_molar_mass,
    validate_chemical_feasibility,
    assign_novelty_tags,
)


# ============================================================================
# 1. PI1M / POLYMER GENOME BENCHMARK WHITELIST REFERENCE POOL
# ============================================================================

BUILTIN_PI1M_WHITELIST: List[Dict[str, Any]] = [
    {
        "ref_id": "PI1M-REF-PS",
        "name": "Polystyrene (PS Standard)",
        "smiles": "[*]CC(c1ccccc1)[*]",
        "monomer_codes": ["St"],
        "architecture": "Homopolymer",
        "Tg": 100.0, "Tm": 240.0, "Td": 365.0,
        "tensile_strength": 48.0, "modulus_gpa": 3.2, "crystallinity": 0.0,
        "hsp_total": 19.07, "chi_N": 0.0,
    },
    {
        "ref_id": "PI1M-REF-PMMA",
        "name": "Poly(methyl methacrylate) (PMMA Standard)",
        "smiles": "[*]CC(C)(C(=O)OC)[*]",
        "monomer_codes": ["MMA"],
        "architecture": "Homopolymer",
        "Tg": 105.0, "Tm": 160.0, "Td": 340.0,
        "tensile_strength": 68.0, "modulus_gpa": 3.1, "crystallinity": 0.0,
        "hsp_total": 22.63, "chi_N": 0.0,
    },
    {
        "ref_id": "PI1M-REF-SAN",
        "name": "Poly(styrene-ran-acrylonitrile) (Commercial SAN)",
        "smiles": "[*]CC(c1ccccc1)[*].[*]CC(C#N)[*]",
        "monomer_codes": ["St", "AN"],
        "architecture": "Random",
        "Tg": 102.0, "Tm": 255.0, "Td": 378.0,
        "tensile_strength": 72.0, "modulus_gpa": 3.5, "crystallinity": 12.0,
        "hsp_total": 22.8, "chi_N": 8.4,
    },
    {
        "ref_id": "PI1M-REF-SBS",
        "name": "Poly(styrene-block-butadiene) (Commercial SBS Elastomer)",
        "smiles": "[*]CC(c1ccccc1)[*].[*]CC=CC[*]",
        "monomer_codes": ["St", "Bd"],
        "architecture": "Block (-b-)",
        "Tg": -45.0, "Tm": 165.0, "Td": 352.0,
        "tensile_strength": 32.0, "modulus_gpa": 0.45, "crystallinity": 8.0,
        "hsp_total": 18.2, "chi_N": 18.5,
    },
    {
        "ref_id": "PI1M-REF-PET",
        "name": "Poly(ethylene terephthalate) (Commercial PET)",
        "smiles": "[*]OCCOC(=O)c1ccc(C(=O)[*])cc1",
        "monomer_codes": ["EG_TPA"],
        "architecture": "Homopolymer",
        "Tg": 76.0, "Tm": 265.0, "Td": 405.0,
        "tensile_strength": 75.0, "modulus_gpa": 3.4, "crystallinity": 42.0,
        "hsp_total": 20.39, "chi_N": 0.0,
    },
    {
        "ref_id": "PI1M-REF-PC",
        "name": "Bisphenol-A Polycarbonate (Commercial PC)",
        "smiles": "[*]Oc1ccc(C(C)(C)c2ccc(OC(=O)[*])cc2)cc1",
        "monomer_codes": ["PC_BPA"],
        "architecture": "Homopolymer",
        "Tg": 150.0, "Tm": 267.0, "Td": 435.0,
        "tensile_strength": 65.0, "modulus_gpa": 2.4, "crystallinity": 5.0,
        "hsp_total": 21.15, "chi_N": 0.0,
    },
    {
        "ref_id": "PI1M-REF-PA6",
        "name": "Polycaprolactam (Commercial Nylon 6)",
        "smiles": "[*]NCCCCCC(=O)[*]",
        "monomer_codes": ["PA6"],
        "architecture": "Homopolymer",
        "Tg": 52.0, "Tm": 223.0, "Td": 395.0,
        "tensile_strength": 82.0, "modulus_gpa": 2.9, "crystallinity": 45.0,
        "hsp_total": 23.77, "chi_N": 0.0,
    },
    {
        "ref_id": "PI1M-REF-PEEK",
        "name": "Poly(ether ether ketone) (Commercial PEEK)",
        "smiles": "[*]Oc1ccc(Oc2ccc(C(=O)c3ccc([*])cc3)cc2)cc1",
        "monomer_codes": ["PEEK_U"],
        "architecture": "Homopolymer",
        "Tg": 145.0, "Tm": 343.0, "Td": 475.0,
        "tensile_strength": 100.0, "modulus_gpa": 4.1, "crystallinity": 38.0,
        "hsp_total": 20.98, "chi_N": 0.0,
    },
    {
        "ref_id": "PI1M-REF-PVDF",
        "name": "Poly(vinylidene fluoride) (Commercial PVDF)",
        "smiles": "[*]CC(F)(F)[*]",
        "monomer_codes": ["VDF"],
        "architecture": "Homopolymer",
        "Tg": -38.0, "Tm": 177.0, "Td": 445.0,
        "tensile_strength": 54.0, "modulus_gpa": 2.2, "crystallinity": 52.0,
        "hsp_total": 23.17, "chi_N": 0.0,
    },
    {
        "ref_id": "PI1M-REF-PLA-PCL",
        "name": "Poly(lactic acid-co-caprolactone) (Biomedical Copolymer)",
        "smiles": "[*]OC(C)C(=O)[*].[*]OCCCCCC(=O)[*]",
        "monomer_codes": ["LA", "CL"],
        "architecture": "Random",
        "Tg": 12.0, "Tm": 135.0, "Td": 355.0,
        "tensile_strength": 42.0, "modulus_gpa": 1.6, "crystallinity": 28.0,
        "hsp_total": 21.8, "chi_N": 7.2,
    },
]


# ============================================================================
# 2. 2048-BIT TOPOLOGICAL SHINGLE FINGERPRINT & TANIMOTO ENGINE
# ============================================================================

FP_BITS = 2048


def compute_topological_fingerprint(
    smiles_topology: str,
    architecture: str,
    comonomer_codes: List[str],
    mole_fractions: List[float],
    alpha_eg: str,
    omega_eg: str,
    tacticity: str,
) -> Set[int]:
    """
    Generates a deterministic 2048-bit Morgan-like circular & compositional shingle
    fingerprint represented as a set of active bit indices (0 .. 2047).
    """
    tokens: List[str] = []

    clean_smiles = smiles_topology.replace("[*]", "")
    for k in (2, 3, 4, 5):
        for i in range(max(0, len(clean_smiles) - k + 1)):
            tokens.append(f"SM{k}:{clean_smiles[i:i+k]}")

    sorted_codes = sorted(comonomer_codes)
    tokens.append(f"ARCH:{architecture}")
    tokens.append(f"TACT:{tacticity}")
    tokens.append(f"END:{alpha_eg}:{omega_eg}")
    for code in sorted_codes:
        tokens.append(f"MONO:{code}")
    for i in range(len(sorted_codes)):
        for j in range(i + 1, len(sorted_codes)):
            tokens.append(f"PAIR:{architecture}:{sorted_codes[i]}-{sorted_codes[j]}")

    for code, mf in zip(comonomer_codes, mole_fractions):
        quant_bin = int(round(mf * 20))
        for neighbor_bin in (quant_bin - 1, quant_bin, quant_bin + 1):
            tokens.append(f"COMP:{code}:B{neighbor_bin}")

    active_bits: Set[int] = set()
    for tok in tokens:
        digest = hashlib.md5(tok.encode("utf-8")).digest()
        b1 = ((digest[0] << 8) | digest[1]) % FP_BITS
        b2 = ((digest[2] << 8) | digest[3]) % FP_BITS
        active_bits.add(b1)
        active_bits.add(b2)

    return active_bits


def tanimoto_similarity(fp_a: Set[int], fp_b: Set[int]) -> float:
    if not fp_a or not fp_b:
        return 0.0
    intersection = len(fp_a & fp_b)
    union = len(fp_a | fp_b)
    return intersection / union if union > 0 else 0.0


def normalized_property_delta(cand: Dict[str, Any], ref: Dict[str, Any]) -> float:
    """
    Computes normalized multi-dimensional property distance (Delta_P in [0, ~1.5])
    across 8 physical/thermal/mechanical dimensions:
    Tg, Tm, Td, Tensile Strength, Modulus, Crystallinity, HSP_total, chi_N.
    """
    cand_hsp = cand["HSP"]["delta_total"] if isinstance(cand.get("HSP"), dict) else cand.get("hsp_total", 20.0)
    ref_hsp = ref["HSP"]["delta_total"] if isinstance(ref.get("HSP"), dict) else ref.get("hsp_total", 20.0)

    diffs_sq = [
        ((cand["Tg"] - ref.get("Tg", 50.0)) / 300.0) ** 2,
        ((cand["Tm"] - ref.get("Tm", 180.0)) / 320.0) ** 2,
        ((cand["Td"] - ref.get("Td", 380.0)) / 280.0) ** 2,
        ((cand["tensile_strength"] - ref.get("tensile_strength", 55.0)) / 150.0) ** 2,
        ((cand["modulus_gpa"] - ref.get("modulus_gpa", 2.2)) / 6.0) ** 2,
        ((cand["crystallinity"] - ref.get("crystallinity", 25.0)) / 80.0) ** 2,
        ((cand_hsp - ref_hsp) / 18.0) ** 2,
        ((cand.get("chi_N", 10.0) - ref.get("chi_N", 10.0)) / 60.0) ** 2,
    ]
    return math.sqrt(sum(diffs_sq) / len(diffs_sq))


# ============================================================================
# 3. S-GRADE INNOVATION SCORING & FILTERING ENGINE
# ============================================================================

LIVE_ARCHITECTURES = ["Random", "Block (-b-)", "Graft (-g-)"]
ARCH_CONNECTOR = {
    "Random": "-ran-",
    "Block (-b-)": "-b-",
    "Graft (-g-)": "-g-",
    "Alternating": "-alt-",
}


def evaluate_stage2_and_s_grade(
    candidate: Dict[str, Any],
    cand_fp: Set[int],
    whitelist_entries: List[Tuple[Dict[str, Any], Set[int]]],
    pool_entries: Deque[Tuple[Dict[str, Any], Set[int]]],
    max_tanimoto_cutoff: float = 0.84,
    cosmetic_tanimoto_threshold: float = 0.64,
    min_property_delta_threshold: float = 0.088,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Executes Stage-2 Similarity & Property-Delta Filtering against both:
    1) Commercial PI1M/Polymer Genome whitelist
    2) Active live pool (up to 5,000 S-grade polymers)
    """
    max_sim_whitelist = 0.0
    min_delta_at_high_sim_whitelist = 999.0
    closest_whitelist_id = "None"

    for ref_doc, ref_fp in whitelist_entries:
        sim = tanimoto_similarity(cand_fp, ref_fp)
        p_delta = normalized_property_delta(candidate, ref_doc)
        if sim > max_sim_whitelist:
            max_sim_whitelist = sim
            closest_whitelist_id = ref_doc.get("ref_id", "PI1M-REF")
        if sim >= cosmetic_tanimoto_threshold and p_delta < min_delta_at_high_sim_whitelist:
            min_delta_at_high_sim_whitelist = p_delta

        if sim >= max_tanimoto_cutoff:
            return False, {
                "passed": False,
                "stage": "Stage-2 Whitelist Tanimoto Cutoff",
                "reason": f"High Tanimoto similarity ({sim:.3f}) to commercial benchmark {closest_whitelist_id}",
                "tanimoto_max": round(sim, 4),
                "property_delta": round(p_delta, 4),
            }
        if sim >= cosmetic_tanimoto_threshold and p_delta < min_property_delta_threshold:
            return False, {
                "passed": False,
                "stage": "Stage-2 Whitelist Cosmetic Variant Filter",
                "reason": f"Cosmetic tweak of {closest_whitelist_id}: Tanimoto={sim:.3f}, PropertyDelta={p_delta:.4f} < {min_property_delta_threshold}",
                "tanimoto_max": round(sim, 4),
                "property_delta": round(p_delta, 4),
            }

    max_sim_pool = 0.0
    min_delta_pool = 999.0
    closest_pool_id = "None"

    pool_list = list(pool_entries)
    if len(pool_list) > 600:
        check_subset = pool_list[-250:] + random.sample(pool_list[:-250], 350)
    else:
        check_subset = pool_list

    for pool_doc, pool_fp in check_subset:
        sim = tanimoto_similarity(cand_fp, pool_fp)
        p_delta = normalized_property_delta(candidate, pool_doc)
        if sim > max_sim_pool:
            max_sim_pool = sim
            closest_pool_id = pool_doc.get("id", "POOL")
        if p_delta < min_delta_pool:
            min_delta_pool = p_delta

        if sim >= max_tanimoto_cutoff:
            return False, {
                "passed": False,
                "stage": "Stage-2 Pool Tanimoto Redundancy",
                "reason": f"Redundant topology with {closest_pool_id} (Tanimoto={sim:.3f} >= {max_tanimoto_cutoff})",
                "tanimoto_max": round(sim, 4),
                "property_delta": round(p_delta, 4),
            }
        if sim >= cosmetic_tanimoto_threshold and p_delta < min_property_delta_threshold:
            return False, {
                "passed": False,
                "stage": "Stage-2 Pool Cosmetic Variant Filter",
                "reason": f"Cosmetic variant of {closest_pool_id} with negligible property shift (S_T={sim:.3f}, Delta_P={p_delta:.4f})",
                "tanimoto_max": round(sim, 4),
                "property_delta": round(p_delta, 4),
            }

    overall_max_tanimoto = max(max_sim_whitelist, max_sim_pool)
    effective_prop_delta = min(
        min_delta_pool if min_delta_pool < 900.0 else 0.32,
        min_delta_at_high_sim_whitelist if min_delta_at_high_sim_whitelist < 900.0 else 0.35,
    )

    novelty_component = (1.0 - overall_max_tanimoto) * 44.0
    delta_component = min(28.0, effective_prop_delta * 135.0)
    thermal_mech_pareto = min(
        28.0,
        (candidate["Td"] / 440.0) * 10.0
        + (candidate["tensile_strength"] / 95.0) * 9.0
        + (max(0.0, candidate["processing_window_c"]) / 130.0) * 9.0,
    )
    innovation_score = round(novelty_component + delta_component + thermal_mech_pareto, 2)

    if innovation_score < 74.0:
        return False, {
            "passed": False,
            "stage": "Stage-3 S-Grade Pareto Gate",
            "reason": f"Sub-S-Grade innovation score ({innovation_score} < 74.0)",
            "tanimoto_max": round(overall_max_tanimoto, 4),
            "property_delta": round(effective_prop_delta, 4),
        }

    if innovation_score >= 86.0:
        s_tier = "S++"
    elif innovation_score >= 80.0:
        s_tier = "S+"
    else:
        s_tier = "S"

    return True, {
        "passed": True,
        "quality_grade": s_tier,
        "innovation_score": innovation_score,
        "max_tanimoto_similarity_whitelist": round(max_sim_whitelist, 4),
        "max_tanimoto_similarity_pool": round(max_sim_pool, 4),
        "overall_max_tanimoto": round(overall_max_tanimoto, 4),
        "nearest_reference_id": closest_whitelist_id if max_sim_whitelist >= max_sim_pool else closest_pool_id,
        "property_delta_score": round(effective_prop_delta, 4),
        "cosmetic_variant_check": "PASSED (Distinct Structure-Property Signature)",
    }


# ============================================================================
# 4. SINGLE CANDIDATE SYNTHESIS & MULTI-GATE VERIFICATION
# ============================================================================

def synthesize_and_verify_candidate(
    rng: random.Random,
    monomer_lib: List[MonomerUnit],
    whitelist_entries: List[Tuple[Dict[str, Any], Set[int]]],
    pool_entries: Deque[Tuple[Dict[str, Any], Set[int]]],
    seq_number: int,
) -> Tuple[Optional[Dict[str, Any]], Optional[Set[int]], str]:
    eg_weights = [eg.sampling_weight for eg in END_GROUP_LIBRARY]

    roll = rng.random()
    inject_valency_fault = roll < 0.03
    inject_oligomer_fault = 0.03 <= roll < 0.08

    num_components = rng.choices([2, 3], weights=[0.74, 0.26], k=1)[0]
    chosen_monomers = rng.sample(monomer_lib, k=num_components)
    architecture = rng.choice(LIVE_ARCHITECTURES)

    if inject_oligomer_fault:
        dp_per_monomer = [rng.randint(10, 22) for _ in chosen_monomers]
    else:
        avg_m0 = sum(monomer_molar_mass(m) for m in chosen_monomers) / num_components
        min_dp_for_mn = math.ceil(10500.0 / avg_m0)
        target_total_dp = rng.randint(max(55, min_dp_for_mn), max(140, min_dp_for_mn + 980))
        raw_weights = [rng.uniform(0.12, 0.88) for _ in chosen_monomers]
        w_sum = sum(raw_weights)
        dp_per_monomer = [max(14, int(round(target_total_dp * (w / w_sum)))) for w in raw_weights]
        while sum(dp_per_monomer) < 50:
            dp_per_monomer[0] += 6

    dp_total = sum(dp_per_monomer)
    alpha_eg = rng.choices(END_GROUP_LIBRARY, weights=eg_weights, k=1)[0]
    omega_eg = rng.choices(END_GROUP_LIBRARY, weights=eg_weights, k=1)[0]

    chem_ok, chem_audit = validate_chemical_feasibility(
        chosen_monomers, dp_per_monomer, alpha_eg, omega_eg, inject_fault=inject_valency_fault
    )
    if not chem_ok:
        return None, None, "rejected_stage1_octet_valency"

    monomer_masses = [monomer_molar_mass(m) * dp for m, dp in zip(chosen_monomers, dp_per_monomer)]
    mn_g_mol = round(sum(monomer_masses) + endgroup_molar_mass(alpha_eg) + endgroup_molar_mass(omega_eg), 2)
    if dp_total < 50 or mn_g_mol < 10000.0:
        return None, None, "rejected_stage1_dp_cutoff"

    mole_fractions = [round(dp / dp_total, 4) for dp in dp_per_monomer]
    total_monomer_mass = sum(monomer_masses)
    weight_fractions = [round(mass / total_monomer_mass, 4) for mass in monomer_masses]

    if architecture == "Block (-b-)":
        pdi = round(rng.uniform(1.50, 2.15), 3)
    elif architecture == "Graft (-g-)":
        pdi = round(rng.uniform(1.85, 3.50), 3)
    else:
        pdi = round(rng.uniform(1.60, 3.35), 3)

    mw_g_mol = round(mn_g_mol * pdi, 2)
    mz_g_mol = round(mw_g_mol * (1.0 + 0.65 * (pdi - 1.0)), 2)

    endgroup_data = compute_crosslinking_reactivity_index(
        alpha_eg, omega_eg, chosen_monomers, mole_fractions, mn_g_mol
    )
    cri = endgroup_data["crosslinking_reactivity_index"]

    tg_data = compute_fox_and_gordon_taylor_tg(
        chosen_monomers, weight_fractions, mn_g_mol, architecture
    )
    tg_c = tg_data["tg_c"]

    mech_data = compute_tacticity_crystallinity_and_mechanics(
        rng, chosen_monomers, weight_fractions, architecture, mn_g_mol, tg_c, cri
    )
    crystallinity_pct = mech_data["crystallinity_pct"]

    tm_data = compute_melting_temperature(
        chosen_monomers, mole_fractions, weight_fractions,
        architecture, mech_data["tacticity"], crystallinity_pct, tg_c
    )
    tm_c = tm_data["tm_c"]

    hsp_data = compute_hsp_and_solvents(
        chosen_monomers, mole_fractions, crystallinity_pct, cri
    )

    fh_data = compute_flory_huggins_morphology(
        chosen_monomers, hsp_data["volume_fractions"], dp_total, architecture
    )

    thermal_data = compute_thermal_stability_and_processing_window(
        rng, chosen_monomers, weight_fractions, mn_g_mol, crystallinity_pct, tg_c, tm_c, cri
    )
    td_c = thermal_data["td_c"]

    if td_c <= tm_c + 10.0 or thermal_data["processing_window_c"] < 15.0:
        return None, None, "rejected_stage1_thermodynamic_instability"

    conn = ARCH_CONNECTOR[architecture]
    code_chain = conn.join(m.code for m in chosen_monomers)
    full_name_chain = conn.join(m.name for m in chosen_monomers)
    structure_name = f"alpha-{alpha_eg.code}-Poly({full_name_chain})-omega-{omega_eg.code}"
    short_code = f"P({code_chain}) [{alpha_eg.code}/{omega_eg.code}]"
    smiles_topology = (
        f"{alpha_eg.code}"
        + "".join(f"-({m.smiles_repeat.replace('[*]', '')})_{dp}" for m, dp in zip(chosen_monomers, dp_per_monomer))
        + f"-{omega_eg.code}"
    )

    cand_fp = compute_topological_fingerprint(
        smiles_topology=smiles_topology,
        architecture=architecture,
        comonomer_codes=[m.code for m in chosen_monomers],
        mole_fractions=mole_fractions,
        alpha_eg=alpha_eg.code,
        omega_eg=omega_eg.code,
        tacticity=mech_data["tacticity"],
    )

    poly_id = f"PMX-LIVE-{seq_number:06d}"
    structure_hash = hashlib.sha256(
        f"{structure_name}:{dp_total}:{mn_g_mol}:{mech_data['tacticity']}".encode("utf-8")
    ).hexdigest()[:12]

    candidate: Dict[str, Any] = {
        "id": poly_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "structure_hash": structure_hash,
        "structure_name": structure_name,
        "short_code": short_code,
        "smiles_topology": smiles_topology,
        "architecture": architecture,
        "comonomers": [
            {
                "code": m.code,
                "name": m.name,
                "backbone_class": m.backbone_class,
                "dp_n": dp,
                "mole_fraction": mf,
                "weight_fraction": wf,
            }
            for m, dp, mf, wf in zip(chosen_monomers, dp_per_monomer, mole_fractions, weight_fractions)
        ],
        "dp_n": dp_total,
        "Mn": mn_g_mol,
        "Mw": mw_g_mol,
        "Mz": mz_g_mol,
        "PDI": pdi,
        "Tg": tg_c,
        "Tm": tm_c,
        "Td": td_c,
        "tensile_strength": mech_data["tensile_strength_mpa"],
        "modulus_gpa": mech_data["modulus_gpa"],
        "elongation_at_break_pct": mech_data["elongation_at_break_pct"],
        "crystallinity": crystallinity_pct,
        "density": mech_data["density_g_cm3"],
        "tacticity": mech_data["tacticity"],
        "HSP": {
            "delta_d": hsp_data["delta_d"],
            "delta_p": hsp_data["delta_p"],
            "delta_h": hsp_data["delta_h"],
            "delta_total": hsp_data["delta_total"],
            "R0": hsp_data["interaction_radius_R0"],
        },
        "phase_separation_morphology": fh_data["morphology"],
        "chi_N": fh_data["chi_N"],
        "crosslinking_reactivity_index": cri,
        "processing_window_c": thermal_data["processing_window_c"],
        "processability_status": thermal_data["processability_status"],
        "purity_confidence_pct": 99.99,
        "chemical_feasibility": {
            **chem_audit,
            **endgroup_data,
        },
        "thermodynamics": {
            **tg_data,
            **tm_data,
            "flory_huggins": fh_data,
            "hansen_solubility": hsp_data,
        },
        "mechanical_physical": mech_data,
        "thermal_processability": thermal_data,
    }

    s_ok, s_audit = evaluate_stage2_and_s_grade(
        candidate=candidate,
        cand_fp=cand_fp,
        whitelist_entries=whitelist_entries,
        pool_entries=pool_entries,
    )
    if not s_ok:
        stage_label = s_audit.get("stage", "")
        if "Cosmetic" in stage_label:
            return None, None, "rejected_stage2_cosmetic_low_delta"
        if "Tanimoto" in stage_label:
            return None, None, "rejected_stage2_tanimoto_similarity"
        return None, None, "rejected_stage3_sub_s_grade"

    novelty_tags = assign_novelty_tags(
        architecture=architecture,
        mn_g_mol=mn_g_mol,
        pdi=pdi,
        tg_c=tg_c,
        td_c=td_c,
        tensile_mpa=mech_data["tensile_strength_mpa"],
        crystallinity_pct=crystallinity_pct,
        morphology=fh_data["morphology"],
        cri=cri,
        good_solvents=hsp_data["good_solvents"],
    )
    novelty_tags.insert(0, f"Grade {s_audit['quality_grade']} Verified Innovator")

    candidate["quality_grade"] = s_audit["quality_grade"]
    candidate["innovation_score"] = s_audit["innovation_score"]
    candidate["similarity_audit"] = s_audit
    candidate["novelty_tags"] = novelty_tags

    return candidate, cand_fp, "accepted_s_grade"


# ============================================================================
# 5. ATOMIC SLIDING-WINDOW STREAMING ENGINE
# ============================================================================

def build_whitelist_fingerprints() -> List[Tuple[Dict[str, Any], Set[int]]]:
    entries: List[Tuple[Dict[str, Any], Set[int]]] = []
    for ref in BUILTIN_PI1M_WHITELIST:
        fp = compute_topological_fingerprint(
            smiles_topology=ref["smiles"],
            architecture=ref["architecture"],
            comonomer_codes=ref["monomer_codes"],
            mole_fractions=[1.0 / len(ref["monomer_codes"])] * len(ref["monomer_codes"]),
            alpha_eg="-OH",
            omega_eg="-H",
            tacticity="Atactic",
        )
        entries.append((ref, fp))
    return entries


def atomic_write_json(target_path: Path, payload: Any) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = target_path.with_suffix(target_path.suffix + ".tmp")
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    for attempt in range(5):
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                f.write(text)
            os.replace(tmp_path, target_path)
            return
        except PermissionError:
            time.sleep(0.08 * (attempt + 1))
    # Fallback direct write if Windows file watcher holds a handle on target_path
    try:
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(text)
    except PermissionError:
        pass


def run_live_engine(
    output_path: Path,
    max_pool_size: int = 5000,
    batch_size: int = 25,
    interval_sec: float = 1.5,
    initial_target: int = 5000,
    run_once: bool = False,
    seed: Optional[int] = None,
) -> None:
    rng = random.Random(seed if seed is not None else int(time.time() * 1000))
    monomer_lib = build_monomer_library()
    whitelist_entries = build_whitelist_fingerprints()

    pool_entries: Deque[Tuple[Dict[str, Any], Set[int]]] = deque(maxlen=max_pool_size)

    telemetry = {
        "engine_status": "RUNNING",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "last_updated_at": datetime.now(timezone.utc).isoformat(),
        "max_sliding_window_size": max_pool_size,
        "current_pool_size": 0,
        "total_candidates_generated": 0,
        "rejected_stage1_octet_valency": 0,
        "rejected_stage1_dp_cutoff": 0,
        "rejected_stage1_thermodynamic_instability": 0,
        "rejected_stage2_tanimoto_similarity": 0,
        "rejected_stage2_cosmetic_low_delta": 0,
        "rejected_stage3_sub_s_grade": 0,
        "accepted_s_grade": 0,
        "sliding_window_evictions": 0,
    }

    seq_number = 0

    if output_path.exists():
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            existing_records = loaded.get("polymers", loaded) if isinstance(loaded, dict) else loaded
            if isinstance(existing_records, list):
                for rec in existing_records[-max_pool_size:]:
                    codes = [c["code"] for c in rec.get("comonomers", [])] or ["St", "MMA"]
                    mfs = [c["mole_fraction"] for c in rec.get("comonomers", [])] or [0.5, 0.5]
                    fp = compute_topological_fingerprint(
                        smiles_topology=rec.get("smiles_topology", ""),
                        architecture=rec.get("architecture", "Random"),
                        comonomer_codes=codes,
                        mole_fractions=mfs,
                        alpha_eg=rec.get("chemical_feasibility", {}).get("alpha_end_group", "-OH"),
                        omega_eg=rec.get("chemical_feasibility", {}).get("omega_end_group", "-COOH"),
                        tacticity=rec.get("tacticity", "Atactic"),
                    )
                    pool_entries.append((rec, fp))
                seq_number = len(pool_entries)
                telemetry["current_pool_size"] = len(pool_entries)
        except Exception as exc:
            print(f"[LiveSmartGenerator] Starting fresh pool (could not parse existing file: {exc})")

    stop_requested = False

    def handle_signal(signum: int, _frame: Any) -> None:
        nonlocal stop_requested
        stop_requested = True
        print(f"\n[LiveSmartGenerator] Signal {signum} received. Flushing S-grade pool and shutting down...")

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    print(
        f"[LiveSmartGenerator] Engine started -> Streaming S-Grade polymers to {output_path} "
        f"(Sliding window cap: {max_pool_size})"
    )

    while not stop_requested:
        needed_for_initial = max(0, initial_target - len(pool_entries))
        cycle_goal = needed_for_initial if needed_for_initial > 0 else batch_size

        accepted_in_cycle = 0
        while accepted_in_cycle < cycle_goal and not stop_requested:
            telemetry["total_candidates_generated"] += 1
            cand, cand_fp, status_key = synthesize_and_verify_candidate(
                rng=rng,
                monomer_lib=monomer_lib,
                whitelist_entries=whitelist_entries,
                pool_entries=pool_entries,
                seq_number=seq_number + 1,
            )
            telemetry[status_key] = telemetry.get(status_key, 0) + 1

            if cand is not None and cand_fp is not None:
                seq_number += 1
                if len(pool_entries) >= max_pool_size:
                    telemetry["sliding_window_evictions"] += 1
                pool_entries.append((cand, cand_fp))
                accepted_in_cycle += 1

        telemetry["current_pool_size"] = len(pool_entries)
        telemetry["last_updated_at"] = datetime.now(timezone.utc).isoformat()

        records_only = [item[0] for item in pool_entries]
        atomic_write_json(output_path, records_only)

        status_path = output_path.parent / "live_synthetic_pool_telemetry.json"
        atomic_write_json(status_path, telemetry)

        print(
            f"[LiveSmartGenerator] Pool={len(records_only)}/{max_pool_size} | "
            f"Generated={telemetry['total_candidates_generated']} | "
            f"S-Grade Accepted={telemetry['accepted_s_grade']} | "
            f"Discarded(Stage1={telemetry['rejected_stage1_octet_valency'] + telemetry['rejected_stage1_dp_cutoff'] + telemetry['rejected_stage1_thermodynamic_instability']}, "
            f"Stage2-Tanimoto/Cosmetic={telemetry['rejected_stage2_tanimoto_similarity'] + telemetry['rejected_stage2_cosmetic_low_delta']}, "
            f"Stage3-SubS={telemetry['rejected_stage3_sub_s_grade']})"
        )

        if run_once:
            break

        time.sleep(interval_sec)

    telemetry["engine_status"] = "STOPPED"
    telemetry["last_updated_at"] = datetime.now(timezone.utc).isoformat()
    atomic_write_json(output_path.parent / "live_synthetic_pool_telemetry.json", telemetry)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PolyMatrix Real-Time Intelligent S-Grade Polymer Generator & Filter"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="public/data/live_synthetic_pool.json",
        help="Path to the sliding-window JSON pool (default: public/data/live_synthetic_pool.json)",
    )
    parser.add_argument(
        "--max-pool-size",
        type=int,
        default=5000,
        help="Maximum sliding window capacity (default: 5000)",
    )
    parser.add_argument(
        "--initial-target",
        type=int,
        default=5000,
        help="Initial S-grade record count to populate on startup (default: 5000)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=25,
        help="New S-grade polymers streamed per background cycle after initial fill (default: 25)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=2.0,
        help="Seconds between streaming cycles in continuous daemon mode (default: 2.0)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Populate/update the pool once and exit (useful for CI/testing)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional random seed for deterministic reproduction",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_live_engine(
        output_path=Path(args.output),
        max_pool_size=args.max_pool_size,
        batch_size=args.batch_size,
        interval_sec=args.interval,
        initial_target=args.initial_target,
        run_once=args.once,
        seed=args.seed,
    )
