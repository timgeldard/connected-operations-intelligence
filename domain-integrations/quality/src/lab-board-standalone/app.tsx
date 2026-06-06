import { useEffect, useMemo, useState } from 'react'
import type { ConnectedQualityLabFailure } from '@connectio/data-contracts'
import {
  useConnectedQualityLabFailures,
  useConnectedQualityLabPlants,
} from '../adapters/connected-quality-lab-queries.js'
import { LAB_BOARD_STANDALONE_CAVEATS } from './caveats.js'

const PAGE_SIZE = 6
const ROTATION_SECONDS = 30

const styles = `
.cq-lab-standalone {
  --valentia-slate: #005776;
  --forest: #143700;
  --jade: #44cf93;
  --cq-bad: #d32f2f;
  --cq-warn: #d97706;
  --cq-good: #15803d;
  --cq-fg-2: #6b8392;
  --font-sans: Inter, Noto Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  display: grid;
  grid-template-rows: 64px 56px auto 1fr 36px;
  min-height: 100vh;
  background: #dde3e5;
  color: #143c5a;
  font-family: var(--font-sans);
}
.cq-lab-standalone .lab-head {
  background: var(--valentia-slate);
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 16px;
}
.cq-lab-standalone .lab-brand { display: flex; align-items: center; gap: 16px; }
.cq-lab-standalone .lab-logo { font-weight: 900; letter-spacing: 0.08em; font-size: 18px; }
.cq-lab-standalone .lab-logo span { color: var(--jade); }
.cq-lab-standalone .lab-brand .sep { width: 1px; height: 28px; background: rgba(255,255,255,0.18); }
.cq-lab-standalone .lab-brand .title { font-weight: 800; text-transform: uppercase; font-size: 16px; letter-spacing: 0.04em; }
.cq-lab-standalone .lab-head-right { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.cq-lab-standalone .lab-iconbtn {
  width: 40px; height: 40px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.18);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
  cursor: pointer;
}
.cq-lab-standalone .lab-iconbtn.small { width: 30px; height: 30px; border-color: rgba(20,60,90,0.18); color: var(--valentia-slate); }
.cq-lab-standalone .lab-avatar {
  width: 36px; height: 36px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--jade), var(--valentia-slate));
  color: #fff;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  margin-left: 6px;
  border: 2px solid rgba(255,255,255,0.25);
}
.cq-lab-standalone .lab-ctx {
  background: #fff;
  border-bottom: 1px solid #c9d2d6;
  display: flex;
  align-items: stretch;
  padding: 0 16px;
}
.cq-lab-standalone .lab-ctx-field {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 22px;
  border-right: 1px solid #e1e7e9;
  min-width: 140px;
}
.cq-lab-standalone .lab-ctx-field.grow { flex: 1; min-width: 0; }
.cq-lab-standalone .lab-ctx-field .lbl {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #6b8392;
  margin-bottom: 2px;
}
.cq-lab-standalone .lab-ctx-field .val {
  font-size: 15px;
  font-weight: 600;
  color: var(--valentia-slate);
}
.cq-lab-standalone .lab-ctx-field .val.crit { color: var(--cq-bad); font-family: var(--font-mono); font-weight: 800; }
.cq-lab-standalone .lab-ctx-field .val.refresh { font-family: var(--font-mono); font-weight: 700; }
.cq-lab-standalone .lab-ctx-field .val .u { font-size: 11px; color: #6b8392; margin-left: 3px; }
.cq-lab-standalone .lab-caveats {
  margin: 12px 72px 0;
  padding: 10px 14px;
  border: 1px solid rgba(217,119,6,0.35);
  background: rgba(255,250,236,0.92);
  border-radius: 8px;
  color: #7c4a03;
  font-size: 12px;
}
.cq-lab-standalone .lab-caveats strong { display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
.cq-lab-standalone .lab-caveats ul { margin: 0; padding-left: 18px; }
.cq-lab-standalone .lab-grid-wrap {
  position: relative;
  display: grid;
  grid-template-columns: 56px 1fr 56px;
  align-items: stretch;
  overflow: hidden;
  padding: 18px 0;
}
.cq-lab-standalone .lab-arrow {
  background: transparent;
  border: none;
  color: #6b8392;
  display: flex; align-items: center; justify-content: center;
  font-size: 30px;
  cursor: pointer;
}
.cq-lab-standalone .lab-arrow:hover { color: var(--valentia-slate); background: rgba(0,87,118,0.06); }
.cq-lab-standalone .lab-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 0 8px;
  align-content: start;
}
.cq-lab-standalone .fail-card {
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(20,55,80,0.10), 0 8px 22px rgba(20,55,80,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid transparent;
}
.cq-lab-standalone .fc-head {
  background: var(--valentia-slate);
  color: #fff;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}
.cq-lab-standalone .fail-card.warn .fc-head { background: #2c6680; }
.cq-lab-standalone .fc-head .ttl {
  flex: 1;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.25;
  color: #fff;
}
.cq-lab-standalone .fc-head .lot-pill {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--jade);
  color: var(--forest);
  font-family: var(--font-mono);
  font-weight: 800;
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
}
.cq-lab-standalone .fc-body { padding: 12px 14px 8px; display: grid; gap: 6px; }
.cq-lab-standalone .fc-field {
  display: flex;
  flex-direction: column;
  border: 1px solid #c9d2d6;
  border-radius: 4px;
  padding: 4px 10px 6px;
  background: #fff;
}
.cq-lab-standalone .fc-field .lbl { font-size: 10px; color: #6b8392; font-weight: 500; }
.cq-lab-standalone .fc-field .val { font-size: 14px; color: var(--valentia-slate); font-weight: 600; }
.cq-lab-standalone .fc-result { margin-top: 6px; border-top: 1px dashed #c9d2d6; padding-top: 10px; }
.cq-lab-standalone .fc-result .row-top { display: grid; grid-template-columns: auto 1fr auto auto; gap: 6px 12px; align-items: baseline; margin-bottom: 8px; }
.cq-lab-standalone .fc-result .lbl { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b8392; }
.cq-lab-standalone .fc-result .val { font-weight: 800; font-size: 18px; font-variant-numeric: tabular-nums; color: var(--valentia-slate); }
.cq-lab-standalone .fc-result .val.bad { color: var(--cq-bad); }
.cq-lab-standalone .fc-result .val.ok { color: var(--cq-good); }
.cq-lab-standalone .fc-result .val .u { font-family: var(--font-mono); font-size: 11px; color: #6b8392; font-weight: 500; }
.cq-lab-standalone .fc-result .val.mono { font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: #6b8392; }
.cq-lab-standalone .spec-bar { position: relative; height: 22px; margin: 0 4px; }
.cq-lab-standalone .spec-bar .track { position: absolute; left: 0; right: 0; top: 8px; height: 4px; background: #e1e7e9; border-radius: 999px; }
.cq-lab-standalone .spec-bar .band { position: absolute; top: 6px; height: 8px; background: rgba(21,128,61,0.22); border-left: 2px solid var(--cq-good); border-right: 2px solid var(--cq-good); border-radius: 2px; }
.cq-lab-standalone .spec-bar .marker { position: absolute; top: 2px; width: 14px; height: 14px; border-radius: 999px; border: 3px solid #fff; transform: translateX(-50%); box-shadow: 0 2px 4px rgba(0,0,0,0.25); }
.cq-lab-standalone .spec-bar .marker.bad { background: var(--cq-bad); }
.cq-lab-standalone .spec-bar .marker.ok { background: var(--cq-good); }
.cq-lab-standalone .spec-bar .tick { position: absolute; top: 18px; transform: translateX(-50%); font-family: var(--font-mono); font-size: 9px; color: #6b8392; }
.cq-lab-standalone .fc-foot {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  background: #fff5f2;
  border-top: 1px solid rgba(211,47,47,0.25);
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cq-bad);
  font-weight: 700;
}
.cq-lab-standalone .fc-foot.warn { background: #fffaec; border-top-color: rgba(217,119,6,0.3); color: var(--cq-warn); }
.cq-lab-standalone .fc-foot .status-dot { width: 8px; height: 8px; border-radius: 999px; background: currentColor; }
.cq-lab-standalone .fc-foot .ts { font-weight: 500; color: #6b8392; letter-spacing: 0.05em; }
.cq-lab-standalone .lab-foot {
  background: #143c5a;
  color: #c9d6df;
  display: flex; align-items: center;
  padding: 0 24px;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.cq-lab-standalone .lab-foot .dot-live { width: 8px; height: 8px; border-radius: 999px; background: var(--jade); box-shadow: 0 0 8px var(--jade); }
.cq-lab-standalone .lab-foot .sep { width: 1px; height: 14px; background: rgba(255,255,255,0.2); margin: 0 4px; }
.cq-lab-standalone .lab-foot .leg { display: inline-flex; align-items: center; gap: 6px; }
.cq-lab-standalone .lab-foot .leg .d { width: 8px; height: 8px; border-radius: 999px; }
.cq-lab-standalone .lab-foot .leg .d.fail { background: var(--cq-bad); }
.cq-lab-standalone .lab-foot .leg .d.warn { background: var(--cq-warn); }
.cq-lab-standalone .lab-foot .leg .d.info { background: var(--jade); }
.cq-lab-standalone .spacer { flex: 1; }
.cq-lab-standalone .lab-control {
  margin-top: 4px;
  width: 150px;
  border: 1px solid #c9d2d6;
  border-radius: 4px;
  padding: 5px 7px;
  color: var(--valentia-slate);
  font: 700 13px var(--font-sans);
  background: #fff;
}
.cq-lab-standalone .lab-control.small { width: 92px; }
.cq-lab-standalone .lab-state {
  margin: 0 72px 12px;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}
.cq-lab-standalone .lab-state.error { color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; }
.cq-lab-standalone .lab-state.empty { color: #31546a; background: #f8fafc; border: 1px solid #c9d2d6; }
`

export function ConnectedQualityLabBoardStandaloneApp() {
  const [tick, setTick] = useState(24)
  const [page, setPage] = useState(0)
  const [plantId, setPlantId] = useState('C351')
  const [lotType, setLotType] = useState('04')
  const effectivePlantId = plantId.trim() || undefined
  const effectiveLotType = lotType || undefined

  const failuresQuery = useConnectedQualityLabFailures({
    plantId: effectivePlantId,
    lotType: effectiveLotType,
  })
  const plantsQuery = useConnectedQualityLabPlants()

  const failuresResult = failuresQuery.data
  const plantsResult = plantsQuery.data
  const failures = failuresResult?.ok ? failuresResult.data.fails : []
  const dataAvailable = failuresResult?.ok ? failuresResult.data.dataAvailable : true
  const noDataReason = failuresResult?.ok && !failuresResult.data.dataAvailable
    ? failuresResult.data.reason
    : undefined
  const plants = plantsResult?.ok ? plantsResult.data.plants : []
  const selectedPlant = plants.find(plant => plant.plantId === plantId)
  const sourceLabel = failuresResult?.source === 'databricks-api'
    ? 'Databricks API'
    : failuresResult?.source === 'legacy-api'
      ? 'Connected Quality API'
      : failuresResult?.source === 'mock'
        ? 'Mock adapter'
        : 'Waiting for source'

  const pages = Math.max(1, Math.ceil(failures.length / PAGE_SIZE))
  const visible = useMemo(
    () => failures.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [failures, page],
  )
  const stamp = failuresResult?.ok
    ? new Date(failuresResult.fetchedAt).toLocaleString('en-GB', { hour12: false }).replace(',', ' -')
    : new Date().toLocaleString('en-GB', { hour12: false }).replace(',', ' -')
  const openFails = failures.filter(failure => failure.sev === 'fail').length
  const errorMessage = failuresResult && !failuresResult.ok ? failuresResult.error.message : undefined

  useEffect(() => {
    setPage(0)
    setTick(ROTATION_SECONDS)
  }, [effectivePlantId, effectiveLotType, failures.length])

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(value => {
        if (value <= 1) {
          setPage(current => (current + 1) % pages)
          return ROTATION_SECONDS
        }
        return value - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [pages])

  const goPrev = () => {
    setPage(current => (current - 1 + pages) % pages)
    setTick(ROTATION_SECONDS)
  }
  const goNext = () => {
    setPage(current => (current + 1) % pages)
    setTick(ROTATION_SECONDS)
  }

  return (
    <div className="cq-lab-standalone">
      <style>{styles}</style>
      <header className="lab-head">
        <div className="lab-brand">
          <div className="lab-logo">CONNECTED<span>QUALITY</span></div>
          <span className="sep" />
          <span className="title">Lab Board</span>
        </div>
        <div className="lab-head-right">
          <button className="lab-iconbtn" title="Home" type="button">H</button>
          <button className="lab-iconbtn" title="Theme" type="button">D</button>
          <div className="lab-avatar">SK</div>
        </div>
      </header>

      <div className="lab-ctx">
        <div className="lab-ctx-field">
          <span className="lbl">Plant</span>
          <input
            className="lab-control"
            list="cq-lab-plant-options"
            value={plantId}
            onChange={event => setPlantId(event.target.value.toUpperCase())}
            aria-label="Plant filter"
          />
          <datalist id="cq-lab-plant-options">
            {plants.map(plant => <option key={plant.plantId} value={plant.plantId}>{plant.plantName}</option>)}
          </datalist>
        </div>
        <div className="lab-ctx-field"><span className="lbl">Plant name</span><span className="val">{selectedPlant?.plantName ?? 'Manual entry'}</span></div>
        <div className="lab-ctx-field"><span className="lbl">Inspection lot type</span>
          <select className="lab-control small" value={lotType} onChange={event => setLotType(event.target.value)} aria-label="Inspection lot type filter">
            <option value="">All</option>
            <option value="04">04</option>
            <option value="89">89</option>
          </select>
        </div>
        <div className="lab-ctx-field"><span className="lbl">Source</span><span className="val">{sourceLabel}</span></div>
        <div className="lab-ctx-field grow"><span className="lbl">Next board rotation in</span><span className="val refresh">{tick} <span className="u">s</span></span></div>
        <div className="lab-ctx-field"><span className="lbl">Page</span><span className="val">{page + 1} / {pages}</span></div>
        <div className="lab-ctx-field"><span className="lbl">Open fails</span><span className="val crit">{openFails}</span></div>
      </div>

      <div className="lab-caveats" role="status">
        <strong>Data-link caveats</strong>
        <ul>
          {LAB_BOARD_STANDALONE_CAVEATS.map(caveat => <li key={caveat}>{caveat}</li>)}
        </ul>
      </div>

      {failuresQuery.isLoading && (
        <div className="lab-state empty">Loading lab failures for plant {plantId}...</div>
      )}
      {errorMessage && (
        <div className="lab-state error">Lab failure query failed: {errorMessage}</div>
      )}
      {!failuresQuery.isLoading && !errorMessage && !dataAvailable && (
        <div className="lab-state empty">{noDataReason ?? `No lab data published for plant ${plantId}.`}</div>
      )}
      {!failuresQuery.isLoading && !errorMessage && dataAvailable && failures.length === 0 && (
        <div className="lab-state empty">No failures or warnings returned for plant {plantId}.</div>
      )}

      <div className="lab-grid-wrap">
        <button className="lab-arrow left" onClick={goPrev} title="Previous" type="button">&lt;</button>
        <div className="lab-grid">
          {visible.map((failure, index) => <FailCard key={`${failure.lot}-${failure.char}-${index}`} failure={failure} />)}
        </div>
        <button className="lab-arrow right" onClick={goNext} title="Next" type="button">&gt;</button>
      </div>

      <footer className="lab-foot">
        <span className="dot-live" /> {sourceLabel} - {stamp}
        <span className="sep" />
        Plant {plantId || 'unset'} - auto-rotate every 30s - click arrows to override
        <span className="spacer" />
        <span className="leg"><span className="d fail" /> Fail</span>
        <span className="leg"><span className="d warn" /> Warn</span>
        <span className="leg"><span className="d info" /> Auto-refresh</span>
      </footer>
    </div>
  )
}

function FailCard({ failure }: { readonly failure: ConnectedQualityLabFailure }) {
  const statusText = failure.sev === 'fail' ? 'RESULT - FAIL' : 'RESULT - OUT OF WARNING'
  const timestamp = failure.ts
    ? new Date(failure.ts).toLocaleTimeString('en-GB', { hour12: false })
    : 'pending'

  return (
    <article className={`fail-card ${failure.sev}`}>
      <div className="fc-head">
        <div className="ttl">{failure.mat}</div>
        <div className="lot-pill">04</div>
      </div>
      <div className="fc-body">
        <Field label="Material Number" value={failure.matNo} />
        <Field label="Inspection Lot" value={failure.lot} />
        {failure.batch && <Field label="Batch Number" value={failure.batch} />}
        {failure.line && <Field label="Process Line" value={failure.line} />}
        <Field label="Inspection Characteristic" value={failure.char} />
        <Field label="Inspection Text" value={failure.text} />
        <ResultRow failure={failure} />
      </div>
      <div className={`fc-foot ${failure.sev}`}>
        <span className="status-dot" />
        <span>{statusText}</span>
        <span className="spacer" />
        <span className="ts">{timestamp}</span>
      </div>
    </article>
  )
}

function Field({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <label className="fc-field">
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
    </label>
  )
}

function ResultRow({ failure }: { readonly failure: ConnectedQualityLabFailure }) {
  const precision = failure.res < 10 ? 4 : 2

  if (failure.lo === undefined || failure.hi === undefined) {
    return (
      <div className="fc-result">
        <div className="row-top">
          <span className="lbl">Result</span>
          <span className="val bad">{failure.res.toFixed(precision)}<span className="u"> {failure.units}</span></span>
        </div>
      </div>
    )
  }

  const lo = failure.lo
  const hi = failure.hi
  const inSpec = failure.res >= lo && failure.res <= hi
  const span = hi - lo
  const pad = span * 0.6
  const min = lo - pad
  const max = hi + pad
  const pos = Math.max(0, Math.min(100, ((failure.res - min) / (max - min)) * 100))
  const loPos = ((lo - min) / (max - min)) * 100
  const hiPos = ((hi - min) / (max - min)) * 100

  return (
    <div className="fc-result">
      <div className="row-top">
        <span className="lbl">Result</span>
        <span className={`val ${inSpec ? 'ok' : 'bad'}`}>{failure.res.toFixed(precision)}<span className="u"> {failure.units}</span></span>
        <span className="lbl right">Spec</span>
        <span className="val mono">{lo} - {hi}</span>
      </div>
      <div className="spec-bar">
        <div className="track" />
        <div className="band" style={{ left: `${loPos}%`, width: `${hiPos - loPos}%` }} />
        <div className={`marker ${inSpec ? 'ok' : 'bad'}`} style={{ left: `${pos}%` }} />
        <span className="tick" style={{ left: `${loPos}%` }}>{lo}</span>
        <span className="tick" style={{ left: `${hiPos}%` }}>{hi}</span>
      </div>
    </div>
  )
}
