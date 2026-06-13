/**
 * Lineside Monitor — PEX-E-35
 *
 * Six rotating panels for wallboard display:
 *   0  Now Running     — orders currently active on the line
 *   1  Current Activity — current operation phase per order
 *   2  What's Next      — next orders queued for the line
 *   3  Blocked / At-Risk — orders with flags (late, shortage, etc.)
 *   4  Staging Readiness — component / WM staging status
 *   5  Plan vs Actual   — yield and GR completion
 *
 * FRESHNESS NOTE (ADR-017):
 * Elapsed time and projected finish are computed at query time in the gold _live serving
 * view (not in the DLT @dlt.table function). The STALE banner fires when data age exceeds
 * 2 × refreshInterval.  Until ADR-017 cadence is live the gold pipeline runs daily —
 * the board shows a persistent STALE banner in that regime.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  WmLinesideNowItem,
  WmLinesideNextItem,
  WmLinesideBlockedItem,
  WmLinesideStagingItem,
  WmLinesidePlanActualItem,
  WmLinesideLine,
  WmLinesideRequest,
} from '../adapters/wm-operations-adapter.js'
import {
  useWmLinesideNow,
  useWmLinesideNext,
  useWmLinesideBlocked,
  useWmLinesideStaging,
  useWmLinesidePlanActual,
  useWmLinesideLines,
} from '../adapters/wm-operations-queries.js'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const PANEL_COUNT = 6
const DEFAULT_ROTATION_S = 30
const DEFAULT_REFRESH_MS = 60_000

// ── CSS ───────────────────────────────────────────────────────────────────────

const styles = `
.kerry-wm-lineside {
  --forest: #143700;
  --valentia-slate: #005776;
  --jade: #44cf93;
  --sunrise: #f59e0b;
  --sunset: #ef4444;
  --ls-bg: #dde3e5;
  --ls-card: #fff;
  --ls-fg: #143c5a;
  --ls-fg-2: #6b8392;
  --ls-border: #c9d2d6;
  --ls-ok: #15803d;
  --ls-warn: #d97706;
  --ls-bad: #d32f2f;
  --ls-stale-bg: rgba(239,68,68,0.10);
  --ls-stale-fg: #991b1b;
  --font-sans: Noto Sans, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  display: grid;
  grid-template-rows: 64px 56px auto 1fr 36px;
  min-height: 100vh;
  background: var(--ls-bg);
  color: var(--ls-fg);
  font-family: var(--font-sans);
}

/* Header */
.kerry-wm-lineside .ls-head {
  background: var(--valentia-slate);
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 16px;
}
.kerry-wm-lineside .ls-brand { display: flex; align-items: center; gap: 16px; }
.kerry-wm-lineside .ls-logo { font-weight: 900; letter-spacing: 0.08em; font-size: 18px; }
.kerry-wm-lineside .ls-logo span { color: var(--jade); }
.kerry-wm-lineside .ls-brand .sep { width: 1px; height: 28px; background: rgba(255,255,255,0.18); }
.kerry-wm-lineside .ls-brand .title { font-weight: 800; text-transform: uppercase; font-size: 16px; letter-spacing: 0.04em; }
.kerry-wm-lineside .ls-head-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.kerry-wm-lineside .ls-iconbtn {
  width: 38px; height: 38px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.20);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  font-size: 15px;
}
.kerry-wm-lineside .ls-iconbtn:hover { background: rgba(255,255,255,0.10); }

/* Context bar */
.kerry-wm-lineside .ls-ctx {
  background: #fff;
  border-bottom: 1px solid var(--ls-border);
  display: flex;
  align-items: stretch;
  padding: 0 16px;
  gap: 0;
}
.kerry-wm-lineside .ls-ctx-field {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 18px;
  border-right: 1px solid #e1e7e9;
  min-width: 120px;
}
.kerry-wm-lineside .ls-ctx-field.grow { flex: 1; min-width: 0; }
.kerry-wm-lineside .ls-ctx-field .lbl {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ls-fg-2);
  margin-bottom: 2px;
}
.kerry-wm-lineside .ls-ctx-field .val {
  font-size: 14px;
  font-weight: 600;
  color: var(--valentia-slate);
}
.kerry-wm-lineside .ls-ctx-field .val.refresh { font-family: var(--font-mono); font-weight: 700; font-size: 15px; }
.kerry-wm-lineside .ls-ctx-field .val .u { font-size: 11px; color: var(--ls-fg-2); margin-left: 2px; }
.kerry-wm-lineside .ls-ctrl {
  width: 140px;
  border: 1px solid var(--ls-border);
  border-radius: 4px;
  padding: 4px 7px;
  color: var(--valentia-slate);
  font: 600 13px var(--font-sans);
  background: #fff;
}

/* Stale banner */
.kerry-wm-lineside .ls-stale {
  margin: 10px 72px 0;
  padding: 8px 14px;
  border: 1px solid rgba(239,68,68,0.40);
  background: var(--ls-stale-bg);
  border-radius: 6px;
  color: var(--ls-stale-fg);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.kerry-wm-lineside .ls-stale .stale-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--ls-bad); flex-shrink: 0; }

/* Caveats */
.kerry-wm-lineside .ls-caveats {
  margin: 10px 72px 0;
  padding: 9px 14px;
  border: 1px solid rgba(217,119,6,0.35);
  background: rgba(255,250,236,0.92);
  border-radius: 6px;
  color: #7c4a03;
  font-size: 11.5px;
}
.kerry-wm-lineside .ls-caveats strong { display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
.kerry-wm-lineside .ls-caveats ul { margin: 0; padding-left: 18px; }

/* Config panel */
.kerry-wm-lineside .ls-config-panel {
  margin: 10px 72px 0;
  padding: 14px 18px;
  border: 1px solid var(--ls-border);
  background: #f4f7f9;
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}
.kerry-wm-lineside .ls-config-panel .cfg-field { display: flex; flex-direction: column; gap: 4px; }
.kerry-wm-lineside .ls-config-panel .cfg-field label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ls-fg-2); }

/* Panel area */
.kerry-wm-lineside .ls-panel-area {
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: stretch;
  overflow: hidden;
  padding: 14px 0;
}
.kerry-wm-lineside .ls-arrow {
  background: transparent;
  border: none;
  color: var(--ls-fg-2);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  cursor: pointer;
}
.kerry-wm-lineside .ls-arrow:hover { color: var(--valentia-slate); background: rgba(0,87,118,0.06); }

/* Panel tabs */
.kerry-wm-lineside .ls-panel-tabs {
  display: flex;
  gap: 6px;
  padding: 0 8px 12px;
  flex-wrap: wrap;
}
.kerry-wm-lineside .ls-panel-tab {
  padding: 5px 14px;
  border-radius: 20px;
  border: 1px solid var(--ls-border);
  background: #fff;
  color: var(--ls-fg-2);
  font: 600 11.5px var(--font-sans);
  cursor: pointer;
  letter-spacing: 0.02em;
}
.kerry-wm-lineside .ls-panel-tab.active {
  background: var(--valentia-slate);
  border-color: var(--valentia-slate);
  color: #fff;
}

/* Panel content */
.kerry-wm-lineside .ls-panel-content { padding: 0 8px; }

/* Cards */
.kerry-wm-lineside .ls-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.kerry-wm-lineside .ls-card {
  background: var(--ls-card);
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(20,55,80,0.09), 0 8px 20px rgba(20,55,80,0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid transparent;
}
.kerry-wm-lineside .ls-card.is-blocked { border-color: rgba(211,47,47,0.35); }
.kerry-wm-lineside .ls-card.is-warn { border-color: rgba(217,119,6,0.35); }
.kerry-wm-lineside .ls-card-head {
  background: var(--valentia-slate);
  color: #fff;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.kerry-wm-lineside .ls-card-head .order-no { font-family: var(--font-mono); font-size: 11px; color: rgba(255,255,255,0.72); }
.kerry-wm-lineside .ls-card-head .mat-desc { font-weight: 700; font-size: 13px; flex: 1; text-align: center; }
.kerry-wm-lineside .ls-card-body { padding: 10px 14px; display: grid; gap: 5px; }
.kerry-wm-lineside .ls-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; border-bottom: 1px solid #f0f4f6; padding-bottom: 4px; }
.kerry-wm-lineside .ls-row:last-child { border-bottom: none; padding-bottom: 0; }
.kerry-wm-lineside .ls-row .lbl { font-size: 10.5px; color: var(--ls-fg-2); }
.kerry-wm-lineside .ls-row .val { font-size: 13px; font-weight: 600; color: var(--ls-fg); font-variant-numeric: tabular-nums; }
.kerry-wm-lineside .ls-row .val.ok { color: var(--ls-ok); }
.kerry-wm-lineside .ls-row .val.warn { color: var(--ls-warn); }
.kerry-wm-lineside .ls-row .val.bad { color: var(--ls-bad); }

/* Progress bar (CSS-only) */
.kerry-wm-lineside .ls-progress { margin: 8px 0 4px; }
.kerry-wm-lineside .ls-progress .track {
  width: 100%;
  height: 8px;
  background: #e5eaec;
  border-radius: 999px;
  overflow: hidden;
}
.kerry-wm-lineside .ls-progress .fill {
  height: 100%;
  border-radius: 999px;
  background: var(--valentia-slate);
  transition: width 0.4s ease;
}
.kerry-wm-lineside .ls-progress .fill.warn { background: var(--sunrise); }
.kerry-wm-lineside .ls-progress .fill.ok { background: var(--jade); }
.kerry-wm-lineside .ls-progress-lbl {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ls-fg-2);
  margin-top: 3px;
}

/* Flag badges */
.kerry-wm-lineside .ls-flags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.kerry-wm-lineside .ls-flag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.kerry-wm-lineside .ls-flag.bad { background: rgba(211,47,47,0.12); color: var(--ls-bad); }
.kerry-wm-lineside .ls-flag.warn { background: rgba(217,119,6,0.12); color: var(--ls-warn); }
.kerry-wm-lineside .ls-flag.ok { background: rgba(21,128,61,0.12); color: var(--ls-ok); }

/* Empty / loading states */
.kerry-wm-lineside .ls-state {
  margin: 8px 0;
  padding: 14px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ls-fg-2);
  background: #f4f7f9;
  border: 1px solid var(--ls-border);
}
.kerry-wm-lineside .ls-state.error { color: #991b1b; background: #fef2f2; border-color: #fecaca; }

/* Footer */
.kerry-wm-lineside .ls-foot {
  background: #143c5a;
  color: #c9d6df;
  display: flex; align-items: center;
  padding: 0 24px;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.kerry-wm-lineside .ls-foot .dot-live { width: 7px; height: 7px; border-radius: 999px; background: var(--jade); box-shadow: 0 0 6px var(--jade); }
.kerry-wm-lineside .ls-foot .dot-stale { background: var(--ls-bad); box-shadow: 0 0 6px var(--ls-bad); }
.kerry-wm-lineside .ls-foot .spacer { flex: 1; }
.kerry-wm-lineside .ls-foot .sep { width: 1px; height: 12px; background: rgba(255,255,255,0.18); margin: 0 4px; }

/* Line picker */
.kerry-wm-lineside .ls-linepicker {
  display: flex;
  gap: 8px;
  padding: 12px 8px;
  flex-wrap: wrap;
}
.kerry-wm-lineside .ls-linepicker-btn {
  padding: 6px 16px;
  border: 1px solid var(--ls-border);
  border-radius: 20px;
  background: #fff;
  color: var(--valentia-slate);
  font: 700 12px var(--font-sans);
  cursor: pointer;
}
.kerry-wm-lineside .ls-linepicker-btn.active {
  background: var(--forest);
  border-color: var(--forest);
  color: #fff;
}
`

// ── Panel labels ──────────────────────────────────────────────────────────────

const PANEL_LABELS = [
  'Now Running',
  'Current Activity',
  "What's Next",
  'Blocked / At-Risk',
  'Staging Readiness',
  'Plan vs Actual',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function dash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  return String(value)
}

function fmtMinutes(mins: number | null | undefined): string {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function fmtQty(qty: number | null | undefined): string {
  if (qty == null) return '—'
  return qty.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function pctBar(pct: number | null | undefined): { pct: number; cls: string } {
  const v = pct ?? 0
  const clamped = Math.max(0, Math.min(100, v))
  return { pct: clamped, cls: clamped >= 80 ? 'ok' : clamped >= 40 ? '' : 'warn' }
}

function isStale(dataUpdatedAt: number, refreshIntervalMs: number): boolean {
  if (!dataUpdatedAt) return false
  return Date.now() - dataUpdatedAt > 2 * refreshIntervalMs
}

// ── Panel: Now Running ────────────────────────────────────────────────────────

function PanelNowRunning({ items, isLoading, error }: {
  readonly items: WmLinesideNowItem[]
  readonly isLoading: boolean
  readonly error: string | null
}) {
  if (isLoading) return <div className="ls-state">Loading running orders…</div>
  if (error) return <div className="ls-state error">{error}</div>
  if (items.length === 0) return <div className="ls-state">No orders currently running on this line.</div>
  return (
    <div className="ls-cards">
      {items.map(item => {
        const bar = pctBar(item.pctComplete)
        return (
          <article className="ls-card" key={item.orderId}>
            <div className="ls-card-head">
              <span className="order-no">{item.orderId}</span>
              <span className="mat-desc">{dash(item.materialName ?? item.materialId)}</span>
            </div>
            <div className="ls-card-body">
              <div className="ls-row">
                <span className="lbl">Order Qty</span>
                <span className="val">{fmtQty(item.plannedQty)}</span>
              </div>
              <div className="ls-row">
                <span className="lbl">Line</span>
                <span className="val">{dash(item.lineId)}</span>
              </div>
              <div className="ls-row">
                <span className="lbl">Elapsed</span>
                <span className="val">{fmtMinutes(item.elapsedMinutes)}</span>
              </div>
              <div className="ls-row">
                <span className="lbl">Projected Finish</span>
                <span className="val">{dash(item.projectedFinish)}</span>
              </div>
              <div className="ls-progress">
                <div className="track"><div className={`fill ${bar.cls}`} style={{ width: `${bar.pct}%` }} /></div>
                <div className="ls-progress-lbl">
                  <span>Progress</span>
                  <span>{item.pctComplete != null ? `${Math.round(item.pctComplete)}%` : '—'}</span>
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

// ── Panel: Current Activity ───────────────────────────────────────────────────

function PanelCurrentActivity({ items, isLoading, error }: {
  readonly items: WmLinesideNowItem[]
  readonly isLoading: boolean
  readonly error: string | null
}) {
  if (isLoading) return <div className="ls-state">Loading…</div>
  if (error) return <div className="ls-state error">{error}</div>
  if (items.length === 0) return <div className="ls-state">No active orders on this line.</div>
  return (
    <div className="ls-cards">
      {items.map(item => (
        <article className="ls-card" key={item.orderId}>
          <div className="ls-card-head">
            <span className="order-no">{item.orderId}</span>
            <span className="mat-desc">{dash(item.materialName ?? item.materialId)}</span>
          </div>
          <div className="ls-card-body">
            <div className="ls-row">
              <span className="lbl">Current Phase</span>
              <span className="val">{dash(item.currentActivityType)}</span>
            </div>
            <div className="ls-row">
              <span className="lbl">Operation</span>
              <span className="val">{dash(item.currentOperationNumber)} – {dash(item.currentOperationDescription)}</span>
            </div>
            <div className="ls-row">
              <span className="lbl">Production Start</span>
              <span className="val">{dash(item.productionFirstActualStart)}</span>
            </div>
            <div className="ls-row">
              <span className="lbl">Elapsed</span>
              <span className="val">{fmtMinutes(item.elapsedMinutes)}</span>
            </div>
            <div className="ls-row">
              <span className="lbl">Projected Finish</span>
              <span className="val">{dash(item.projectedFinish)}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

// ── Panel: What's Next ────────────────────────────────────────────────────────

function PanelWhatsNext({ items, isLoading, error }: {
  readonly items: WmLinesideNextItem[]
  readonly isLoading: boolean
  readonly error: string | null
}) {
  if (isLoading) return <div className="ls-state">Loading upcoming orders…</div>
  if (error) return <div className="ls-state error">{error}</div>
  if (items.length === 0) return <div className="ls-state">No upcoming orders queued for this line.</div>
  return (
    <div className="ls-cards">
      {items.map(item => (
        <article className="ls-card" key={item.orderId}>
          <div className="ls-card-head">
            <span className="order-no">{item.orderId}</span>
            <span className="mat-desc">{dash(item.materialName ?? item.materialId)}</span>
          </div>
          <div className="ls-card-body">
            <div className="ls-row">
              <span className="lbl">Scheduled Start</span>
              <span className="val">{dash(item.scheduledStartDate)}</span>
            </div>
            <div className="ls-row">
              <span className="lbl">Days to Start</span>
              <span className={`val ${(item.daysToStart ?? 99) <= 1 ? 'warn' : ''}`}>{dash(item.daysToStart)}</span>
            </div>
            <div className="ls-row">
              <span className="lbl">Qty</span>
              <span className="val">{fmtQty(item.orderQty)}</span>
            </div>
            <div className="ls-row">
              <span className="lbl">Readiness</span>
              <span className={`val ${item.readinessBand === 'GREEN' ? 'ok' : item.readinessBand === 'AMBER' ? 'warn' : ''}`}>
                {dash(item.readinessBand ?? item.readinessStatus)}
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

// ── Panel: Blocked / At-Risk ──────────────────────────────────────────────────

function PanelBlocked({ items, isLoading, error }: {
  readonly items: WmLinesideBlockedItem[]
  readonly isLoading: boolean
  readonly error: string | null
}) {
  if (isLoading) return <div className="ls-state">Loading blocked orders…</div>
  if (error) return <div className="ls-state error">{error}</div>
  if (items.length === 0) return <div className="ls-state ok" style={{ color: 'var(--ls-ok)', background: 'rgba(21,128,61,0.07)', borderColor: 'rgba(21,128,61,0.25)' }}>No blocked or at-risk orders on this line.</div>
  return (
    <div className="ls-cards">
      {items.map(item => {
        const isHard = item.isFinishLate || item.isOpenLate
        return (
          <article className={`ls-card ${isHard ? 'is-blocked' : 'is-warn'}`} key={item.orderId}>
            <div className="ls-card-head" style={{ background: isHard ? '#b71c1c' : '#c87800' }}>
              <span className="order-no">{item.orderId}</span>
              <span className="mat-desc">{dash(item.materialName ?? item.materialId)}</span>
            </div>
            <div className="ls-card-body">
              <div className="ls-row">
                <span className="lbl">Scheduled Finish</span>
                <span className="val">{dash(item.scheduledFinishDate)}</span>
              </div>
              <div className="ls-flags">
                {item.isLateRelease && <span className="ls-flag warn">Late Release</span>}
                {item.hasMaterialShort && <span className="ls-flag bad">Material Short</span>}
                {item.isFinishLate && <span className="ls-flag bad">Finish Late</span>}
                {item.isOpenLate && <span className="ls-flag bad">Open Late</span>}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

// ── Panel: Staging Readiness ──────────────────────────────────────────────────

function PanelStaging({ items, isLoading, error }: {
  readonly items: WmLinesideStagingItem[]
  readonly isLoading: boolean
  readonly error: string | null
}) {
  if (isLoading) return <div className="ls-state">Loading staging readiness…</div>
  if (error) return <div className="ls-state error">{error}</div>
  if (items.length === 0) return <div className="ls-state">No staging data for this line.</div>
  return (
    <div className="ls-cards">
      {items.map(item => (
        <article className="ls-card" key={item.orderId}>
          <div className="ls-card-head">
            <span className="order-no">{item.orderId}</span>
            <span className="mat-desc">{dash(item.materialName ?? item.materialId)}</span>
          </div>
          <div className="ls-card-body">
            <div className="ls-row">
              <span className="lbl">Components</span>
              <span className="val">{dash(item.componentCount)}</span>
            </div>
            <div className="ls-row">
              <span className="lbl">WM Components</span>
              <span className="val">{dash(item.wmComponentCount)}</span>
            </div>
            <div className="ls-row">
              <span className="lbl">Transfer Orders</span>
              <span className="val">{dash(item.trCount)}</span>
            </div>
            <div className="ls-row">
              <span className="lbl">Staging Status</span>
              <span className={`val ${item.readinessStatus === 'READY' ? 'ok' : item.stagingStatus === 'PARTIAL' ? 'warn' : ''}`}>
                {dash(item.stagingStatus ?? item.readinessStatus)}
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

// ── Panel: Plan vs Actual ─────────────────────────────────────────────────────

function PanelPlanActual({ items, isLoading, error }: {
  readonly items: WmLinesidePlanActualItem[]
  readonly isLoading: boolean
  readonly error: string | null
}) {
  if (isLoading) return <div className="ls-state">Loading plan vs actual…</div>
  if (error) return <div className="ls-state error">{error}</div>
  if (items.length === 0) return <div className="ls-state">No plan vs actual data for this line.</div>
  return (
    <div className="ls-cards">
      {items.map(item => {
        const bar = pctBar(item.yieldPct != null ? item.yieldPct * 100 : null)
        return (
          <article className="ls-card" key={item.orderId}>
            <div className="ls-card-head">
              <span className="order-no">{item.orderId}</span>
              <span className="mat-desc">{dash(item.materialName ?? item.materialId)}</span>
            </div>
            <div className="ls-card-body">
              <div className="ls-row">
                <span className="lbl">Order Qty</span>
                <span className="val">{fmtQty(item.plannedQty)}</span>
              </div>
              <div className="ls-row">
                <span className="lbl">GR Done</span>
                <span className={`val ${item.hasGoodsReceipt ? 'ok' : ''}`}>{item.hasGoodsReceipt ? 'Yes' : 'No'}</span>
              </div>
              <div className="ls-row">
                <span className="lbl">Complete</span>
                <span className={`val ${item.isComplete ? 'ok' : ''}`}>{item.isComplete ? 'Yes' : 'Pending'}</span>
              </div>
              <div className="ls-row">
                <span className="lbl">Scheduled Finish</span>
                <span className="val">{dash(item.scheduledFinishDate)}</span>
              </div>
              {item.yieldPct != null && (
                <div className="ls-progress">
                  <div className="track"><div className={`fill ${bar.cls}`} style={{ width: `${bar.pct}%` }} /></div>
                  <div className="ls-progress-lbl"><span>Yield</span><span>{Math.round(item.yieldPct * 100)}%</span></div>
                </div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

// ── Line picker ───────────────────────────────────────────────────────────────

function LinePicker({ lines, selectedLineId, onSelect }: {
  readonly lines: WmLinesideLine[]
  readonly selectedLineId: string
  readonly onSelect: (lineId: string) => void
}) {
  if (lines.length === 0) return null
  return (
    <div className="ls-linepicker" role="group" aria-label="Select production line">
      {lines.map(line => (
        <button
          key={line.lineId}
          type="button"
          className={`ls-linepicker-btn${line.lineId === selectedLineId ? ' active' : ''}`}
          onClick={() => onSelect(line.lineId)}
        >
          {line.lineLabel ?? line.lineId}
          {line.activeOrderCount > 0 && (
            <span style={{ marginLeft: 6, background: 'var(--jade)', color: 'var(--forest)', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>
              {line.activeOrderCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface LinesideMonitorViewProps {
  /**
   * WmOperationsAdapterRequest providing at minimum `plantId`.
   * In the standalone route the plant+line come from URL params instead.
   */
  readonly request: WmOperationsAdapterRequest
  /** Pre-selected line ID (e.g. from URL params). */
  readonly initialLineId?: string
  /** Whether to show the config cog / Shift+C panel. */
  readonly showConfig?: boolean
  /** Refresh interval in ms (default 60 000). */
  readonly refreshIntervalMs?: number
  /**
   * Whether to show the caveats banner. Defaults to true.
   * The standalone board always shows it; embedded workspace can suppress it.
   */
  readonly showCaveats?: boolean
}

export function LinesideMonitorView({
  request,
  initialLineId = '',
  showConfig: initialShowConfig = false,
  refreshIntervalMs = DEFAULT_REFRESH_MS,
  showCaveats = false,
}: LinesideMonitorViewProps) {
  const [panelIndex, setPanelIndex] = useState(0)
  const [tick, setTick] = useState(DEFAULT_ROTATION_S)
  const [lineId, setLineId] = useState(initialLineId)
  const [showConfig, setShowConfig] = useState(initialShowConfig)
  const [rotationS, setRotationS] = useState(DEFAULT_ROTATION_S)
  const rotationRef = useRef(rotationS)
  rotationRef.current = rotationS

  const plantId = request.plantId ?? ''

  // Line list
  const linesQuery = useWmLinesideLines(plantId || undefined)
  const lines: WmLinesideLine[] = linesQuery.data?.ok ? (linesQuery.data as { ok: true; data: WmLinesideLine[] }).data : []

  // Auto-select first line if none set
  useEffect(() => {
    if (!lineId && lines.length > 0) setLineId(lines[0].lineId)
  }, [lineId, lines])

  const linesideReq: WmLinesideRequest = { plantId, lineId, limit: 50 }
  const enabled = Boolean(plantId && lineId)

  const nowQuery = useWmLinesideNow(linesideReq, refreshIntervalMs, enabled)
  const nextQuery = useWmLinesideNext(linesideReq, refreshIntervalMs, enabled)
  const blockedQuery = useWmLinesideBlocked(linesideReq, refreshIntervalMs, enabled)
  const stagingQuery = useWmLinesideStaging(linesideReq, refreshIntervalMs, enabled)
  const planActualQuery = useWmLinesidePlanActual(linesideReq, refreshIntervalMs, enabled)

  const nowItems: WmLinesideNowItem[] = nowQuery.data?.ok ? (nowQuery.data as { ok: true; data: WmLinesideNowItem[] }).data : []
  const nextItems: WmLinesideNextItem[] = nextQuery.data?.ok ? (nextQuery.data as { ok: true; data: WmLinesideNextItem[] }).data : []
  const blockedItems: WmLinesideBlockedItem[] = blockedQuery.data?.ok ? (blockedQuery.data as { ok: true; data: WmLinesideBlockedItem[] }).data : []
  const stagingItems: WmLinesideStagingItem[] = stagingQuery.data?.ok ? (stagingQuery.data as { ok: true; data: WmLinesideStagingItem[] }).data : []
  const planActualItems: WmLinesidePlanActualItem[] = planActualQuery.data?.ok ? (planActualQuery.data as { ok: true; data: WmLinesidePlanActualItem[] }).data : []

  const stale = nowQuery.dataUpdatedAt
    ? isStale(nowQuery.dataUpdatedAt, refreshIntervalMs)
    : false
  const stamp = nowQuery.dataUpdatedAt
    ? new Date(nowQuery.dataUpdatedAt).toLocaleString('en-GB', { hour12: false }).replace(',', ' at')
    : null

  // Auto-rotation
  useEffect(() => {
    setTick(rotationS)
  }, [panelIndex, rotationS])

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(prev => {
        if (prev <= 1) {
          setPanelIndex(idx => (idx + 1) % PANEL_COUNT)
          return rotationRef.current
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Shift+C to toggle config
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.shiftKey && event.key === 'C') setShowConfig(v => !v)
  }, [])
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const goPrev = () => { setPanelIndex(idx => (idx - 1 + PANEL_COUNT) % PANEL_COUNT); setTick(rotationS) }
  const goNext = () => { setPanelIndex(idx => (idx + 1) % PANEL_COUNT); setTick(rotationS) }

  const nowError = nowQuery.isError ? String(nowQuery.error) : null
  const nextError = nextQuery.isError ? String(nextQuery.error) : null
  const blockedError = blockedQuery.isError ? String(blockedQuery.error) : null
  const stagingError = stagingQuery.isError ? String(stagingQuery.error) : null
  const planActualError = planActualQuery.isError ? String(planActualQuery.error) : null

  return (
    <div className="kerry-wm-lineside">
      <style>{styles}</style>

      {/* Header */}
      <header className="ls-head">
        <div className="ls-brand">
          <div className="ls-logo">CONNECTED<span>OPS</span></div>
          <span className="sep" />
          <span className="title">Lineside Monitor</span>
        </div>
        <div className="ls-head-right">
          <button
            className="ls-iconbtn"
            type="button"
            title="Toggle config (Shift+C)"
            aria-pressed={showConfig}
            onClick={() => setShowConfig(v => !v)}
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Context bar */}
      <div className="ls-ctx">
        <div className="ls-ctx-field">
          <span className="lbl">Plant</span>
          <span className="val">{plantId || '—'}</span>
        </div>
        <div className="ls-ctx-field">
          <span className="lbl">Line</span>
          <span className="val">{lineId || '—'}</span>
        </div>
        <div className="ls-ctx-field">
          <span className="lbl">Panel</span>
          <span className="val">{panelIndex + 1} / {PANEL_COUNT}</span>
        </div>
        <div className="ls-ctx-field grow">
          <span className="lbl">Next rotation in</span>
          <span className="val refresh">{tick}<span className="u">s</span></span>
        </div>
        <div className="ls-ctx-field">
          <span className="lbl">Data as of</span>
          <span className="val" style={{ fontSize: 12 }}>{stamp ?? '…'}</span>
        </div>
        <div className="ls-ctx-field">
          <span className="lbl">Running orders</span>
          <span className="val">{nowItems.length}</span>
        </div>
        <div className="ls-ctx-field">
          <span className="lbl">Blocked</span>
          <span className="val" style={{ color: blockedItems.length > 0 ? 'var(--ls-bad)' : 'var(--ls-ok)' }}>
            {blockedItems.length}
          </span>
        </div>
      </div>

      {/* Stale banner */}
      {stale && (
        <div className="ls-stale" role="alert">
          <span className="stale-dot" />
          <span>
            <strong>DATA STALE</strong> — last refresh was {stamp ?? 'unknown'}.
            Cadence note: this board requires ADR-017 pilot cadence (15-min triggered gold) to show near-real-time data.
            Until that cadence is live, data refreshes daily.
          </span>
        </div>
      )}

      {/* Caveats */}
      {showCaveats && (
        <div className="ls-caveats" role="status">
          <strong>Data-link caveats</strong>
          <ul>
            <li>Elapsed time and projected finish are computed at query time, not streamed continuously.</li>
            <li>CADENCE NOTE: operational value depends on ADR-017 pilot cadence. Until live, data refreshes daily.</li>
            <li>Do not use as sole basis for safety-critical decisions.</li>
          </ul>
        </div>
      )}

      {/* Config panel */}
      {showConfig && (
        <div className="ls-config-panel" role="region" aria-label="Configuration">
          <div className="cfg-field">
            <label htmlFor="ls-cfg-plant">Plant ID</label>
            <input
              id="ls-cfg-plant"
              className="ls-ctrl"
              value={plantId}
              readOnly
              aria-label="Plant ID (set via scope bar)"
            />
          </div>
          <div className="cfg-field">
            <label htmlFor="ls-cfg-rotation">Rotation (seconds)</label>
            <input
              id="ls-cfg-rotation"
              className="ls-ctrl"
              type="number"
              min={5}
              max={300}
              value={rotationS}
              onChange={event => setRotationS(Math.max(5, Math.min(300, Number(event.target.value))))}
              style={{ width: 80 }}
            />
          </div>
        </div>
      )}

      {/* Line picker */}
      {lines.length > 1 && (
        <LinePicker lines={lines} selectedLineId={lineId} onSelect={id => { setLineId(id); setPanelIndex(0); setTick(rotationS) }} />
      )}

      {/* Main panel area */}
      <div className="ls-panel-area">
        <button className="ls-arrow" type="button" onClick={goPrev} title="Previous panel" aria-label="Previous panel">&lt;</button>
        <div>
          <div className="ls-panel-tabs" role="tablist">
            {PANEL_LABELS.map((label, idx) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={idx === panelIndex}
                className={`ls-panel-tab${idx === panelIndex ? ' active' : ''}`}
                onClick={() => { setPanelIndex(idx); setTick(rotationS) }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ls-panel-content" role="tabpanel">
            {panelIndex === 0 && <PanelNowRunning items={nowItems} isLoading={nowQuery.isLoading} error={nowError} />}
            {panelIndex === 1 && <PanelCurrentActivity items={nowItems} isLoading={nowQuery.isLoading} error={nowError} />}
            {panelIndex === 2 && <PanelWhatsNext items={nextItems} isLoading={nextQuery.isLoading} error={nextError} />}
            {panelIndex === 3 && <PanelBlocked items={blockedItems} isLoading={blockedQuery.isLoading} error={blockedError} />}
            {panelIndex === 4 && <PanelStaging items={stagingItems} isLoading={stagingQuery.isLoading} error={stagingError} />}
            {panelIndex === 5 && <PanelPlanActual items={planActualItems} isLoading={planActualQuery.isLoading} error={planActualError} />}
          </div>
        </div>
        <button className="ls-arrow" type="button" onClick={goNext} title="Next panel" aria-label="Next panel">&gt;</button>
      </div>

      {/* Footer */}
      <footer className="ls-foot">
        <span className={`dot-live${stale ? ' dot-stale' : ''}`} />
        <span>io-reporting gold</span>
        {stamp && <><span className="sep" /><span>{stamp}</span></>}
        <span className="spacer" />
        <span>Plant {plantId || '—'} · Line {lineId || '—'} · auto-rotate {rotationS}s · Shift+C config</span>
      </footer>
    </div>
  )
}
