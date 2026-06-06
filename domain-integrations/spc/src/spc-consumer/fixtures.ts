export interface SPCConsumerSearchItem {
  readonly materialId: string
  readonly materialDescription: string
  readonly plantId: string
  readonly plantName: string
  readonly characteristicId: string
  readonly characteristicName: string
  readonly batchId?: string
  readonly workCentreId?: string
}

export const spcConsumerSearchRegistry: readonly SPCConsumerSearchItem[] = [
  {
    materialId: 'MAT-CH-EMMENTAL-BLOCK',
    materialDescription: 'Emmental Block 4 kg',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    characteristicId: 'CHAR-PH-001',
    characteristicName: 'pH',
    batchId: 'CH-240308-0047',
    workCentreId: 'WC-IE10-PASTEURISATION',
  },
  {
    materialId: 'MAT-CH-EMMENTAL-BLOCK',
    materialDescription: 'Emmental Block 4 kg',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    characteristicId: 'CHAR-MOISTURE-001',
    characteristicName: 'Moisture %',
    batchId: 'CH-240308-0047',
    workCentreId: 'WC-IE10-PASTEURISATION',
  },
  {
    materialId: 'MAT-CH-EMMENTAL-BLOCK',
    materialDescription: 'Emmental Block 4 kg',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    characteristicId: 'CHAR-FAT-001',
    characteristicName: 'Fat %',
    batchId: 'CH-240307-0031',
    workCentreId: 'WC-IE10-PASTEURISATION',
  },
  {
    materialId: 'MAT-CH-EMMENTAL-BLOCK',
    materialDescription: 'Emmental Block 4 kg',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    characteristicId: 'CHAR-SALT-001',
    characteristicName: 'Salt %',
    batchId: 'CH-240307-0032',
    workCentreId: 'WC-IE10-PASTEURISATION',
  },
  {
    materialId: 'MAT-CH-EMMENTAL-BLOCK',
    materialDescription: 'Emmental Block 4 kg',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    characteristicId: 'CHAR-TEXTURE-001',
    characteristicName: 'Texture Score',
    batchId: 'CH-240306-0022',
    workCentreId: 'WC-IE10-PASTEURISATION',
  },
  {
    materialId: 'MAT-CH-CHEDDAR-WHITE',
    materialDescription: 'Mild White Cheddar 20 kg',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    characteristicId: 'CHAR-PH-001',
    characteristicName: 'pH',
    batchId: 'CH-240305-0018',
    workCentreId: 'WC-IE10-PASTEURISATION',
  },
  {
    materialId: 'MAT-CH-CHEDDAR-WHITE',
    materialDescription: 'Mild White Cheddar 20 kg',
    plantId: 'US10',
    plantName: 'Kerry Wisconsin',
    characteristicId: 'CHAR-PH-001',
    characteristicName: 'pH',
    batchId: 'CH-240309-0099',
    workCentreId: 'WC-US10-PASTEURISATION',
  },
]
