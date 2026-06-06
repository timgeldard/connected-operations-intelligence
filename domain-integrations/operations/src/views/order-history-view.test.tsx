import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
expect.extend(matchers)

import '@testing-library/jest-dom/vitest'
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { OrderHistoryView } from './order-history-view.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the React Query hooks
vi.mock('../adapters/process-order-review-queries.js', () => {
  return {
    useProcessOrderHeader: vi.fn(),
    useOrderOperations: vi.fn(),
    useOrderConfirmations: vi.fn(),
    useOrderGoodsMovements: vi.fn(),
  }
})

import {
  useProcessOrderHeader,
  useOrderOperations,
  useOrderConfirmations,
  useOrderGoodsMovements,
} from '../adapters/process-order-review-queries.js'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

describe('OrderHistoryView', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })

    // Default mock query implementations (empty/no-data baseline)
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)
    vi.mocked(useOrderOperations).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderOperations>)
    vi.mocked(useOrderConfirmations).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderConfirmations>)
    vi.mocked(useOrderGoodsMovements).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderGoodsMovements>)
  })

  it('renders search form and guides correctly in empty initial state', () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>,
    )

    expect(screen.getByTestId('poh-query-form')).toBeInTheDocument()
    expect(screen.getByText(/Manufacturing Order Filter Specification/i)).toBeInTheDocument()
    expect(screen.getByText(/Enter a process order to load history/i)).toBeInTheDocument()
  })

  it('validates that Process Order ID is required', async () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>,
    )

    const submitBtn = screen.getByRole('button', { name: /Run \/ Refresh Order History/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(
        screen.getByText(/Process Order ID is required before running investigation/i),
      ).toBeInTheDocument()
    })
  })

  it('submits form with valid inputs', async () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>,
    )

    const orderInput = screen.getAllByPlaceholderText(/e.g. PO-240308-3847/i)[0]
    fireEvent.change(orderInput, { target: { value: 'PO-TEST' } })

    const submitBtn = screen.getAllByRole('button', { name: /Run \/ Refresh Order History/i })[0]
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Process Order ID is required/i)).toBeNull()
    })
  })

  it('populates fields correctly when loading preset', async () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>,
    )

    const presetBtn = screen.getAllByRole('button', { name: /Load Demo-Only Fixture/i })[0]
    fireEvent.click(presetBtn)

    const orderInput = screen.getAllByPlaceholderText(/e.g. PO-240308-3847/i)[0] as HTMLInputElement
    expect(orderInput.value).toBe('PO-240308-3847')

    const plantInput = screen.getAllByPlaceholderText(/e.g. IE10/i)[0] as HTMLInputElement
    expect(plantInput.value).toBe('IE10')
  })

  it('displays mock fixture warning banner and diagnostic fieldset when preset is clicked, and auto-dismisses on input change or reset', async () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>,
    )

    // Verify preset button
    const presetBtn = screen.getAllByText(/Load Demo-Only Fixture/i)[0]
    fireEvent.click(presetBtn)

    // Warning banner should be present
    expect(screen.getByText(/Mock fixture selected/i)).toBeInTheDocument()

    // Edit process order input
    const orderInput = screen.getAllByPlaceholderText(/e.g. PO-240308-3847/i)[0]
    fireEvent.change(orderInput, { target: { value: 'NEW-PO-ID' } })

    // Warning banner should disappear
    expect(screen.queryByText(/Mock fixture selected/i)).toBeNull()

    // Click preset again to restore warning
    fireEvent.click(presetBtn)
    expect(screen.getByText(/Mock fixture selected/i)).toBeInTheDocument()

    // Edit process order input
    const orderInput2 = screen.getAllByPlaceholderText(/e.g. PO-240308-3847/i)[0]
    fireEvent.change(orderInput2, { target: { value: 'NEW-PO-ID' } })

    // Warning banner should disappear
    expect(screen.queryByText(/Mock fixture selected/i)).toBeNull()
  })

  it('renders loading indicator when parallel queries are active', () => {
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: 'PO-240308-3847' }} />
      </Wrapper>,
    )

    expect(screen.getByText(/Running native Databricks Unity Catalog queries/i)).toBeInTheDocument()
  })

  it('renders loaded content with calculated metrics, timeline, and diagnostics correctly', async () => {
    // Setup rich query responses mimicking Unity Catalog views
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: 'PO-240308-3847',
          orderType: 'process-order',
          materialId: 'MAT-CH-EMMENTAL-BLOCK',
          materialDescription: 'Emmental Block 4 kg',
          plantId: 'IE10',
          confirmedQuantity: 1860,
          plannedQuantity: 2400,
          uom: 'KG',
          plannedStart: '2024-03-08T00:00:00.000Z',
          plannedFinish: '2024-03-08T23:59:00.000Z',
          orderStatus: 'in-process',
        },
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    vi.mocked(useOrderOperations).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            operationId: 'OP-010',
            operationNumber: '0010',
            operationText: 'Milk Standardisation',
            workCentre: 'WC-CHEESE-PREP',
            status: 'confirmed',
            plannedDurationMinutes: 180,
            actualDurationMinutes: 170,
            actualStart: '2024-03-08T00:15:00.000Z',
            actualFinish: '2024-03-08T03:05:00.000Z',
            hasException: false,
          },
        ],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderOperations>)

    vi.mocked(useOrderConfirmations).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            confirmationId: 'CONF-001',
            operationId: 'OP-010',
            confirmedYield: 25000,
            uom: 'L',
            confirmedAt: '2024-03-08T03:05:00.000Z',
            confirmedBy: 'j.murphy@listowel.ie',
            setupDurationMinutes: 10,
            machineDurationMinutes: 150,
          },
        ],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderConfirmations>)

    vi.mocked(useOrderGoodsMovements).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            movementId: 'GM-001',
            movementType: '261',
            direction: 'input',
            materialId: 'MAT-RM-RAW-MILK',
            materialDescription: 'Raw Milk',
            batchId: 'RM-240308-0012',
            quantity: 25000,
            uom: 'L',
            postedAt: '2024-03-08T01:30:00.000Z',
            storageLocation: 'SL-MILK-SILO',
          },
          {
            movementId: 'GM-002',
            movementType: '101',
            direction: 'output',
            materialId: 'MAT-CH-EMMENTAL-BLOCK',
            materialDescription: 'Emmental Block 4 kg',
            batchId: 'CH-240308-0047',
            quantity: 1860,
            uom: 'KG',
            postedAt: '2024-03-08T09:30:00.000Z',
            storageLocation: 'SL-FG-CHEESE',
          },
        ],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderGoodsMovements>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: 'PO-240308-3847' }} />
      </Wrapper>,
    )

    // Check Header Card Elements
    expect(screen.getAllByText(/Process Order Header Context/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Emmental Block/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/DATABRICKS/i).length).toBeGreaterThan(0)

    // Check Operations rendering
    expect(screen.getAllByText(/Milk Standardisation/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/WC-CHEESE-PREP/i).length).toBeGreaterThan(0)

    // Check Confirmations rendering
    expect(screen.getAllByText(/CONF-001/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/j.murphy@listowel.ie/i).length).toBeGreaterThan(0)

    // Check Goods movements rendering
    expect(screen.getAllByText(/GM-001/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/SL-MILK-SILO/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Component Consumption Evidence/i)).toBeInTheDocument()
    expect(
      screen.getAllByText(/This is not a BOM or reservation coverage claim/i)[0],
    ).toBeInTheDocument()
    expect(screen.getByText(/Produced Output Evidence/i)).toBeInTheDocument()
    expect(
      screen.getAllByText(/This is not a production completion or full yield claim/i)[0],
    ).toBeInTheDocument()

    // Check Derived metrics summary
    expect(screen.getAllByText(/1,860 KG/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/25,000 L/i).length).toBeGreaterThan(0)

    // Check mixed UOM warning is rendered under exceptions
    expect(screen.getAllByText(/Mixed units of measure detected/i)[0]).toBeInTheDocument()

    // Verify chronological sorting in timeline (01:30 Goods movement -> 03:05 Confirmation)
    const timelineBlock = screen.getAllByText(/Chronological Event Timeline/i)[0].parentElement
    expect(timelineBlock).toBeInTheDocument()
    const content = timelineBlock?.textContent ?? ''
    const idxGM = content.indexOf('MAT-RM-RAW-MILK')
    const idxConf = content.indexOf('CONF-001')
    expect(idxGM).toBeGreaterThan(-1)
    expect(idxConf).toBeGreaterThan(-1)
    expect(idxGM).toBeLessThan(idxConf)

    // Collapsible technical drawer click test
    const drawerBtn = screen.getAllByRole('button', {
      name: /Show Technical Query Diagnostics/i,
    })[0]
    fireEvent.click(drawerBtn)
    expect(screen.getAllByText(/Active Endpoints/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/POST \/api\/por\/order-header/i)[0]).toBeInTheDocument()
  })

  it('renders section-level route error cards and does not render success content for that section', async () => {
    // Setup a query failure on Operations, but other queries succeed
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: 'PO-240308-3847',
          orderType: 'process-order',
          materialId: 'MAT-1',
          materialDescription: 'Mat 1',
          plantId: 'IE10',
          confirmedQuantity: 10,
          plannedQuantity: 100,
          uom: 'KG',
          plannedStart: '2024-03-08T00:00:00.000Z',
          plannedFinish: '2024-03-08T23:59:00.000Z',
          orderStatus: 'in-process',
        },
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    vi.mocked(useOrderOperations).mockReturnValue({
      data: {
        ok: false,
        error: {
          code: '503',
          message:
            'Databricks SQL warehouse integration is unavailable (BACKEND_ADAPTER_MODE not set).',
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderOperations>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: 'PO-240308-3847' }} />
      </Wrapper>,
    )

    // Header context succeeds and renders
    expect(screen.getAllByText(/Process Order Header Context/i)[0]).toBeInTheDocument()

    // Operations fails and renders route-specific error card with guidance
    expect(screen.getAllByText(/Operations Query Failed/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/BACKEND_ADAPTER_MODE/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Partial order history loaded/i)).toBeInTheDocument()
  })

  it('renders empty dynamic source status and empty state for a succeeded but empty route', async () => {
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: 'PO-240308-3847',
          orderType: 'process-order',
          materialId: 'MAT-1',
          materialDescription: 'Mat 1',
          plantId: 'IE10',
          confirmedQuantity: 10,
          plannedQuantity: 100,
          uom: 'KG',
          plannedStart: '2024-03-08T00:00:00.000Z',
          plannedFinish: '2024-03-08T23:59:00.000Z',
          orderStatus: 'in-process',
        },
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    // Succeeded but returned empty array
    vi.mocked(useOrderOperations).mockReturnValue({
      data: {
        ok: true,
        data: [],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderOperations>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: 'PO-240308-3847' }} />
      </Wrapper>,
    )

    // Expect the empty badge and safe empty placeholder for Operations
    expect(
      screen.getAllByText(/No operation records returned for this order\/source/i)[0],
    ).toBeInTheDocument()
    expect(screen.getAllByText(/NO RECORDS/i).length).toBeGreaterThan(0)
  })

  it('copies UAT evidence with section statuses, counts, and no-record warnings', async () => {
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: '7006965038',
          orderType: 'process-order',
          materialId: '70373871',
          materialDescription: 'MIXED BERRY FLV LQD',
          plantId: 'C113',
          confirmedQuantity: 0,
          plannedQuantity: 0,
          uom: '',
          plannedStart: null,
          plannedFinish: null,
          orderStatus: 'closed',
        },
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    vi.mocked(useOrderOperations).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            operationId: 'OP-010',
            operationNumber: '0010',
            operationText: 'Phase 010',
            workCentre: '',
            status: 'confirmed',
            plannedDurationMinutes: 0,
            confirmationStatus: 'final-confirmed',
            confirmed: true,
            hasException: false,
          },
        ],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderOperations>)

    vi.mocked(useOrderConfirmations).mockReturnValue({
      data: {
        ok: true,
        data: [],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderConfirmations>)

    vi.mocked(useOrderGoodsMovements).mockReturnValue({
      data: {
        ok: true,
        data: [],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderGoodsMovements>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: '7006965038', plantId: 'C113' }} />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Copy UAT Evidence/i }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })
    const payload = JSON.parse(vi.mocked(navigator.clipboard.writeText).mock.calls[0][0])
    expect(payload.sourceSummary.sections.goodsMovements).toBe('databricks-api')
    expect(payload.evidenceCompleteness.status).toBe('partial')
    expect(payload.evidenceCompleteness.sections.confirmations).toBe('partial')
    expect(payload.counts.goodsMovements).toBe(0)
    expect(payload.counts.componentMaterials).toBe(0)
    expect(payload.counts.producedBatches).toBe(0)
    expect(payload.warnings).toContain(
      'No-record sections must not be interpreted as complete absence until source coverage is validated.',
    )
  })

  it('derives net component consumption from 261 and 262 movement rows', async () => {
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: '7006965038',
          orderType: 'process-order',
          materialId: '70373871',
          materialDescription: 'MIXED BERRY FLV LQD',
          plantId: 'C113',
          confirmedQuantity: 0,
          plannedQuantity: 0,
          uom: '',
          plannedStart: null,
          plannedFinish: null,
          orderStatus: 'closed',
        },
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    vi.mocked(useOrderGoodsMovements).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            movementId: 'GM-261',
            movementType: '261',
            direction: 'input',
            materialId: '000000000070373871',
            materialDescription: 'Ingredient A',
            batchId: 'BATCH-A',
            quantity: 5000,
            uom: 'G',
            postedAt: '2026-05-18T09:00:00.000Z',
          },
          {
            movementId: 'GM-262',
            movementType: '262',
            direction: 'input',
            materialId: '000000000070373871',
            materialDescription: 'Ingredient A',
            batchId: 'BATCH-A',
            quantity: 1000,
            uom: 'G',
            postedAt: '2026-05-18T10:00:00.000Z',
          },
          {
            movementId: 'GM-EA',
            movementType: '261',
            direction: 'input',
            materialId: '000000000000PACK',
            materialDescription: 'Packaging',
            quantity: 3,
            uom: 'EA',
            postedAt: '2026-05-18T11:00:00.000Z',
          },
        ],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderGoodsMovements>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: '7006965038', plantId: 'C113' }} />
      </Wrapper>,
    )

    expect(screen.getByText(/Component Consumption Evidence/i)).toBeInTheDocument()
    expect(screen.getAllByText('000000000070373871').length).toBeGreaterThan(0)
    expect(screen.getByText('4 KG')).toBeInTheDocument()
  })

  it('derives produced output evidence from 101, 102, and 531 movement rows', async () => {
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: '7006965038',
          orderType: 'process-order',
          materialId: '70373871',
          materialDescription: 'MIXED BERRY FLV LQD',
          plantId: 'C113',
          confirmedQuantity: 0,
          plannedQuantity: 0,
          uom: '',
          plannedStart: null,
          plannedFinish: null,
          orderStatus: 'closed',
        },
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    vi.mocked(useOrderGoodsMovements).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            movementId: 'GM-101',
            movementType: '101',
            direction: 'output',
            materialId: '000000000070373871',
            materialDescription: 'Finished Good',
            batchId: 'FG-BATCH',
            quantity: 1200,
            uom: 'KG',
            postedAt: '2026-05-18T09:00:00.000Z',
            referenceDocument: '4900000011',
          },
          {
            movementId: 'GM-102',
            movementType: '102',
            direction: 'output',
            materialId: '000000000070373871',
            materialDescription: 'Finished Good',
            batchId: 'FG-BATCH',
            quantity: 200,
            uom: 'KG',
            postedAt: '2026-05-18T10:00:00.000Z',
            referenceDocument: '4900000012',
          },
          {
            movementId: 'GM-531',
            movementType: '531',
            direction: 'output',
            materialId: '000000000070373872',
            materialDescription: 'By-product',
            batchId: 'BY-BATCH',
            quantity: 500,
            uom: 'G',
            postedAt: '2026-05-18T11:00:00.000Z',
            referenceDocument: '4900000013',
          },
        ],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderGoodsMovements>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: '7006965038', plantId: 'C113' }} />
      </Wrapper>,
    )

    expect(screen.getByText(/Produced Output Evidence/i)).toBeInTheDocument()
    expect(screen.getByText('1,000 KG')).toBeInTheDocument()
    expect(screen.getByText('0.5 KG')).toBeInTheDocument()
    expect(screen.getByText('101, 102')).toBeInTheDocument()
    expect(screen.getAllByText('531').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('4900000011')).toBeInTheDocument()
  })

  it('disables planned/diagnostic filters and renders wired labels', () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>,
    )

    // Verify disabled inputs
    expect(screen.getAllByLabelText('Material ID')[0]).toBeDisabled()
    expect(screen.getAllByLabelText('Batch ID')[0]).toBeDisabled()

    // Verify explanatory copy
    expect(
      screen.getAllByText(/Planned filter — not applied to database queries/i).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(/Wired to Header query only/i)[0]).toBeInTheDocument()
  })

  // ============================================================
  // Source attribution tests (Slice 6)
  // Verify that POH header and UAT evidence payload correctly
  // derive source from AdapterResult.source, not hardcoded strings.
  // ============================================================
  describe('source attribution — derived from AdapterResult.source', () => {
    it('shows databricks-api source badge when header query returns source: databricks-api', () => {
      vi.mocked(useProcessOrderHeader).mockReturnValue({
        data: {
          ok: true,
          data: {
            processOrderId: 'PO-SRC-TEST',
            orderType: 'process-order' as const,
            materialId: 'MAT-001',
            materialDescription: 'Material',
            plantId: 'P001',
            confirmedQuantity: 0,
            plannedQuantity: 0,
            uom: 'KG',
            plannedStart: null,
            plannedFinish: null,
            orderStatus: 'closed' as const,
          },
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useProcessOrderHeader>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-SRC-TEST' }} />
        </Wrapper>,
      )

      // Source badge derives from query.data.source — must show databricks label
      expect(screen.getAllByText(/DATABRICKS/i).length).toBeGreaterThan(0)
      // Must NOT show MOCK as source when source is databricks-api
      expect(screen.queryByText(/^MOCK$/i)).toBeNull()
    })

    it('shows mock source badge when header query returns source: mock', () => {
      vi.mocked(useProcessOrderHeader).mockReturnValue({
        data: {
          ok: true,
          data: {
            processOrderId: 'PO-SRC-TEST',
            orderType: 'process-order' as const,
            materialId: 'MAT-001',
            materialDescription: 'Material',
            plantId: 'P001',
            confirmedQuantity: 0,
            plannedQuantity: 0,
            uom: 'KG',
            plannedStart: null,
            plannedFinish: null,
            orderStatus: 'closed' as const,
          },
          source: 'mock',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useProcessOrderHeader>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-SRC-TEST' }} />
        </Wrapper>,
      )

      // Source badge must derive from query.data.source — shows mock label, not databricks
      expect(screen.getAllByText(/MOCK/i).length).toBeGreaterThan(0)
    })

    it('includes section sources in UAT evidence payload — derived not hardcoded', async () => {
      vi.mocked(useProcessOrderHeader).mockReturnValue({
        data: {
          ok: true,
          data: {
            processOrderId: 'PO-SRC-PAYLOAD',
            orderType: 'process-order' as const,
            materialId: 'MAT-001',
            materialDescription: 'Material',
            plantId: 'P001',
            confirmedQuantity: 0,
            plannedQuantity: 0,
            uom: 'KG',
            plannedStart: null,
            plannedFinish: null,
            orderStatus: 'closed' as const,
          },
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useProcessOrderHeader>)
      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: { ok: true, data: [], source: 'databricks-api' },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)
      vi.mocked(useOrderOperations).mockReturnValue({
        data: { ok: true, data: [], source: 'mock' },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderOperations>)
      vi.mocked(useOrderConfirmations).mockReturnValue({
        data: undefined,
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderConfirmations>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-SRC-PAYLOAD' }} />
        </Wrapper>,
      )
      fireEvent.click(screen.getByRole('button', { name: /Copy UAT Evidence/i }))

      await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
      const payload = JSON.parse(vi.mocked(navigator.clipboard.writeText).mock.calls[0][0])

      // Each section source derives from that section's AdapterResult.source
      expect(payload.sourceSummary.sections.header).toBe('databricks-api')
      expect(payload.sourceSummary.sections.operations).toBe('mock')
      expect(payload.sourceSummary.sections.goodsMovements).toBe('databricks-api')
      // Unloaded section returns 'unknown', not hardcoded 'databricks-api'
      expect(payload.sourceSummary.sections.confirmations).toBe('unknown')
      // Mixed sources produce 'mixed' overall
      expect(payload.sourceSummary.overall).toBe('mixed')
    })
  })

  // ============================================================
  // Component consumption grouping safety regression tests
  // These tests verify that component consumption rows are grouped
  // by material + batch + UOM (not material only), and that
  // zero/negative net rows are not silently filtered out.
  // No Databricks connection is required — all data is mocked.
  // ============================================================
  describe('component consumption grouping — material + batch + uom safety rules', () => {
    function setupBaseHeader() {
      vi.mocked(useProcessOrderHeader).mockReturnValue({
        data: {
          ok: true,
          data: {
            processOrderId: 'PO-GROUPING',
            orderType: 'process-order' as const,
            materialId: 'MAT-FG',
            materialDescription: 'Finished Good',
            plantId: 'P001',
            confirmedQuantity: 0,
            plannedQuantity: 0,
            uom: 'KG',
            plannedStart: null,
            plannedFinish: null,
            orderStatus: 'closed' as const,
          },
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useProcessOrderHeader>)
    }

    // TC-1: Same material + same batch + same UOM → quantities aggregate into one row
    it('TC-1: same material + same batch + same UOM aggregates quantities into one row', () => {
      setupBaseHeader()
      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: {
          ok: true,
          data: [
            {
              movementId: 'GM-1',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 10,
              uom: 'KG',
              postedAt: '2026-01-01T00:00:00Z',
            },
            {
              movementId: 'GM-2',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 5,
              uom: 'KG',
              postedAt: '2026-01-01T01:00:00Z',
            },
          ],
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-GROUPING' }} />
        </Wrapper>,
      )

      const ccTable = screen.getByTestId('component-consumption-table')
      // One row only — material appears once in the consumption table
      expect(within(ccTable).getAllByText('MAT-RM-A').length).toBe(1)
      // Aggregate of 10 + 5 = 15 KG
      expect(within(ccTable).getByText('15 KG')).toBeInTheDocument()
    })

    // TC-2: Same material + different batches → rows remain separate
    it('TC-2: same material with different batches produces separate rows', () => {
      setupBaseHeader()
      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: {
          ok: true,
          data: [
            {
              movementId: 'GM-1',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 10,
              uom: 'KG',
              postedAt: '2026-01-01T00:00:00Z',
            },
            {
              movementId: 'GM-2',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-002',
              quantity: 8,
              uom: 'KG',
              postedAt: '2026-01-01T01:00:00Z',
            },
          ],
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-GROUPING' }} />
        </Wrapper>,
      )

      const ccTable = screen.getByTestId('component-consumption-table')
      // Both batch IDs visible in the consumption table — not collapsed into one row
      expect(within(ccTable).getAllByText('B-001').length).toBeGreaterThanOrEqual(1)
      expect(within(ccTable).getAllByText('B-002').length).toBeGreaterThanOrEqual(1)
      // Both rows present in the table — material appears twice
      expect(within(ccTable).getAllByText('MAT-RM-A').length).toBe(2)
      // Individual quantities preserved in the consumption table
      expect(within(ccTable).getByText('10 KG')).toBeInTheDocument()
      expect(within(ccTable).getByText('8 KG')).toBeInTheDocument()
    })

    // TC-3: Same material + same batch + different UOM → rows remain separate
    it('TC-3: same material + same batch with different UOM produces separate rows', () => {
      setupBaseHeader()
      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: {
          ok: true,
          data: [
            {
              movementId: 'GM-1',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 10,
              uom: 'KG',
              postedAt: '2026-01-01T00:00:00Z',
            },
            {
              movementId: 'GM-2',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 5,
              uom: 'L',
              postedAt: '2026-01-01T01:00:00Z',
            },
          ],
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-GROUPING' }} />
        </Wrapper>,
      )

      const ccTable = screen.getByTestId('component-consumption-table')
      // Each UOM visible as its own row in the consumption table — not summed across UOMs
      expect(within(ccTable).getByText('10 KG')).toBeInTheDocument()
      expect(within(ccTable).getByText('5 L')).toBeInTheDocument()
      // Two rows — material appears twice
      expect(within(ccTable).getAllByText('MAT-RM-A').length).toBe(2)
    })

    // TC-4: Same material with missing batch and known batch → rows remain separate
    it('TC-4: missing batch and known batch for same material produce separate rows', () => {
      setupBaseHeader()
      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: {
          ok: true,
          data: [
            {
              movementId: 'GM-1',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 10,
              uom: 'KG',
              postedAt: '2026-01-01T00:00:00Z',
            },
            {
              movementId: 'GM-2',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: undefined,
              quantity: 6,
              uom: 'KG',
              postedAt: '2026-01-01T01:00:00Z',
            },
          ],
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-GROUPING' }} />
        </Wrapper>,
      )

      const ccTable = screen.getByTestId('component-consumption-table')
      // Known batch row visible in consumption table
      expect(within(ccTable).getAllByText('B-001').length).toBeGreaterThanOrEqual(1)
      expect(within(ccTable).getByText('10 KG')).toBeInTheDocument()
      // Missing-batch row visible with placeholder — not merged with known batch
      expect(within(ccTable).getByText('not returned')).toBeInTheDocument()
      expect(within(ccTable).getByText('6 KG')).toBeInTheDocument()
      // Two rows total
      expect(within(ccTable).getAllByText('MAT-RM-A').length).toBe(2)
    })

    // TC-5: Negative net quantity (over-reversal) row remains visible
    it('TC-5: negative net quantity row (over-reversal) is not filtered out', () => {
      setupBaseHeader()
      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: {
          ok: true,
          data: [
            {
              movementId: 'GM-1',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 3,
              uom: 'KG',
              postedAt: '2026-01-01T00:00:00Z',
            },
            {
              movementId: 'GM-2',
              movementType: '262',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 7,
              uom: 'KG',
              postedAt: '2026-01-01T01:00:00Z',
            },
          ],
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-GROUPING' }} />
        </Wrapper>,
      )

      const ccTable = screen.getByTestId('component-consumption-table')
      // Net = 3 - 7 = -4. Row must remain visible in the consumption table.
      expect(within(ccTable).getAllByText('MAT-RM-A').length).toBeGreaterThanOrEqual(1)
      expect(within(ccTable).getByText(/-4 KG/)).toBeInTheDocument()
      // The "no rows" placeholder must NOT appear
      expect(screen.queryByText(/No net component consumption rows/i)).toBeNull()
    })

    // TC-6: Zero net quantity (full reversal) row remains visible
    it('TC-6: zero net quantity row (full reversal) is not filtered out', () => {
      setupBaseHeader()
      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: {
          ok: true,
          data: [
            {
              movementId: 'GM-1',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 5,
              uom: 'KG',
              postedAt: '2026-01-01T00:00:00Z',
            },
            {
              movementId: 'GM-2',
              movementType: '262',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 5,
              uom: 'KG',
              postedAt: '2026-01-01T01:00:00Z',
            },
          ],
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-GROUPING' }} />
        </Wrapper>,
      )

      const ccTable = screen.getByTestId('component-consumption-table')
      // Net = 0. Row must still be visible — a full reversal is evidence, not absence.
      expect(within(ccTable).getAllByText('MAT-RM-A').length).toBeGreaterThanOrEqual(1)
      // The "no rows" placeholder must NOT appear
      expect(screen.queryByText(/No net component consumption rows/i)).toBeNull()
    })

    // TC-7: Material description is not the grouping key
    it('TC-7: shared material description does not cause rows to merge — batch is the key', () => {
      setupBaseHeader()
      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: {
          ok: true,
          data: [
            {
              movementId: 'GM-1',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-001',
              quantity: 10,
              uom: 'KG',
              postedAt: '2026-01-01T00:00:00Z',
            },
            {
              movementId: 'GM-2',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM-A',
              materialDescription: 'Ingredient A',
              batchId: 'B-002',
              quantity: 8,
              uom: 'KG',
              postedAt: '2026-01-01T01:00:00Z',
            },
          ],
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-GROUPING' }} />
        </Wrapper>,
      )

      const ccTable = screen.getByTestId('component-consumption-table')
      // Both batches present in the consumption table despite identical description
      expect(within(ccTable).getAllByText('B-001').length).toBeGreaterThanOrEqual(1)
      expect(within(ccTable).getAllByText('B-002').length).toBeGreaterThanOrEqual(1)
      // Two rows — material appears twice
      expect(within(ccTable).getAllByText('MAT-RM-A').length).toBe(2)
    })

    // TC-8: Produced output full reversal — zero net row is not filtered out
    it('TC-8: produced output zero net quantity (full reversal) is not filtered out', () => {
      setupBaseHeader()
      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: {
          ok: true,
          data: [
            {
              movementId: 'GM-1',
              movementType: '101',
              direction: 'output',
              materialId: 'MAT-FG-Y',
              materialDescription: 'Finished Good Y',
              batchId: 'FG-001',
              quantity: 1000,
              uom: 'KG',
              postedAt: '2026-01-01T00:00:00Z',
              referenceDocument: '4900000001',
            },
            {
              movementId: 'GM-2',
              movementType: '102',
              direction: 'output',
              materialId: 'MAT-FG-Y',
              materialDescription: 'Finished Good Y',
              batchId: 'FG-001',
              quantity: 1000,
              uom: 'KG',
              postedAt: '2026-01-01T01:00:00Z',
              referenceDocument: '4900000002',
            },
          ],
          source: 'databricks-api',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-GROUPING' }} />
        </Wrapper>,
      )

      const poTable = screen.getByTestId('produced-output-table')
      // Net = 0. Row must remain visible — a full reversal is evidence, not absence.
      expect(within(poTable).getAllByText('MAT-FG-Y').length).toBeGreaterThanOrEqual(1)
      // The "no rows" placeholder must NOT appear
      expect(screen.queryByText(/No produced-output rows/i)).toBeNull()
    })
  })

  // ============================================================
  // Source attribution tests
  // Verifies that the source badge and UAT evidence payload derive
  // source from AdapterResult.source, not from hardcoded labels.
  // ============================================================
  describe('source attribution — derived from AdapterResult.source', () => {
    function makeHeaderQuery(source: string) {
      return {
        data: {
          ok: true,
          data: {
            processOrderId: 'PO-SOURCE-TEST',
            orderType: 'process-order' as const,
            materialId: 'MAT-TEST',
            materialDescription: 'Test Material',
            plantId: 'P001',
            confirmedQuantity: 0,
            plannedQuantity: 0,
            uom: 'KG',
            plannedStart: null,
            plannedFinish: null,
            orderStatus: 'closed' as const,
          },
          source,
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useProcessOrderHeader>
    }

    it('shows Databricks source badge when header AdapterResult.source is databricks-api', () => {
      vi.mocked(useProcessOrderHeader).mockReturnValue(makeHeaderQuery('databricks-api'))

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-SOURCE-TEST' }} />
        </Wrapper>,
      )

      expect(screen.getAllByText(/Databricks/i).length).toBeGreaterThan(0)
    })

    it('shows Mock/Sandbox source badge when header AdapterResult.source is mock', () => {
      vi.mocked(useProcessOrderHeader).mockReturnValue(makeHeaderQuery('mock'))

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-SOURCE-TEST' }} />
        </Wrapper>,
      )

      expect(screen.getAllByText(/Mock\/Sandbox/i).length).toBeGreaterThan(0)
    })

    it('UAT evidence payload captures per-section sources and derives mixed overall when sections differ', async () => {
      vi.mocked(useProcessOrderHeader).mockReturnValue(makeHeaderQuery('databricks-api'))
      vi.mocked(useOrderOperations).mockReturnValue({
        data: { ok: true, data: [], source: 'mock' },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderOperations>)
      // confirmations data undefined → getSectionSource returns 'unknown'
      vi.mocked(useOrderConfirmations).mockReturnValue({
        data: undefined,
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderConfirmations>)
      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: { ok: true, data: [], source: 'databricks-api' },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-SOURCE-TEST' }} />
        </Wrapper>,
      )

      fireEvent.click(screen.getByRole('button', { name: /Copy UAT Evidence/i }))

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled()
      })
      const payload = JSON.parse(vi.mocked(navigator.clipboard.writeText).mock.calls[0][0])
      expect(payload.sourceSummary.sections.header).toBe('databricks-api')
      expect(payload.sourceSummary.sections.operations).toBe('mock')
      expect(payload.sourceSummary.sections.confirmations).toBe('unknown')
      expect(payload.sourceSummary.sections.goodsMovements).toBe('databricks-api')
      expect(payload.sourceSummary.overall).toBe('mixed')
    })
  })

  // ============================================================
  // Missing movement quantity regression
  // ============================================================
  describe('missing movement quantity regression', () => {
    it('skips missing movement quantities instead of defaulting to zero', () => {
      vi.mocked(useProcessOrderHeader).mockReturnValue({
        data: {
          ok: true,
          data: {
            processOrderId: 'PO-NULL-GM',
            orderType: 'process-order',
            materialId: 'MAT-FG',
            materialDescription: 'Finished Good',
            plantId: 'P001',
            confirmedQuantity: 0,
            plannedQuantity: 0,
            uom: 'KG',
            plannedStart: null,
            plannedFinish: null,
            orderStatus: 'closed',
          },
          source: 'mock',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useProcessOrderHeader>)

      vi.mocked(useOrderGoodsMovements).mockReturnValue({
        data: {
          ok: true,
          data: [
            {
              movementId: 'GM-NULL',
              movementType: '261',
              direction: 'input',
              materialId: 'MAT-RM',
              materialDescription: 'Raw Material',
              batchId: 'BATCH-1',
              // Critical: missing quantity
              quantity: null,
              uom: 'KG',
              postedAt: '2026-05-18T09:00:00.000Z',
            },
          ],
          source: 'mock',
        },
        isLoading: false,
      } as unknown as ReturnType<typeof useOrderGoodsMovements>)

      render(
        <Wrapper>
          <OrderHistoryView request={{ processOrderId: 'PO-NULL-GM' }} />
        </Wrapper>,
      )

      // The timeline text must not display "GI: 0"
      const textContent = document.body.textContent || ''
      expect(textContent).not.toContain('GI: 0')
      expect(textContent).not.toContain('GR: 0')
      // Timeline might format it differently, but it must not use 0 to sum up net consumption.
      expect(textContent).toMatch(/No net component consumption rows derived/i)
    })
  })
})
