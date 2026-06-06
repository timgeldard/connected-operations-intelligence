import type { TraceConsumerSearchItem } from './bindings.js'

/**
 * Search fixtures retained from the Claude Design POC.
 *
 * @remarks
 * These values drive the designed search journey only. They are not a governed
 * material/batch search data product.
 */
export const TRACE_CONSUMER_SEARCH_FIXTURES: readonly TraceConsumerSearchItem[] = [
  {
    materialId: '20035129',
    materialDescription: 'CHEESE POWDER BLEND 25KG',
    batchId: '8000049668',
    plantId: 'C061',
    plantName: 'Kerry Cork (C061)',
    processOrderId: '007006964801',
  },
  {
    materialId: '20035129',
    materialDescription: 'CHEESE POWDER BLEND 25KG',
    batchId: '8000049669',
    plantId: 'C061',
    plantName: 'Kerry Cork (C061)',
    processOrderId: '007006964802',
  },
  {
    materialId: '20035130',
    materialDescription: 'WHEY POWDER BLEND 25KG',
    batchId: '8000049668',
    plantId: 'C061',
    plantName: 'Kerry Cork (C061)',
    processOrderId: '007006964803',
  },
  {
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
    processOrderId: 'PO-240308-1189',
  },
  {
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE11',
    plantName: 'Kerry Charleville (IE11)',
    processOrderId: 'PO-240308-1189',
  },
  {
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0048',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
    processOrderId: 'PO-240308-1190',
  },
  {
    materialId: '100023848',
    materialDescription: 'CHEDDAR CHEESE NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
    processOrderId: 'PO-240308-1191',
  },
]
