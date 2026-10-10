export interface SessionSummary {
  filename: string;
  sourceFilenames?: string[];
  multiPassLabel?: string;
  multiPassType?: 'BENT_SCREENING' | 'POLC_RERUN' | 'RETEST' | 'STANDARD';
  operator: string;
  startTime: string;
  endTime: string;
  barcodeNumber: string;
  lotNumber: string;
  model: string;
  total: number;
  okQty: number;
  ng1Qty: number;
  ng2Qty: number;
  ng3Qty: number;
  retestQty: number;
  yieldRate: string;
  ngRate: string;
  rstRate: string;
  speed: string;
}

export interface DefectRecord {
  lotNumber: string;
  filename: string;
  camera: string;
  no: number;
  testItem: string;
  baseCategory?: string;
  ngQty: number;
  rawNgQty?: number;
  normalizedNgQty?: number;
  ngRate: number;
  loLim: string;
  hiLim: string;
  unit: string;
  ngBox: string;
  sessionStartTime?: string;
}

export interface IngestionLog {
  filename: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
  yieldRate?: string | null;
}
