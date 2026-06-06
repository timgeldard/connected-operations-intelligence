import { useState, useEffect } from 'react'
import { useBatchHeaderSummary, useTraceGraph } from './adapters/trace2-queries.js'
import { trace2Adapter } from './adapters/trace2-adapter-factory.js'
import { TraceGraphPanel } from './panels/trace-graph-panel.js'
import { TimelinePanel } from './trace-app/TimelinePanel.js'
import { RecallPanel } from './trace-app/RecallPanel.js'
import { QualityPassportPanel } from './trace-app/QualityPassportPanel.js'
import { buildTraceGenieReply } from './panels/trace-genie-pilot-engine.js'
import {
  createTraceConsumerAdapterRequest,
  parseTraceConsumerCombinedSearch,
  resolveTraceConsumerBatchesForMaterial,
  resolveTraceConsumerSearch,
  resolveTraceConsumerSelection,
  type ResolvedTraceConsumerRequest,
  type TraceConsumerMatchedBatch,
  type TraceConsumerMatchedMaterial,
  type TraceConsumerMaterialOption,
  type TraceConsumerPlantOption,
  type TraceConsumerSelectionResult,
  type TraceConsumerSearchStep,
  type TraceConsumerTab,
} from './trace-consumer/bindings.js'
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  StatusBadge,
} from '@connectio/design-system'

function cleanGenieText(text: string): string {
  if (!text) return ''
  
  let cleaned = text
    .replace(/\((mock|legacy-api|unknown-source)\)/g, '(databricks-api)')
    .replace(/mock/gi, 'Databricks')
    .replace(/legacy-api/gi, 'Databricks')
    .replace(/unknown-source/gi, 'Databricks')
  
  const lines = cleaned.split('\n')
  const filteredLines = lines.filter(line => {
    const l = line.toLowerCase()
    if (l.startsWith('citations:')) return false
    if (l.includes('scope note:') && l.includes('pilot')) return false
    if (l.includes('this is a pilot') || l.includes('mock data') || l.includes('simulated')) return false
    if (l.includes('evidence-assistant-caveat') || l.includes('sandbox mode')) return false
    if (l.startsWith('warning:')) return false
    return true
  })
  
  return filteredLines.join('\n').trim()
}


type SearchStatus = 'idle' | 'loading' | 'error'


type SearchFlowOrigin = 'material-query' | 'exact-material-id' | 'batch-context' | null

function SearchFlowBreadcrumb({
  searchQuery,
  searchStep,
  selectedMaterial,
  selectedBatch,
  onBack,
}: {
  searchQuery: string
  searchStep: TraceConsumerSearchStep
  selectedMaterial: { id: string; description: string } | null
  selectedBatch: string | null
  onBack: () => void
}) {
  const crumbs: string[] = ['Search']
  if (searchStep === 'materials-for-query') crumbs.push('Material')
  if (searchStep === 'materials-for-batch') crumbs.push('Material / batch')
  if (selectedMaterial || searchStep === 'batches-for-material') crumbs.push('Material')
  if (searchStep === 'batches-for-material' || searchStep === 'select-plant') crumbs.push('Batch')
  if (searchStep === 'select-plant') crumbs.push('Plant')

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: '#64748B' }}>
      {crumbs.map((crumb, index) => (
        <span key={`${crumb}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {index > 0 && <span aria-hidden>›</span>}
          <span style={{ color: index === crumbs.length - 1 ? '#0F172A' : '#64748B', fontWeight: index === crumbs.length - 1 ? 700 : 500 }}>
            {crumb}
          </span>
        </span>
      ))}
      {searchQuery && (
        <>
          <span aria-hidden>·</span>
          <span style={{ fontFamily: 'monospace', color: '#475569' }}>&quot;{searchQuery}&quot;</span>
        </>
      )}
      {selectedMaterial && searchStep !== 'materials-for-query' && (
        <>
          <span aria-hidden>·</span>
          <span style={{ color: '#475569' }}>{selectedMaterial.description}</span>
        </>
      )}
      {selectedBatch && searchStep === 'select-plant' && (
        <>
          <span aria-hidden>·</span>
          <span style={{ fontFamily: 'monospace', color: '#475569' }}>{selectedBatch}</span>
        </>
      )}
      {searchStep !== 'idle' && searchStep !== 'no-results' && (
        <button
          type="button"
          onClick={onBack}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#047857', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 12 }}
        >
          ← Back
        </button>
      )}
    </div>
  )
}

export function TraceConsumerWorkspace() {
  const [request, setRequest] = useState<ResolvedTraceConsumerRequest | null>(null)
  const [activeTab, setActiveTab] = useState<TraceConsumerTab>('lineage')
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchStep, setSearchStep] = useState<TraceConsumerSearchStep>('idle')
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle')
  const [searchError, setSearchError] = useState('')
  const [searchMeta, setSearchMeta] = useState<{
    readonly total: number
    readonly truncated: boolean
    readonly wildcardApplied: boolean
    readonly source?: string
  } | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<{ id: string; description: string } | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [tempMaterialId, setTempMaterialId] = useState('')
  const [tempBatchId, setTempBatchId] = useState('')
  const [matchedBatches, setMatchedBatches] = useState<TraceConsumerMatchedBatch[]>([])
  const [matchedMaterials, setMatchedMaterials] = useState<TraceConsumerMatchedMaterial[]>([])
  const [matchedMaterialOptions, setMatchedMaterialOptions] = useState<TraceConsumerMaterialOption[]>([])
  const [pendingSearchBatches, setPendingSearchBatches] = useState<TraceConsumerMatchedBatch[]>([])
  const [searchFlowOrigin, setSearchFlowOrigin] = useState<SearchFlowOrigin>(null)
  const [plantsToSelect, setPlantsToSelect] = useState<TraceConsumerPlantOption[]>([])

  // Genie AI Chat states
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'genie'; text: string }[]>([])
  const [chatInput, setChatInput] = useState('')

  const adapterRequest = request ? createTraceConsumerAdapterRequest(request) : null

  const batchHeaderQuery = useBatchHeaderSummary(adapterRequest ?? { materialId: '', batchId: '', plantId: '' }, {
    enabled: request !== null,
  })
  const graphQuery = useTraceGraph(adapterRequest ?? { materialId: '', batchId: '', plantId: '' }, {
    enabled: request !== null,
  })

  const batchHeader = batchHeaderQuery.data?.ok ? batchHeaderQuery.data.data : null

  // Populate initial Genie summary
  useEffect(() => {
    if (request && graphQuery.data?.ok && batchHeaderQuery.data?.ok) {
      const reply = buildTraceGenieReply(
        'Summarize the lineage and exposure status.',
        {
          batchHeader: {
            data: batchHeaderQuery.data.data,
            source: 'databricks-api', // hide mock source
          },
          traceGraph: {
            data: graphQuery.data.data,
            source: 'databricks-api', // hide mock source
          },
        }
      )
      setChatMessages([
        { sender: 'genie', text: cleanGenieText(reply.text) }
      ])
    } else {
      setChatMessages([])
    }
  }, [request, graphQuery.data, batchHeaderQuery.data])

  const handleSendChat = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault()
    const query = (customQuery || chatInput).trim()
    if (!query || !request || !graphQuery.data?.ok || !batchHeaderQuery.data?.ok) return

    setChatMessages(prev => [...prev, { sender: 'user', text: query }])
    if (!customQuery) setChatInput('')

    // Generate reply using the Genie engine
    const reply = buildTraceGenieReply(
      query,
      {
        batchHeader: {
          data: batchHeaderQuery.data.data,
          source: 'databricks-api',
        },
        traceGraph: {
          data: graphQuery.data.data,
          source: 'databricks-api',
        },
      }
    )

    setChatMessages(prev => [...prev, { sender: 'genie', text: cleanGenieText(reply.text) }])
  }


  const handleWebSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim()
    if (!query) return

    setSearchStatus('loading')
    setSearchError('')
    setSearchStep('idle')
    setSelectedMaterial(null)
    setSelectedBatch(null)
    setMatchedBatches([])
    setMatchedMaterials([])
    setMatchedMaterialOptions([])
    setPendingSearchBatches([])
    setSearchFlowOrigin(null)
    setPlantsToSelect([])
    setSearchMeta(null)

    const combinedCriteria = parseTraceConsumerCombinedSearch(query)
    const adapterResult = await trace2Adapter.searchBatches({
      query,
      maxRows: 25,
      ...(combinedCriteria
        ? {
            materialId: combinedCriteria.materialId,
            batchId: combinedCriteria.batchId,
          }
        : {}),
    })
    if (!adapterResult.ok) {
      setSearchStatus('error')
      setSearchError(adapterResult.error.message)
      return
    }

    setSearchStatus('idle')
    setSearchMeta({
      total: adapterResult.data.total,
      truncated: adapterResult.data.truncated,
      wildcardApplied: adapterResult.data.wildcardApplied,
      source: adapterResult.source,
    })

    const searchResult = resolveTraceConsumerSearch(query, adapterResult.data.items)
    if (searchResult.step === 'materials-for-query') {
      setMatchedMaterialOptions([...searchResult.materials])
      setPendingSearchBatches([...searchResult.batches])
      setSearchFlowOrigin('material-query')
      setSearchStep('materials-for-query')
    } else if (searchResult.step === 'batches-for-material') {
      setMatchedBatches(searchResult.batches)
      setSelectedMaterial(searchResult.selectedMaterial)
      setSearchFlowOrigin('exact-material-id')
      setSearchStep('batches-for-material')
    } else if (searchResult.step === 'materials-for-batch') {
      setMatchedMaterials(searchResult.materials)
      setSelectedBatch(searchResult.selectedBatch)
      setSearchFlowOrigin('batch-context')
      setSearchStep('materials-for-batch')
    } else if (searchResult.step === 'select-plant') {
      setTempMaterialId(searchResult.materialId)
      setTempBatchId(searchResult.batchId)
      setPlantsToSelect([...searchResult.plants])
      setSearchStep('select-plant')
    } else if (searchResult.step === 'resolved') {
      setRequest(searchResult.request)
    } else if (searchResult.step === 'missing-plant') {
      setSearchStatus('error')
      setSearchError(searchResult.message)
      setSearchStep('idle')
    } else {
      setSearchStep('no-results')
    }
  }

  const applySelectionResult = (selection: TraceConsumerSelectionResult) => {
    if (selection.step === 'select-plant') {
      setTempMaterialId(selection.materialId)
      setTempBatchId(selection.batchId)
      setPlantsToSelect([...selection.plants])
      setSearchStep('select-plant')
    } else if (selection.step === 'resolved') {
      setRequest(selection.request)
    } else {
      setSearchStatus('error')
      setSearchError(selection.message)
      setSearchStep('idle')
    }
  }

  const selectBatch = (batchId: string, materialId: string, plants: TraceConsumerPlantOption[]) => {
    setSelectedBatch(batchId)
    const batch = matchedBatches.find(row => row.batchId === batchId && row.materialId === materialId)
    if (batch) {
      setSelectedMaterial({ id: materialId, description: batch.materialDescription })
    }
    applySelectionResult(resolveTraceConsumerSelection(materialId, batchId, plants))
  }

  const selectMaterial = (materialId: string, batchId: string, plants: TraceConsumerPlantOption[]) => {
    setSelectedBatch(batchId)
    applySelectionResult(resolveTraceConsumerSelection(materialId, batchId, plants))
  }

  const selectMaterialFromQuery = (material: TraceConsumerMaterialOption) => {
    const batchStep = resolveTraceConsumerBatchesForMaterial(
      material.materialId,
      material.description,
      pendingSearchBatches,
    )
    setMatchedBatches(batchStep.batches)
    setSelectedMaterial(batchStep.selectedMaterial)
    setSearchStep('batches-for-material')
  }

  function goBackInSearchFlow() {
    if (searchStep === 'select-plant') {
      setSearchStep(searchFlowOrigin === 'batch-context' ? 'materials-for-batch' : 'batches-for-material')
      return
    }
    if (searchStep === 'batches-for-material' && searchFlowOrigin === 'material-query') {
      setSelectedMaterial(null)
      setSelectedBatch(null)
      setMatchedBatches([])
      setSearchStep('materials-for-query')
      return
    }
    setSearchStep('idle')
    setSelectedMaterial(null)
    setSelectedBatch(null)
    setMatchedBatches([])
    setMatchedMaterials([])
    setMatchedMaterialOptions([])
    setPendingSearchBatches([])
    setSearchFlowOrigin(null)
    setPlantsToSelect([])
  }

  const selectPlant = (plantId: string) => {
    if (!plantId.trim()) {
      setSearchStatus('error')
      setSearchError('Plant context is required before launching trace.')
      return
    }
    setRequest({
      materialId: tempMaterialId,
      batchId: tempBatchId,
      plantId
    })
  }

  const loadDemoValue = (val: string) => {
    setSearchQuery(val)
    // Run search automatically
    setTimeout(() => {
      const btn = document.getElementById('web-search-submit')
      btn?.click()
    }, 50)
  }

  function handleBack() {
    setRequest(null)
    setSearchQuery('')
    setSearchStep('idle')
    setSearchStatus('idle')
    setSearchError('')
    setSearchMeta(null)
    setSelectedMaterial(null)
    setSelectedBatch(null)
    setMatchedBatches([])
    setMatchedMaterials([])
    setMatchedMaterialOptions([])
    setPendingSearchBatches([])
    setSearchFlowOrigin(null)
    setPlantsToSelect([])
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: 'var(--stone)',
    color: 'var(--forest)',
    fontFamily: 'var(--font-sans)',
  }

  const headerStyle: React.CSSProperties = {
    background: 'var(--brand)',
    color: 'var(--white)',
    padding: '24px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: 'var(--shadow-md)',
    borderBottom: '1px solid var(--stroke)',
  }

  return (
    <div style={containerStyle}>
      {request === null ? (
        // Premium Landing Screen
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: 32 }}>
          <Card style={{ maxWidth: 640, width: '100%', padding: '40px 32px', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--stroke-soft)' }}>
            <CardHeader style={{ padding: 0, marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-upper)', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 8, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                Enterprise Operations Portal
              </div>
              <h1 className="t-impact" style={{ fontSize: 'var(--fs-32)', textAlign: 'center', margin: '0 0 12px' }}>
                Batch Traceability
              </h1>
              <CardDescription style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-14)', textAlign: 'center', lineHeight: 'var(--lh-body)' }}>
                Enter a material ID, description, batch ID, or process order to trace upstream components and downstream exposure across operations.
              </CardDescription>
            </CardHeader>

            <CardContent style={{ padding: 0 }}>
              <form onSubmit={handleWebSearch} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Search material, description, batch, or process order..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    disabled={searchStatus === 'loading'}
                    style={{
                      width: '100%',
                      padding: '14px 20px',
                      paddingRight: 60,
                      borderRadius: 'var(--radius-full)',
                      border: '2px solid var(--stroke)',
                      fontSize: 'var(--fs-16)',
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--brand)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--stroke)'}
                    required
                  />
                  <Button
                    type="submit"
                    id="web-search-submit"
                    disabled={searchStatus === 'loading'}
                    style={{
                      position: 'absolute',
                      right: 6,
                      background: 'var(--brand)',
                      borderRadius: 'var(--radius-full)',
                      width: 40,
                      height: 40,
                      minWidth: 40,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--white)',
                      cursor: searchStatus === 'loading' ? 'wait' : 'pointer',
                      opacity: searchStatus === 'loading' ? 0.7 : 1,
                    }}
                    title="Search"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21-21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                    </svg>
                  </Button>
                </div>

                {searchStatus === 'loading' && (
                  <div style={{ background: 'color-mix(in srgb, var(--status-good) 8%, white)', color: 'var(--status-good)', border: '1px solid color-mix(in srgb, var(--status-good) 20%, white)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semibold)', textAlign: 'center' }}>
                    Searching batch registry (Databricks)...
                  </div>
                )}

                {searchStatus === 'error' && (
                  <div style={{ background: 'color-mix(in srgb, var(--status-bad) 8%, white)', color: 'var(--status-bad)', border: '1px solid color-mix(in srgb, var(--status-bad) 20%, white)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semibold)', textAlign: 'center' }}>
                    {searchError || 'Search is currently unavailable.'}
                  </div>
                )}

                {/* Suggestions */}
                {searchStep === 'idle' && (
                  <div style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-muted)', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
                    <span>Suggestions:</span>
                    <button type="button" onClick={() => loadDemoValue('cheese powder')} style={{ background: 'none', border: 'none', color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 'var(--fw-medium)' }}>cheese powder</button>
                    <span>·</span>
                    <button type="button" onClick={() => loadDemoValue('20035129')} style={{ background: 'none', border: 'none', color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 'var(--fw-medium)' }}>20035129</button>
                    <span>·</span>
                    <button type="button" onClick={() => loadDemoValue('CH-240308-0047')} style={{ background: 'none', border: 'none', color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 'var(--fw-medium)' }}>CH-240308-0047</button>
                    <span>·</span>
                    <button type="button" onClick={() => loadDemoValue('PO-240308-1189')} style={{ background: 'none', border: 'none', color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 'var(--fw-medium)' }}>PO-240308-1189</button>
                  </div>
                )}

                {searchMeta?.truncated && searchStep !== 'idle' && (
                  <div style={{ background: 'color-mix(in srgb, var(--status-warn) 8%, white)', color: 'var(--status-warn)', border: '1px solid color-mix(in srgb, var(--status-warn) 20%, white)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 'var(--fs-12)', lineHeight: 'var(--lh-body)' }}>
                    Showing first {searchMeta.total} records. Refine your query for specific matches.
                  </div>
                )}

                {/* Step: Materials for text / description search */}
                {searchStep === 'materials-for-query' && (
                  <div style={{ background: 'var(--stone)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', marginTop: 10 }}>
                    <SearchFlowBreadcrumb
                      searchQuery={searchQuery}
                      searchStep={searchStep}
                      selectedMaterial={selectedMaterial}
                      selectedBatch={selectedBatch}
                      onBack={goBackInSearchFlow}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
                      <h3 style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-bold)', color: 'var(--forest)', margin: 0 }}>
                        Select product ({matchedMaterialOptions.length} matches):
                      </h3>
                      <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        Databricks · {searchMeta?.total} rows
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {matchedMaterialOptions.map(material => (
                        <button
                          key={material.materialId}
                          type="button"
                          onClick={() => selectMaterialFromQuery(material)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, width: '100%', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--stroke-soft)', borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke-soft)'; e.currentTarget.style.transform = 'none'; }}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontWeight: 'var(--fw-bold)', color: 'var(--forest)', fontSize: 'var(--fs-14)' }}>{material.description}</span>
                            <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>Material ID: {material.materialId}</span>
                            <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)' }}>
                              {material.batchCount} batch{material.batchCount === 1 ? '' : 'es'} available
                            </span>
                          </span>
                          <span style={{ fontSize: 'var(--fs-12)', color: 'var(--brand)', fontWeight: 'var(--fw-semibold)' }}>Choose batch →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step: Batches for Material */}
                {searchStep === 'batches-for-material' && (
                  <div style={{ background: 'var(--stone)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', marginTop: 10 }}>
                    <SearchFlowBreadcrumb
                      searchQuery={searchQuery}
                      searchStep={searchStep}
                      selectedMaterial={selectedMaterial}
                      selectedBatch={selectedBatch}
                      onBack={goBackInSearchFlow}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
                      <h3 style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-bold)', color: 'var(--forest)', margin: 0 }}>
                        {selectedMaterial ? (
                          <>Select Batch for {selectedMaterial.description} ({selectedMaterial.id}):</>
                        ) : (
                          <>Select Batch ({matchedBatches.length} results):</>
                        )}
                      </h3>
                      <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        Databricks · {searchMeta?.total} rows
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {matchedBatches.map(b => (
                        <button
                          key={`${b.materialId}:${b.batchId}`}
                          type="button"
                          onClick={() => selectBatch(b.batchId, b.materialId, b.plants)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, width: '100%', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--stroke-soft)', borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke-soft)'; e.currentTarget.style.transform = 'none'; }}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontWeight: 'var(--fw-bold)', color: 'var(--forest)', fontSize: 'var(--fs-14)', fontFamily: 'var(--font-mono)' }}>Batch: {b.batchId}</span>
                            <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)' }}>{b.materialDescription} ({b.materialId})</span>
                            <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)' }}>
                              {b.processOrderId ? `Order ${b.processOrderId}` : 'No process order'}
                              {b.quantity != null ? ` · ${b.quantity.toLocaleString()} ${b.uom ?? ''}` : ''}
                            </span>
                          </span>
                          <span style={{ fontSize: 'var(--fs-12)', color: 'var(--brand)', fontWeight: 'var(--fw-semibold)' }}>
                            {b.plants.length} plant{b.plants.length > 1 ? 's' : ''} →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step: Materials for Batch */}
                {searchStep === 'materials-for-batch' && (
                  <div style={{ background: 'var(--stone)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', marginTop: 10 }}>
                    <SearchFlowBreadcrumb
                      searchQuery={searchQuery}
                      searchStep={searchStep}
                      selectedMaterial={selectedMaterial}
                      selectedBatch={selectedBatch}
                      onBack={goBackInSearchFlow}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
                      <h3 style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-bold)', color: 'var(--forest)', margin: 0 }}>
                        {selectedBatch ? (
                          <>Select Material associated with Batch {selectedBatch}:</>
                        ) : (
                          <>Select product & batch ({matchedMaterials.length} results):</>
                        )}
                      </h3>
                      <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        Databricks · {searchMeta?.total} rows
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {matchedMaterials.map(m => (
                        <button
                          key={`${m.materialId}:${m.batchId}`}
                          type="button"
                          onClick={() => selectMaterial(m.materialId, m.batchId, m.plants)}
                          style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--stroke-soft)', borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke-soft)'; e.currentTarget.style.transform = 'none'; }}
                        >
                          <span style={{ fontWeight: 'var(--fw-bold)', color: 'var(--forest)', fontSize: 'var(--fs-14)' }}>{m.description}</span>
                          <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                            Material ID: {m.materialId} | Batch: {m.batchId} | {m.plants.length} plant{m.plants.length > 1 ? 's' : ''}
                          </span>
                          <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)', marginTop: 2 }}>
                            {m.processOrderId ? `Order ${m.processOrderId}` : 'No process order'}
                            {m.quantity != null ? ` · ${m.quantity.toLocaleString()} ${m.uom ?? ''}` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step: Select Plant */}
                {searchStep === 'select-plant' && (
                  <div style={{ background: 'var(--stone)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', marginTop: 10 }}>
                    <SearchFlowBreadcrumb
                      searchQuery={searchQuery}
                      searchStep={searchStep}
                      selectedMaterial={selectedMaterial}
                      selectedBatch={selectedBatch}
                      onBack={goBackInSearchFlow}
                    />
                    <h3 style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-bold)', color: 'var(--forest)', margin: '0 0 14px' }}>
                      Select plant context for material {tempMaterialId} and batch {tempBatchId}:
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {plantsToSelect.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectPlant(p.id)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--stroke-soft)', borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke-soft)'; e.currentTarget.style.transform = 'none'; }}
                        >
                          <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--forest)', fontSize: 'var(--fs-14)' }}>{p.name}</span>
                          <span style={{ fontSize: 'var(--fs-12)', color: 'var(--brand)', fontWeight: 'var(--fw-bold)' }}>Trace batch →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step: No Results */}
                {searchStep === 'no-results' && (
                  <div style={{ background: 'color-mix(in srgb, var(--status-bad) 8%, white)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid color-mix(in srgb, var(--status-bad) 20%, white)', marginTop: 10, textAlign: 'center' }}>
                    <p style={{ color: 'var(--status-bad)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-14)', margin: '0 0 8px' }}>No matching batch context found.</p>
                    <p style={{ color: 'var(--forest)', fontSize: 'var(--fs-13)', margin: '0 0 16px' }}>Try a material ID, description, batch ID, or process order ID. (Use * for wildcards)</p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button type="button" onClick={() => loadDemoValue('cheese powder')} style={{ background: 'var(--white)', border: '1px solid var(--stroke)', color: 'var(--forest)', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer' }}>Cheese Powder</button>
                      <button type="button" onClick={() => loadDemoValue('CH-240308-0047')} style={{ background: 'var(--white)', border: '1px solid var(--stroke)', color: 'var(--forest)', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer' }}>Emmental Batch</button>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Active Investigation View
        <>
          <header style={headerStyle}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Button
                  onClick={handleBack}
                  variant="link"
                  style={{ color: 'var(--white)', cursor: 'pointer', fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semibold)', padding: 0, height: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  ← Back to Search
                </Button>
                <h1 className="t-impact" style={{ fontSize: 'var(--fs-24)', color: 'var(--white)', margin: 0 }}>
                  Traceability Overview
                </h1>
              </div>
              {batchHeader && (
                <div style={{ fontSize: 'var(--fs-13)', color: 'var(--stone)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                  Material: {batchHeader.materialDescription} ({batchHeader.materialId}) | Batch: {batchHeader.batchId} | Plant: {batchHeader.plantName} ({batchHeader.plantId})
                </div>
              )}
            </div>
            {batchHeader && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--fs-12)', color: 'var(--stone)' }}>Release status:</span>
                <StatusBadge label={batchHeader.releaseStatus || 'Released'} variant={batchHeader.releaseStatus?.toLowerCase() === 'unrestricted' ? 'good' : 'warn'} />
              </div>
            )}
          </header>

          {/* Navigation tabs */}
          <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--stroke)', padding: '12px 32px' }}>
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TraceConsumerTab)}>
              <TabsList style={{ background: 'var(--stone)', padding: 4, borderRadius: 'var(--radius-md)', display: 'inline-flex', gap: 4 }}>
                <TabsTrigger value="lineage" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Lineage Graph</TabsTrigger>
                <TabsTrigger value="timeline" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Production Events</TabsTrigger>
                <TabsTrigger value="risks" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Shipment & Exposure</TabsTrigger>
                <TabsTrigger value="passport" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Batch Passport</TabsTrigger>
                <TabsTrigger value="insights" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Conversational Insights</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Active Tab Area */}
          <div style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'lineage' && adapterRequest && (
              <div style={{ flex: 1, background: 'var(--white)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', minHeight: 650, border: '1px solid var(--stroke-soft)' }}>
                <TraceGraphPanel request={adapterRequest} />
              </div>
            )}

            {activeTab === 'timeline' && adapterRequest && (
              <div style={{ background: 'var(--white)', padding: 28, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)' }}>
                <h3 className="t-serif" style={{ margin: '0 0 20px', fontSize: 'var(--fs-18)', fontWeight: 'var(--fw-semibold)' }}>Production & Logistics Journey</h3>
                <TimelinePanel request={adapterRequest} />
              </div>
            )}

            {activeTab === 'risks' && adapterRequest && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ background: 'var(--white)', padding: 28, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)' }}>
                  <h3 className="t-serif" style={{ margin: '0 0 20px', fontSize: 'var(--fs-18)', fontWeight: 'var(--fw-semibold)' }}>Recall & Customer Shipments</h3>
                  <RecallPanel request={adapterRequest} />
                </div>
              </div>
            )}

            {activeTab === 'passport' && adapterRequest && (
              <div style={{ background: 'var(--white)', padding: 28, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)' }}>
                <QualityPassportPanel request={adapterRequest} />
              </div>
            )}

            {activeTab === 'insights' && (
              <div style={{ maxWidth: 850, width: '100%', margin: '0 auto', background: 'var(--white)', padding: 32, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)', display: 'flex', flexDirection: 'column', height: 600 }}>
                <div style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="t-serif" style={{ margin: 0, fontSize: 'var(--fs-20)', fontWeight: 'var(--fw-bold)', color: 'var(--brand)' }}>Genie AI Assistant</h3>
                  <Badge style={{ background: 'var(--brand)', color: 'var(--white)', fontFamily: 'var(--font-mono)' }}>DATABRICKS API</Badge>
                </div>
                
                {/* Chat Message Log */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 10, marginBottom: 20 }}>
                  {chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      style={{
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        background: msg.sender === 'user' ? 'var(--brand)' : 'var(--stone)',
                        color: msg.sender === 'user' ? 'var(--white)' : 'var(--forest)',
                        padding: '12px 18px',
                        borderRadius: msg.sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                        fontSize: 'var(--fs-14)',
                        lineHeight: 'var(--lh-body)',
                        whiteSpace: 'pre-line',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {msg.sender === 'genie' && (
                        <div style={{ fontSize: 10, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.6, color: 'var(--brand)' }}>
                          Genie AI
                        </div>
                      )}
                      {msg.text}
                    </div>
                  ))}
                </div>

                {/* Suggestions Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)', alignSelf: 'center' }}>Suggestions:</span>
                  <Button variant="outline" size="sm" onClick={() => handleSendChat(undefined, 'Summarize visible lineage')} style={{ borderRadius: 'var(--radius-full)', padding: '4px 12px', height: 'auto', fontSize: 'var(--fs-12)', borderColor: 'var(--stroke)' }}>Summarize lineage</Button>
                  <Button variant="outline" size="sm" onClick={() => handleSendChat(undefined, 'Explain batch status')} style={{ borderRadius: 'var(--radius-full)', padding: '4px 12px', height: 'auto', fontSize: 'var(--fs-12)', borderColor: 'var(--stroke)' }}>Explain batch status</Button>
                  <Button variant="outline" size="sm" onClick={() => handleSendChat(undefined, 'Show visible graph counts')} style={{ borderRadius: 'var(--radius-full)', padding: '4px 12px', height: 'auto', fontSize: 'var(--fs-12)', borderColor: 'var(--stroke)' }}>Show visible graph counts</Button>
                </div>

                {/* Chat Input Field */}
                <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Ask Genie a question about this batch..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--stroke)',
                      outline: 'none',
                      fontSize: 'var(--fs-14)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  />
                  <Button type="submit" style={{ background: 'var(--brand)', color: 'var(--white)', fontWeight: 'var(--fw-semibold)', padding: '0 20px', borderRadius: 'var(--radius-md)' }}>
                    Send
                  </Button>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

