# ADR 015: Two-tier product-area gating for QM and SPC

## Status
Accepted (2026-06-11)

## Context
Plant onboarding is governed by site_config_plant flags via silver/_plant_gate.py product areas. Business rule (Tim Geldard): "A site may need QM reporting but not WM reporting; above that, a site might have QM reporting but not SPC."

## Decision
quality := ioreporting AND qm_enabled_flag (independent of wm_enabled_flag). A new spc_enabled_flag defines spc := quality AND spc_enabled_flag. The QM lot and usage-decision tables gate on "quality"; the QM result-grain family (QAMV/QAMR/QASR/QASE) and the governed SPC subgroup MV gate on "spc". The gate helper accepts multi-flag areas (_PRODUCT_AREA_FLAG values may be tuples).

## Consequences
SPC coverage follows the spc flag, not WM onboarding; a plant can be flipped out of SPC without losing QM reporting; the slow pipeline must rebuild site_config_plant before any spc-gated flow first runs (deploy-order note in the gate helper).
