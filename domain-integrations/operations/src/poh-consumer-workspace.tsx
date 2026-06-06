import { useState, useEffect } from 'react'
import {
  useProcessOrderHeader,
  useOrderOperations,
  useOrderConfirmations,
  useOrderGoodsMovements,
  useProcessOrderSearch,
} from './adapters/process-order-review-queries.js'
import { PohGeniePilotPanel } from './panels/poh-genie-pilot-panel.js'
import {
  resolvePohConsumerSearch,
  resolvePohConsumerSelection,
  type ResolvedPohConsumerRequest,
  type PohConsumerMatchedOrder,
  type PohConsumerMaterialOption,
  type PohConsumerPlantOption,
  type PohConsumerSearchStep,
} from './poh-consumer/bindings.js'
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  StatusBadge,
} from '@connectio/design-system'
import type { ScopeContext } from '@connectio/data-contracts'

export function ProcessOrderConsumerWorkspace({ scope }: { readonly scope: ScopeContext }) {
  const [request, setRequest] = useState<ResolvedPohConsumerRequest | null>(
    scope.processOrderId
      ? {
          processOrderId: scope.processOrderId,
          plantId: scope.plantId ?? '',
          materialId: scope.materialId,
          batchId: scope.batchId,
        }
      : null
  )

  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'consumption' | 'output' | 'genie'>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [searchStep, setSearchStep] = useState<PohConsumerSearchStep>('idle')
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [searchError, setSearchError] = useState('')
  
  const [matchedOrders, setMatchedOrders] = useState<PohConsumerMatchedOrder[]>([])
  const [matchedMaterialOptions, setMatchedMaterialOptions] = useState<PohConsumerMaterialOption[]>([])
  const [plantsToSelect, setPlantsToSelect] = useState<PohConsumerPlantOption[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<{ id: string; description: string } | null>(null)
  const [tempOrderId, setTempOrderId] = useState('')

  // Search query Hook
  const { data: searchResult, isLoading: searchLoading } = useProcessOrderSearch(
    { query: submittedQuery },
    { enabled: searchStatus === 'loading' && submittedQuery !== '' }
  )

  useEffect(() => {
    if (searchStatus === 'loading' && !searchLoading && searchResult) {
      if (!searchResult.ok) {
        setSearchStatus('error')
        setSearchError(searchResult.error.message)
        return
      }

      setSearchStatus('idle')
      const items = searchResult.data.items
      const parsed = resolvePohConsumerSearch(submittedQuery, items)

      if (parsed.step === 'materials-for-query') {
        setMatchedMaterialOptions([...parsed.materials])
        setMatchedOrders([...parsed.orders])
        setSearchStep('materials-for-query')
      } else if (parsed.step === 'orders-for-material') {
        setMatchedOrders([...parsed.orders])
        setSelectedMaterial(parsed.selectedMaterial)
        setSearchStep('orders-for-material')
      } else if (parsed.step === 'select-plant') {
        setTempOrderId(parsed.processOrderId)
        setPlantsToSelect([...parsed.plants])
        setSearchStep('select-plant')
      } else if (parsed.step === 'resolved') {
        setRequest(parsed.request)
        setSearchStep('idle')
      } else {
        setSearchStep('no-results')
      }
    }
  }, [searchLoading, searchResult, searchStatus, submittedQuery])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setSubmittedQuery(searchQuery.trim())
    setSearchStatus('loading')
    setSearchError('')
    setSearchStep('idle')
    setMatchedOrders([])
    setMatchedMaterialOptions([])
    setPlantsToSelect([])
    setSelectedMaterial(null)
  }

  const selectOrder = (orderId: string) => {
    const res = resolvePohConsumerSelection(orderId, matchedOrders)
    if (res.step === 'resolved') {
      setRequest(res.request)
      setSearchStep('idle')
      setSearchQuery('')
    } else if (res.step === 'select-plant') {
      setTempOrderId(res.processOrderId)
      setPlantsToSelect([...res.plants])
      setSearchStep('select-plant')
    }
  }

  const selectMaterial = (material: PohConsumerMaterialOption) => {
    const filtered = matchedOrders.filter(o => o.materialId === material.materialId)
    setMatchedOrders(filtered)
    setSelectedMaterial({ id: material.materialId, description: material.description })
    setSearchStep('orders-for-material')
  }

  const selectPlant = (plantId: string) => {
    const matchingOrder = matchedOrders.find(
      o => o.processOrderId === tempOrderId && o.plantId === plantId
    )
    setRequest({
      processOrderId: tempOrderId,
      plantId,
      materialId: matchingOrder?.materialId,
      batchId: matchingOrder?.batchId ?? undefined,
    })
    setSearchStep('idle')
    setSearchQuery('')
  }

  const goBackSearch = () => {
    if (searchStep === 'select-plant') {
      setSearchStep(selectedMaterial ? 'orders-for-material' : 'idle')
    } else if (searchStep === 'orders-for-material' && matchedMaterialOptions.length > 0) {
      setSelectedMaterial(null)
      setSearchStep('materials-for-query')
    } else {
      setSearchStep('idle')
      setSearchQuery('')
    }
  }

  const handleBackToDashboard = () => {
    setRequest(null)
    setSearchQuery('')
    setSearchStep('idle')
    setSearchStatus('idle')
  }

  const loadPreset = (val: string) => {
    setSearchQuery(val)
    setSearchStatus('loading')
  }

  // Active POH context fetch hooks
  const headerRequest = request ? { processOrderId: request.processOrderId, plantId: request.plantId } : { processOrderId: '' }
  const headerQuery = useProcessOrderHeader(headerRequest, { enabled: !!request })
  const operationsQuery = useOrderOperations(headerRequest, { enabled: !!request })
  const confirmationsQuery = useOrderConfirmations(headerRequest, { enabled: !!request })
  const goodsMovementsQuery = useOrderGoodsMovements(headerRequest, { enabled: !!request })

  const header = headerQuery.data?.ok ? headerQuery.data.data : null
  const operations = operationsQuery.data?.ok ? operationsQuery.data.data : []
  const confirmations = confirmationsQuery.data?.ok ? confirmationsQuery.data.data : []
  const goodsMovements = goodsMovementsQuery.data?.ok ? goodsMovementsQuery.data.data : []

  // Derived timeline
  const sortedTimeline = (() => {
    const list: Array<{ id: string; date: Date; title: string; desc: string; type: string }> = []
    operations.forEach(op => {
      if (op.actualStart) {
        list.push({
          id: `op-s-${op.operationId}`,
          date: new Date(op.actualStart),
          title: `Op Start: ${op.operationNumber}`,
          desc: `${op.operationText} at ${op.workCentre || 'Line'}`,
          type: 'start',
        })
      }
      if (op.actualFinish) {
        list.push({
          id: `op-f-${op.operationId}`,
          date: new Date(op.actualFinish),
          title: `Op End: ${op.operationNumber}`,
          desc: `${op.operationText} completed`,
          type: 'finish',
        })
      }
    })
    confirmations.forEach(cf => {
      if (cf.confirmedAt) {
        list.push({
          id: `cf-${cf.confirmationId}`,
          date: new Date(cf.confirmedAt),
          title: `Yield Confirmed`,
          desc: `Confirmed ${cf.confirmedYield?.toLocaleString() || 0} ${cf.uom || ''} by ${cf.confirmedBy || 'Operator'}`,
          type: 'confirmation',
        })
      }
    })
    goodsMovements.forEach(gm => {
      if (gm.postedAt) {
        list.push({
          id: `gm-${gm.movementId}`,
          date: new Date(gm.postedAt),
          title: `Goods Issue [${gm.movementType}]`,
          desc: `${gm.direction.toUpperCase()}: ${gm.quantity?.toLocaleString() || 0} ${gm.uom || ''} (Batch: ${gm.batchId || '-'})`,
          type: 'movement',
        })
      }
    })
    return list.sort((a, b) => a.date.getTime() - b.date.getTime())
  })()

  // Derived components and produced output
  const componentConsumption = (() => {
    const map = new Map<string, { materialId: string; description?: string; quantity: number; uom: string }>()
    goodsMovements.forEach(gm => {
      if (gm.movementType === '261' || gm.movementType === '262') {
        const sign = gm.movementType === '262' ? -1 : 1
        const uom = (gm.uom || 'KG').trim().toUpperCase()
        const key = `${gm.materialId}:${uom}`
        const existing = map.get(key)
        const qty = (gm.quantity ?? 0) * sign
        if (existing) {
          existing.quantity += qty
        } else {
          map.set(key, {
            materialId: gm.materialId,
            description: gm.materialDescription,
            quantity: qty,
            uom,
          })
        }
      }
    })
    return Array.from(map.values())
  })()

  const producedOutput = (() => {
    const map = new Map<string, { materialId: string; description?: string; quantity: number; uom: string; batchId?: string }>()
    goodsMovements.forEach(gm => {
      if (gm.movementType === '101' || gm.movementType === '102' || gm.movementType === '531') {
        const sign = gm.movementType === '102' ? -1 : 1
        const key = `${gm.materialId}:${gm.batchId || ''}`
        const existing = map.get(key)
        const qty = (gm.quantity ?? 0) * sign
        const uom = (gm.uom || 'KG').trim().toUpperCase()
        if (existing) {
          existing.quantity += qty
        } else {
          map.set(key, {
            materialId: gm.materialId,
            description: gm.materialDescription,
            quantity: qty,
            uom,
            batchId: gm.batchId,
          })
        }
      }
    })
    return Array.from(map.values())
  })()

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#F8FAFC',
    color: '#0F172A',
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  const searchHeaderStyle: React.CSSProperties = {
    background: '#047857',
    color: '#FFFFFF',
    padding: '24px 32px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  }

  return (
    <div style={containerStyle}>
      {request === null ? (
        // Premium Landing Dashboard (Plant-Level Analytics)
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#064e3b', margin: '0 0 4px' }}>Process Order History</h1>
              <p style={{ color: '#64748b', margin: 0 }}>Active Plant Context: <strong style={{ color: '#047857' }}>{scope.plantId || 'IE10'}</strong></p>
            </div>
            <div style={{ fontSize: 11, background: '#e2e8f0', color: '#475569', padding: '4px 10px', borderRadius: 4, fontFamily: 'monospace' }}>
              BACKEND: {import.meta.env.VITE_ADAPTER_MODE || 'mock'}
            </div>
          </div>

          {/* Search Box */}
          <Card style={{ padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12 }}>
              <input
                type="text"
                placeholder="Search process order, material description, or batch ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontSize: 14 }}
              />
              <Button type="submit" disabled={searchStatus === 'loading'} style={{ background: '#047857', color: '#fff', borderRadius: 8, padding: '0 24px' }}>
                {searchStatus === 'loading' ? 'Searching...' : 'Search'}
              </Button>
            </form>

            {searchStatus === 'error' && (
              <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{searchError}</div>
            )}

            {/* Recommendations */}
            <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span>Quick Presets:</span>
              <button type="button" onClick={() => loadPreset('PO-240308-3847')} style={{ color: '#047857', border: 'none', background: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer' }}>PO-240308-3847</button>
              <span>·</span>
              <button type="button" onClick={() => loadPreset('7006965038')} style={{ color: '#047857', border: 'none', background: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer' }}>7006965038</button>
              <span>·</span>
              <button type="button" onClick={() => loadPreset('emmental')} style={{ color: '#047857', border: 'none', background: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer' }}>emmental</button>
            </div>
          </Card>

          {/* Search Result Steps */}
          {searchStep === 'materials-for-query' && (
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#0f172a' }}>Select Product:</h3>
                <button type="button" onClick={goBackSearch} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>← Back</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {matchedMaterialOptions.map(mat => (
                  <button key={mat.materialId} type="button" onClick={() => selectMaterial(mat)} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{mat.description}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Material ID: {mat.materialId}</div>
                    </div>
                    <span style={{ color: '#047857', fontSize: 12 }}>{mat.orderCount} orders →</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {searchStep === 'orders-for-material' && (
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#0f172a' }}>Select Process Order for {selectedMaterial?.description}:</h3>
                <button type="button" onClick={goBackSearch} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>← Back</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {matchedOrders.map(o => (
                  <button key={o.processOrderId} type="button" onClick={() => selectOrder(o.processOrderId)} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Order: {o.processOrderId}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Plant: {o.plantName} | Status: {o.orderStatus}</div>
                    </div>
                    <span style={{ color: '#047857', fontSize: 12 }}>Select →</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {searchStep === 'select-plant' && (
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#0f172a' }}>Select Plant for Order {tempOrderId}:</h3>
                <button type="button" onClick={goBackSearch} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>← Back</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plantsToSelect.map(p => (
                  <button key={p.id} type="button" onClick={() => selectPlant(p.id)} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {searchStep === 'no-results' && (
            <Card style={{ padding: 20, textAlign: 'center', color: '#ef4444' }}>
              No process orders matched your search query. Try another keyword.
            </Card>
          )}

          {/* Plant-Level Analytics Dashboard Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
            {/* Pours Analytics */}
            <Card style={{ border: '1px solid #e2e8f0' }}>
              <CardHeader>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#064e3b', margin: 0 }}>Pour Volume & Timelines</h2>
                <CardDescription>Shift MT-261 Pours executed</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#047857' }}>12 Pours</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Active this shift</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>24,500 KG</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Total Mass Poured</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recent Pour Events:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                    <span>Pour #102 — Raw Milk Tank 1</span>
                    <strong style={{ color: '#047857' }}>6,200 KG</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                    <span>Pour #101 — Rennet Addition</span>
                    <strong style={{ color: '#047857' }}>150 KG</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                    <span>Pour #100 — Starter Culture</span>
                    <strong style={{ color: '#047857' }}>800 KG</strong>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Yield & Losses */}
            <Card style={{ border: '1px solid #e2e8f0' }}>
              <CardHeader>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#064e3b', margin: 0 }}>Yield & Variance</h2>
                <CardDescription>Target vs Confirmed output</CardDescription>
              </CardHeader>
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>Average Plant Yield</span>
                    <strong>98.2%</strong>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: '98.2%', height: '100%', background: '#047857' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>Target Yield</span>
                    <strong>98.5%</strong>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: '98.5%', height: '100%', background: '#3b82f6' }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', padding: 8, borderRadius: 6, borderLeft: '3px solid #047857' }}>
                  💡 Plant output is currently performing <strong>On Target</strong>. Scrap levels are within UAT control limits.
                </div>
              </CardContent>
            </Card>

            {/* Quality status */}
            <Card style={{ border: '1px solid #e2e8f0' }}>
              <CardHeader>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#064e3b', margin: 0 }}>Connected Quality</h2>
                <CardDescription>Inspection status overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>6 Lots</div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Inspected</span>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>0 Failed</div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Characteristics</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span>Usage Decision Pending:</span>
                  <strong style={{ color: '#d97706' }}>1 Lot</strong>
                </div>
                <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span>Open Deviations:</span>
                  <strong>0</strong>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        // Detailed Order Investigation Canvas
        <>
          <header style={searchHeaderStyle}>
            <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Button onClick={handleBackToDashboard} style={{ background: 'transparent', color: '#fff', border: 'none', padding: 0, cursor: 'pointer', marginBottom: 8 }}>
                  ← Back to Plant Dashboard
                </Button>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Order History Canvas</h1>
                {header && (
                  <div style={{ fontSize: 13, color: '#a7f3d0', marginTop: 4 }}>
                    Order: {header.processOrderId} | Material: {header.materialDescription} ({header.materialId}) | Plant: {header.plantId}
                  </div>
                )}
              </div>
              {header && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <StatusBadge label={header.orderStatus || 'Released'} variant={header.orderStatus === 'confirmed' ? 'good' : 'warn'} />
                </div>
              )}
            </div>
          </header>

          {/* Navigation Tabs */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
              <Tabs value={activeTab} onValueChange={val => setActiveTab(val as any)}>
                <TabsList style={{ background: 'transparent', display: 'flex', gap: 24, padding: '12px 0' }}>
                  <TabsTrigger value="overview" style={{ padding: '8px 4px', borderBottom: activeTab === 'overview' ? '2px solid #047857' : 'none', fontWeight: 600, color: activeTab === 'overview' ? '#047857' : '#64748b' }}>Order Details</TabsTrigger>
                  <TabsTrigger value="timeline" style={{ padding: '8px 4px', borderBottom: activeTab === 'timeline' ? '2px solid #047857' : 'none', fontWeight: 600, color: activeTab === 'timeline' ? '#047857' : '#64748b' }}>Timeline & Events</TabsTrigger>
                  <TabsTrigger value="consumption" style={{ padding: '8px 4px', borderBottom: activeTab === 'consumption' ? '2px solid #047857' : 'none', fontWeight: 600, color: activeTab === 'consumption' ? '#047857' : '#64748b' }}>Material Consumption</TabsTrigger>
                  <TabsTrigger value="output" style={{ padding: '8px 4px', borderBottom: activeTab === 'output' ? '2px solid #047857' : 'none', fontWeight: 600, color: activeTab === 'output' ? '#047857' : '#64748b' }}>Produced Batches</TabsTrigger>
                  <TabsTrigger value="genie" style={{ padding: '8px 4px', borderBottom: activeTab === 'genie' ? '2px solid #047857' : 'none', fontWeight: 600, color: activeTab === 'genie' ? '#047857' : '#64748b' }}>POH Assistant</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Active Canvas tab content */}
          <div style={{ flex: 1, padding: 32, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Card style={{ padding: 20 }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#064e3b' }}>Process Order Info</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Planned Qty</div>
                      <strong style={{ fontSize: 16 }}>{header?.plannedQuantity?.toLocaleString() || '-'} {header?.uom}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Confirmed Qty</div>
                      <strong style={{ fontSize: 16 }}>{header?.confirmedQuantity?.toLocaleString() || '-'} {header?.uom}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Planned Start</div>
                      <span style={{ fontSize: 13 }}>{header?.plannedStart ? new Date(header.plannedStart).toLocaleString() : '-'}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Planned Finish</div>
                      <span style={{ fontSize: 13 }}>{header?.plannedFinish ? new Date(header.plannedFinish).toLocaleString() : '-'}</span>
                    </div>
                  </div>
                </Card>

                <Card style={{ padding: 20 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#064e3b' }}>Operational Phases ({operations.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {operations.map(op => (
                      <div key={op.operationId} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid #f1f5f9', borderRadius: 6, background: '#fff' }}>
                        <div>
                          <strong style={{ fontSize: 14 }}>{op.operationNumber} — {op.operationText}</strong>
                          <div style={{ fontSize: 12, color: '#64748b' }}>Work Centre: {op.workCentre || '-'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 12, background: op.status === 'confirmed' ? '#d1fae5' : '#fef3c7', color: op.status === 'confirmed' ? '#065f46' : '#92400e', padding: '2px 8px', borderRadius: 12 }}>
                            {op.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'timeline' && (
              <Card style={{ padding: 24 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#064e3b' }}>Order Execution Log</h3>
                {sortedTimeline.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: 14 }}>No production events recorded for this order.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {sortedTimeline.map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                        {idx !== sortedTimeline.length - 1 && (
                          <div style={{ position: 'absolute', left: 7, top: 20, bottom: -16, width: 2, background: '#cbd5e1' }} />
                        )}
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#047857', marginTop: 2, zIndex: 2 }} />
                        <div>
                          <strong style={{ fontSize: 14, display: 'block' }}>{item.title}</strong>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{item.date.toLocaleString()}</span>
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#334155' }}>{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'consumption' && (
              <Card style={{ padding: 24 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#064e3b' }}>Component Consumption Evidence (MT-261/262)</h3>
                {componentConsumption.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: 13 }}>No component consumption data found.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid #cbd5e1', color: '#64748b' }}>
                        <th style={{ padding: '8px 12px' }}>Material ID</th>
                        <th style={{ padding: '8px 12px' }}>Description</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Net Quantity</th>
                        <th style={{ padding: '8px 12px' }}>UOM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {componentConsumption.map(row => (
                        <tr key={row.materialId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.materialId}</td>
                          <td style={{ padding: '10px 12px' }}>{row.description || '-'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{row.quantity.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px' }}>{row.uom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            )}

            {activeTab === 'output' && (
              <Card style={{ padding: 24 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#064e3b' }}>Produced Output Batches (MT-101/102/531)</h3>
                {producedOutput.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: 13 }}>No produced output data found.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid #cbd5e1', color: '#64748b' }}>
                        <th style={{ padding: '8px 12px' }}>Material ID</th>
                        <th style={{ padding: '8px 12px' }}>Description</th>
                        <th style={{ padding: '8px 12px' }}>Batch ID</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Net Quantity</th>
                        <th style={{ padding: '8px 12px' }}>UOM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {producedOutput.map(row => (
                        <tr key={`${row.materialId}:${row.batchId}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.materialId}</td>
                          <td style={{ padding: '10px 12px' }}>{row.description || '-'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{row.batchId || '-'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{row.quantity.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px' }}>{row.uom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            )}

            {activeTab === 'genie' && (
              <div style={{ height: '100%', minHeight: 500 }}>
                <PohGeniePilotPanel request={headerRequest} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
