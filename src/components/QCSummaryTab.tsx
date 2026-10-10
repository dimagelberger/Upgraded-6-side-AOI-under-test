import React, { useRef, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Search, 
  ArrowRight, 
  User, 
  Calendar, 
  Boxes, 
  Check, 
  X,
  RefreshCw,
  Download,
  Clock,
  Zap,
  Play
} from 'lucide-react';

export interface QCDefectItem {
  name: string;
  qty: number;
}

export interface QCSessionRecord {
  lotNumber: string;
  dateStr?: string;       // QC date/time
  dateVal?: Date | null;  // Parsed Date object for comparison
  model?: string;
  totalQty?: number;
  okQty?: number;
  ngQty?: number;
  yieldRate?: string;
  operator?: string;
  defectDesc?: string;
  result?: string;        // 'A' or 'R' or 'Accept' or 'Reject' etc.
  rawRecord?: any;
  defectsList?: QCDefectItem[];
}

interface QCSummaryTabProps {
  qcAutoSessions: QCSessionRecord[]; // Legacy, maintained for compatibility if needed
  qcManualSessions: QCSessionRecord[];
  onAutoLoaded: (records: QCSessionRecord[], filename: string) => void;
  onManualLoaded: (records: QCSessionRecord[], filename: string) => void;
  qcAutoFilename: string;
  qcManualFilename: string;
  onClearQCData: () => void;
  
  // Handlers for Parent component machine software logs
  machineSessions?: any[]; 
  filteredMachineSessions?: any[];

  selectedMonths?: string[];
  selectedWeeks?: string[];
  selectedDates?: string[];
}

import { parseDateTime, getWeekInfo } from '../utils/dateUtils';

// Safely parse timestamps into Date objects for comparison
export function parseDateSafe(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  
  if (typeof val === 'number') {
    // If it's a numeric Excel serial date
    if (val > 30000 && val < 60000) {
      const dateObj = new Date((val - 25569) * 86400 * 1000);
      return isNaN(dateObj.getTime()) ? null : dateObj;
    }
  }

  const str = String(val).trim();
  const t = parseDateTime(str);
  if (t !== -1) {
    return new Date(t);
  }
  
  // Try fixing slashes or dashes
  const replaced = str.replace(/-/g, '/');
  const d = new Date(replaced);
  if (!isNaN(d.getTime())) {
    return d;
  }
  return null;
}

function formatDateToDDMMYYYY(dateInput: Date | string | undefined | null): string {
  if (!dateInput) return '-';
  
  let dateObj: Date | null = null;
  
  if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else {
    const str = String(dateInput).trim();
    if (!str || str === '-') return '-';
    
    const ddmmyyyyRegex = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/;
    const match = str.split(' ')[0].match(ddmmyyyyRegex);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);
      const p3 = parseInt(match[3], 10);
      if (p1 > 12) {
        const dayStr = String(p1).padStart(2, '0');
        const monthStr = String(p2).padStart(2, '0');
        const yearStr = String(p3);
        return `${dayStr}-${monthStr}-${yearStr}`;
      }
    }
    
    const rDate = parseDateSafe(str);
    if (rDate && !isNaN(rDate.getTime())) {
      dateObj = rDate;
    }
  }
  
  if (dateObj && !isNaN(dateObj.getTime())) {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  }
  
  const fallbackStr = String(dateInput).split(' ')[0].trim();
  const parts = fallbackStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${day}-${month}-${year}`;
    }
    if (parts[2].length === 4) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      if (p1 <= 12 && p2 > 12) {
        const month = String(p1).padStart(2, '0');
        const day = String(p2).padStart(2, '0');
        const year = parts[2];
        return `${day}-${month}-${year}`;
      } else if (p1 > 12 && p2 <= 12) {
        const day = String(p1).padStart(2, '0');
        const month = String(p2).padStart(2, '0');
        const year = parts[2];
        return `${day}-${month}-${year}`;
      } else {
        const day = String(dateObj ? dateObj.getDate() : parts[1]).padStart(2, '0');
        const month = String(dateObj ? dateObj.getMonth() + 1 : parts[0]).padStart(2, '0');
        const year = parts[2];
         return `${day}-${month}-${year}`;
      }
    }
  }
  
  return fallbackStr;
}

const matchField = (header: string): string | null => {
  const h = header.toLowerCase().trim().replace(/[\s\-_]/g, '');
  
  if (h.includes('lotnumber') || h.includes('lotid') || h.includes('lot') || h.includes('批号') || h.includes('批次') || h.includes('工单') || h.includes('barcode') || h.includes('条码')) {
    return 'lotNumber';
  }
  if (h.includes('date') || h.includes('time') || h.includes('日期') || h.includes('时间') || h.includes('检测日期') || h.includes('检验日期')) {
    return 'dateStr';
  }
  if (h.includes('model') || h.includes('part') || h.includes('型号') || h.includes('机型') || h.includes('品名') || h.includes('产品')) {
    return 'model';
  }
  if (h.includes('totalqty') || h.includes('totalcount') || h.includes('total') || h.includes('input') || h.includes('总数') || h.includes('投入') || h.includes('数量')) {
    if (h.includes('bad') || h.includes('ng') || h.includes('reject') || h.includes('defect') || h.includes('不良') || h.includes('损坏')) {
      return 'ngQty';
    }
    return 'totalQty';
  }
  if (h.includes('okqty') || h.includes('goodqty') || h.includes('ok') || h.includes('good') || h.includes('良品数') || h.includes('合格数') || h.includes('良品qty') || h.includes('合格qty') || h.includes('成品')) {
    return 'okQty';
  }
  if (h.includes('ngqty') || h.includes('badqty') || h.includes('rejectqty') || h.includes('ng') || h.includes('reject') || h.includes('defect') || h.includes('不良数') || h.includes('不合格数') || h.includes('废品') || h.includes('不良qty') || h.includes('报废')) {
    return 'ngQty';
  }
  if (h.includes('yieldrate') || h.includes('yield') || h.includes('rate') || h.includes('良率') || h.includes('合格率') || h.includes('通过率')) {
    return 'yieldRate';
  }
  if (h.includes('operator') || h.includes('inspector') || h.includes('qc') || h.includes('检验') || h.includes('人员') || h.includes('操作员') || h.includes('签字') || h.includes('检验员') || h.includes('审核')) {
    return 'operator';
  }
  
  // Map outcomes/decisions to result (e.g., A/R, accept/reject, pass/fail)
  if (h.includes('判定') || h.includes('结论') || h.includes('结果') || h.includes('result') || h.includes('decision') || h.includes('status') || h === 'ar' || h === 'a/r' || h.includes('passfail') || h.includes('outcome') || h.includes('judg')) {
    return 'result';
  }
  
  if (h.includes('remark') || h.includes('reason') || h.includes('cause') || h.includes('note') || h.includes('备注') || h.includes('描述') || h.includes('原因') || h.includes('异常')) {
    return 'defectDesc';
  }
  return null;
};

function extractDefectsFromRow(row: any[], headerRow?: any[]): QCDefectItem[] {
  const items: QCDefectItem[] = [];
  if (!headerRow) return items;

  // Let's identify columns dynamically by looking at the header row
  // We want to find columns like 'PPM III 1', 'PPM III 2', etc.
  // And their adjacent quantity column, typically 'PPM III √'
  
  const structuralPairs: { nameIdx: number, qtyIdx: number }[] = [];
  for (let c = 0; c < headerRow.length - 1; c++) {
    const h = String(headerRow[c] || '').trim().toLowerCase();
    
    // If the column header looks like a defect name column
    if (h.startsWith('ppm iii') && !h.includes('√')) {
       // Check if the next column is the quantity column (usually 'PPM III √')
       const nextH = String(headerRow[c+1] || '').trim().toLowerCase();
       if (nextH.includes('ppm iii') && (nextH.includes('√') || nextH.includes('v'))) {
          structuralPairs.push({ nameIdx: c, qtyIdx: c + 1 });
       } else if (h.match(/ppm iii \d+/)) {
          // If we couldn't match the specific checkmark, but it's clearly a PPM III N column, 
          // let's assume the very next column is the qty, as per standard structure.
          structuralPairs.push({ nameIdx: c, qtyIdx: c + 1 });
       }
    }
  }

  structuralPairs.forEach(({ nameIdx, qtyIdx }) => {
    if (nameIdx < row.length) {
      const nameVal = row[nameIdx];
      if (nameVal !== undefined && nameVal !== null && String(nameVal).trim() !== '') {
        const nameStr = String(nameVal).trim();
        const lw = nameStr.toLowerCase();
        
        // Skip header titles themselves if they somehow land here
        if (lw === 'vi defect' || lw === 'defect' || lw === 'qty' || lw === 'quantity') {
          return;
        }
        
        // Ignore "adh.test", panasonic, and other non-VI tests (but DO NOT ignore TEPA)
        if (lw.includes('adh.test') || lw.includes('adh test') || lw.includes('adhes') || lw.includes('panasonic')) {
          return;
        }

        let qty = 0;
        if (qtyIdx < row.length) {
          const qtyVal = row[qtyIdx];
          if (qtyVal !== undefined && qtyVal !== null && qtyVal !== '') {
            qty = parseInt(String(qtyVal).replace(/,/g, ''), 10);
          }
        }
        if (isNaN(qty) || qty <= 0) {
          qty = 1; // Default to 1 if no valid positive qty
        }
        items.push({ name: nameStr, qty });
      }
    }
  });

  // If we found any structural defects, return active list immediately
  if (items.length > 0) {
    return items;
  }

  // Fallback pattern matching for other columns (if any)
  const defectKeywords = [
    'platting', 'plating', 'coating', 'laser', 'marking', 'crack', 'cracks', 
    'body', 'damaged', 'terminal', 'terminal level', 'cut', 'bridge', 'open', 'illegible', 'bubble'
  ];

  for (let c = 0; c < row.length; c++) {
    const headerVal = headerRow[c];
    if (headerVal !== undefined && headerVal !== null && typeof headerVal === 'string') {
      const hClean = headerVal.toLowerCase().trim();
      if (hClean.includes('adh.test') || hClean.includes('adh test') || hClean.includes('adhes') || hClean.includes('panasonic')) {
        continue;
      }

      const isKeyword = defectKeywords.some(keyword => hClean.includes(keyword));
      if (isKeyword) {
        const val = row[c];
        if (val !== undefined && val !== null && val !== '') {
          const qty = parseInt(String(val).replace(/,/g, ''), 10);
          if (!isNaN(qty) && qty > 0) {
            items.push({ name: headerVal.trim(), qty });
          }
        }
      }
    }
  }

  if (items.length === 0) {
    for (let c = 0; c < row.length - 1; c++) {
      const val = row[c];
      if (val !== undefined && val !== null && typeof val === 'string' && val.trim() !== '') {
        const cleanVal = val.toLowerCase().trim();
        if (cleanVal.includes('adh.test') || cleanVal.includes('adh test') || cleanVal.includes('adhes') || cleanVal.includes('panasonic')) {
          continue;
        }

        const isKeywordDefect = defectKeywords.some(keyword => cleanVal.includes(keyword));
        if (isKeywordDefect) {
          const nextVal = row[c + 1];
          if (nextVal !== undefined && nextVal !== null && nextVal !== '') {
            const qty = parseInt(String(nextVal).replace(/,/g, ''), 10);
            if (!isNaN(qty) && qty > 0) {
              items.push({ name: val.trim(), qty });
            }
          }
        }
      }
    }
  }

  return items;
}

function cleanRemarksString(text: string): string {
  if (!text) return '';
  const parts = text.split(/\||\n/);
  const cleanedParts = parts.map(part => {
    const p = part.trim();
    const pl = p.toLowerCase();
    // If the part contains any of the forbidden terms, ignore it entirely
    if (pl.includes('adh.test') || pl.includes('adh test') || pl.includes('adhesion') || pl.includes('adhes') || pl.includes('panasonic')) {
      return '';
    }
    return p;
  }).filter(p => p !== '');
  return cleanedParts.join(' | ');
}

function extractRemarksFromRow(row: any[], headerRow: any[]): string {
  if (!headerRow) return '';
  const parts: string[] = [];
  for (let c = 0; c < row.length; c++) {
    const headerVal = headerRow[c];
    if (headerVal !== undefined && headerVal !== null) {
      const hStr = String(headerVal).toLowerCase().trim();
      if (hStr.includes('remark') || hStr === 'notes' || hStr === 'note' || hStr.includes('备注') || hStr.includes('comment')) {
        const val = row[c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const valStr = String(val).trim();
          const cleaned = cleanRemarksString(valStr);
          if (cleaned) {
            parts.push(cleaned);
          }
        }
      }
    }
  }
  return parts.join(' | ');
}

export function parseRawRowsToRecords(rawRows: any[][], filename: string): QCSessionRecord[] {
  let headerRowIndex = -1;
  let matchedFieldsMap = new Map<number, string>();

  // Scan rows to find a header row
  const rowLimit = Math.min(20, rawRows.length);
  for (let r = 0; r < rowLimit; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    let matchCount = 0;
    const tempMap = new Map<number, string>();

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const fieldName = matchField(String(val));
        if (fieldName) {
          tempMap.set(c, fieldName);
          if (fieldName === 'lotNumber') {
            matchCount += 3; // weigh lot number heavily
          } else {
            matchCount++;
          }
        }
      }
    }

    if (matchCount >= 2 || (matchCount >= 1 && tempMap.values().next().value === 'lotNumber')) {
      headerRowIndex = r;
      matchedFieldsMap = tempMap;
      break;
    }
  }

  // Fallback: Use row 0 if no clear header
  if (headerRowIndex === -1) {
    for (let r = 0; r < rawRows.length; r++) {
      if (rawRows[r] && rawRows[r].some(v => v !== null && v !== '')) {
        headerRowIndex = r;
        const row = rawRows[r];
        for (let c = 0; c < row.length; c++) {
          const fieldName = matchField(String(row[c] || ''));
          if (fieldName) matchedFieldsMap.set(c, fieldName);
        }
        break;
      }
    }
  }

  if (headerRowIndex === -1) return [];

  const records: QCSessionRecord[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    if (row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
      continue;
    }

    const rec: Partial<QCSessionRecord> = {
      lotNumber: '',
      rawRecord: {}
    };

    const rawObj: any = {};

    for (let c = 0; c < row.length; c++) {
      const cellVal = row[c];
      const headerVal = rawRows[headerRowIndex][c];
      if (headerVal !== undefined && headerVal !== null && headerVal !== '') {
        rawObj[String(headerVal).trim()] = cellVal;
      }

      const fieldName = matchedFieldsMap.get(c);
      if (fieldName) {
        if (fieldName === 'lotNumber') {
          rec.lotNumber = cellVal !== undefined && cellVal !== null ? String(cellVal).trim().replace(/^["']|["']$/g, '') : '';
        } else if (fieldName === 'dateStr') {
          if (cellVal !== undefined && cellVal !== null) {
            // Excel decimal dates formatting helper if date is a float
            if (typeof cellVal === 'number' && cellVal > 30000 && cellVal < 60000) {
              const dateObj = new Date((cellVal - 25569) * 86400 * 1000);
              rec.dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              rec.dateVal = dateObj;
            } else {
              rec.dateStr = String(cellVal).trim();
              rec.dateVal = parseDateSafe(cellVal);
            }
          }
        } else if (fieldName === 'model') {
          rec.model = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : undefined;
        } else if (fieldName === 'operator') {
          rec.operator = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : undefined;
        } else if (fieldName === 'result') {
          rec.result = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : undefined;
        } else if (fieldName === 'yieldRate') {
          if (cellVal !== undefined && cellVal !== null) {
            if (typeof cellVal === 'number') {
              rec.yieldRate = (cellVal * 100).toFixed(2) + '%';
            } else {
              rec.yieldRate = String(cellVal).trim();
            }
          }
        } else if (fieldName === 'totalQty' || fieldName === 'okQty' || fieldName === 'ngQty') {
          if (cellVal !== undefined && cellVal !== null) {
            const numVal = typeof cellVal === 'number' ? cellVal : parseInt(String(cellVal).replace(/,/g, ''));
            rec[fieldName] = isNaN(numVal) ? 0 : numVal;
          }
        }
      }
    }

    // Default lot number fallback to first column if empty
    if (!rec.lotNumber) {
      const col0 = row[0];
      if (col0 !== undefined && col0 !== null && String(col0).trim() !== '') {
        rec.lotNumber = String(col0).trim().replace(/^["']|["']$/g, '');
      }
    }

    if (rec.lotNumber && rec.lotNumber.length >= 2) {
      rec.rawRecord = rawObj;
      if (!rec.dateVal && rec.dateStr) {
        rec.dateVal = parseDateSafe(rec.dateStr);
      }

      // Extract detailed defects (e.g., plating on side, plating on top bottom, etc.)
      const defects = extractDefectsFromRow(row, rawRows[headerRowIndex]);
      rec.defectsList = defects;

      // Extract combined remarks spanning all Remarks/Notes columns
      const combinedRemarks = extractRemarksFromRow(row, rawRows[headerRowIndex]);
      rec.defectDesc = combinedRemarks ? cleanRemarksString(combinedRemarks) : undefined;

      // Check Submission and Status VI from header mapping
      let submissionVal = '';
      if (rawObj['Submission']) {
        submissionVal = String(rawObj['Submission']).trim().toUpperCase();
      } else if (rawObj['Submition']) {
        submissionVal = String(rawObj['Submition']).trim().toUpperCase();
      }

      let statusViVal = '';
      const matchingKey = Object.keys(rawObj).find(k => k.toLowerCase() === 'status vi' || k.toLowerCase().includes('status vi'));
      if (matchingKey) {
        statusViVal = String(rawObj[matchingKey]).trim().toUpperCase();
      } else {
        const fallbackKey = Object.keys(rawObj).find(k => k.toLowerCase() === 'status');
        if (fallbackKey) {
          statusViVal = String(rawObj[fallbackKey]).trim().toUpperCase();
        }
      }

      if (statusViVal === 'R' || statusViVal === 'REJECT') {
        rec.result = 'R';
        if (rec.ngQty === undefined || rec.ngQty === 0) {
          rec.ngQty = defects.reduce((sum, d) => sum + d.qty, 0) || 1; // Default to at least 1 if reject is flagged
        }
      } else if (statusViVal === 'A' || statusViVal === 'ACCEPT' || statusViVal === 'PASS') {
        rec.result = 'A';
        rec.defectsList = []; // ensure empty for clean accept
        rec.ngQty = 0;
      } else {
        // If defects exist, the result is Reject (R). Otherwise default to Accept (A).
        if (defects.length > 0) {
          rec.result = 'R';
          if (rec.ngQty === undefined || rec.ngQty === 0) {
            rec.ngQty = defects.reduce((sum, d) => sum + d.qty, 0);
          }
        } else {
          if (!rec.result) {
            rec.result = 'A';
          }
        }
      }

      // Merge continuation rows into the previous record
      const prevRec = records.length > 0 ? records[records.length - 1] : null;
      if (
        prevRec && 
        prevRec.lotNumber === rec.lotNumber && 
        (!statusViVal) && 
        (!rec.dateStr || prevRec.dateStr === rec.dateStr) &&
        (!submissionVal)
      ) {
        if (rec.defectsList && rec.defectsList.length > 0) {
          prevRec.defectsList = prevRec.defectsList || [];
          prevRec.defectsList.push(...rec.defectsList);
        }
        if (rec.defectDesc) {
           prevRec.defectDesc = prevRec.defectDesc ? prevRec.defectDesc + ' | ' + rec.defectDesc : rec.defectDesc;
        }
        if (rec.ngQty && rec.ngQty > 0 && prevRec.result !== 'A') {
           // update total NG qty for the main record
           prevRec.ngQty = (prevRec.ngQty || 0) + rec.ngQty;
        }
        if (prevRec.defectsList && prevRec.defectsList.length > 0) {
           prevRec.result = 'R';
           prevRec.ngQty = prevRec.defectsList.reduce((sum, d) => sum + d.qty, 0);
        }
      } else {
        records.push(rec as QCSessionRecord);
      }
    }
  }

  return records;
}

export function QCSummaryTab({
  qcAutoSessions = [],
  qcManualSessions = [],
  onAutoLoaded,
  onManualLoaded,
  qcAutoFilename = '',
  qcManualFilename = '',
  onClearQCData,
  machineSessions = [],
  filteredMachineSessions = [],
  selectedMonths = [],
  selectedWeeks = [],
  selectedDates = []
}: QCSummaryTabProps) {
  const fileManualRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'OK_VERIFIED' | 'DISCREPANCY' | 'PENDING'>('ALL');
  const [localModelFilter, setLocalModelFilter] = useState<'ALL' | '1206' | '2010'>('ALL');

  // Timeline-based comparison engine
  const analyzedLots = useMemo(() => {
    // 1. Filter QC manual and auto sessions by global date filters
    const allQCSessions = [...qcManualSessions, ...qcAutoSessions];
    let filteredQC = allQCSessions;
    if (selectedMonths.length > 0) {
      filteredQC = filteredQC.filter(s => {
        if (!s.dateVal) return false;
        const monthString = s.dateVal.toLocaleDateString('default', { month: '2-digit', year: '2-digit' });
        return selectedMonths.includes(monthString);
      });
    }
    if (selectedWeeks.length > 0) {
      filteredQC = filteredQC.filter(s => {
        if (!s.dateVal) return false;
        const weekInfo = getWeekInfo(s.dateVal);
        return selectedWeeks.includes(weekInfo);
      });
    }
    if (selectedDates.length > 0) {
      filteredQC = filteredQC.filter(s => {
        if (!s.dateVal) return false;
        const dateString = s.dateVal.toLocaleDateString();
        return selectedDates.includes(dateString);
      });
    }

    // 2. Identify target lots from filtered machine data and filtered QC data using O(N) grouping
    const qcByLot = new Map<string, QCSessionRecord[]>();
    filteredQC.forEach(s => {
      const lotKey = s.lotNumber?.trim().toLowerCase();
      if (lotKey) {
        if (!qcByLot.has(lotKey)) {
          qcByLot.set(lotKey, []);
        }
        qcByLot.get(lotKey)!.push(s);
      }
    });

    const machineByLot = new Map<string, any[]>();
    filteredMachineSessions.forEach(s => {
      const lotKey = s.lotNumber?.trim().toLowerCase();
      if (lotKey) {
        if (!machineByLot.has(lotKey)) {
          machineByLot.set(lotKey, []);
        }
        machineByLot.get(lotKey)!.push(s);
      }
    });

    // Combine unique lots
    const allCandidateLots = Array.from(new Set([...Array.from(machineByLot.keys()), ...Array.from(qcByLot.keys())]));

    const isTargetModelLocal = (modelName?: string) => {
      if (!modelName) return false;
      const m = modelName.toLowerCase();
      if (localModelFilter === 'ALL') {
         return m.includes('1206') || m.includes('2010');
      }
      return m.includes(localModelFilter);
    };

    const targetLots = allCandidateLots.filter(lotNum => {
      const manualRecords = qcByLot.get(lotNum) || [];
      const matchingRuns = machineByLot.get(lotNum) || [];
      
      const hasManualTarget = manualRecords.some(r => isTargetModelLocal(r.model));
      const hasMachineTarget = matchingRuns.some(r => isTargetModelLocal(r.model));
      
      return hasManualTarget || hasMachineTarget;
    });

    return targetLots.map(lotNum => {
      // Find all manual QC entries for this lot
      const manualEntriesForLot = qcByLot.get(lotNum) || [];
      
      // Sort manual entries by dateVal ascending
      const sortedManualEntries = [...manualEntriesForLot].sort((a, b) => {
        const timeA = a.dateVal ? a.dateVal.getTime() : 0;
        const timeB = b.dateVal ? b.dateVal.getTime() : 0;
        return timeA - timeB;
      });

      // Find matching machine runs
      const matchingMachineRuns = machineByLot.get(lotNum) || [];
      
      const sortedMachineRuns = [...matchingMachineRuns].sort((a, b) => {
        const timeA = a.startTime ? parseDateTime(a.startTime) : 0;
        const timeB = b.startTime ? parseDateTime(b.startTime) : 0;
        return timeA - timeB;
      });

      const hasMachineRun = sortedMachineRuns.length > 0;
      const primaryMachineRun = sortedMachineRuns[0];

      const machineStartTime = primaryMachineRun ? parseDateSafe(primaryMachineRun.startTime) : null;
      const machineEndTime = primaryMachineRun ? parseDateSafe(primaryMachineRun.endTime) : null;

      // Classify manual QC records relative to machine process time window
      const preMachineEntries: QCSessionRecord[] = [];
      const postMachineEntries: QCSessionRecord[] = [];
      const ambiguousEntries: QCSessionRecord[] = [];

      let hasSeenPostMachineAccept = false;

      // Process from newest to oldest to identify if a later Accept exists
      for (let i = sortedManualEntries.length - 1; i >= 0; i--) {
        const entry = sortedManualEntries[i];
        const qcDate = entry.dateVal || parseDateSafe(entry.dateStr);
        if (!hasMachineRun || !qcDate || !machineStartTime) {
          ambiguousEntries.unshift(entry);
          continue;
        }

        const qcDateOnly = new Date(qcDate.getFullYear(), qcDate.getMonth(), qcDate.getDate());
        const machineDateOnly = new Date(machineStartTime.getFullYear(), machineStartTime.getMonth(), machineStartTime.getDate());

        if (qcDateOnly.getTime() < machineDateOnly.getTime()) {
          preMachineEntries.unshift(entry);
        } else if (qcDateOnly.getTime() > machineDateOnly.getTime()) {
          if (entry.result?.toUpperCase() === 'A') {
            hasSeenPostMachineAccept = true;
          }
          postMachineEntries.unshift(entry);
        } else {
          // Same day as machine run
          const isAccept = entry.result?.toUpperCase() === 'A' || !entry.result;
          const isReject = entry.result?.toUpperCase() === 'R' || (entry.defectsList && entry.defectsList.length > 0) || (entry.ngQty && entry.ngQty > 0);

          if (isAccept) {
            hasSeenPostMachineAccept = true;
            postMachineEntries.unshift(entry);
          } else if (isReject && hasSeenPostMachineAccept) {
            // Reject on same day, but there's a LATER Accept. So this reject was pre-machine.
            preMachineEntries.unshift(entry);
          } else {
            postMachineEntries.unshift(entry);
          }
        }
      }

      // Performance evaluation calculations (Is the machine working well?)
      let machinePerfStatus: 'OK' | 'VERIFIED' | 'DISCREPANCY' | 'PENDING' = 'OK';
      let machinePerfDesc = 'Passed machine with zero post-machine rejects or leaks.';

      if (!hasMachineRun) {
        machinePerfStatus = 'PENDING';
        machinePerfDesc = '⏳ Lot is logged in QC, but has not passed the machine yet (Pending software logs).';
      } else {
        const totalNgBeforeMachine = preMachineEntries.reduce((sum, e) => sum + (e.ngQty ?? e.defectsList?.reduce((acc, d) => acc + d.qty, 0) ?? 0), 0);
        const machineNgDetected = (primaryMachineRun.ng1Qty ?? 0) + (primaryMachineRun.ng2Qty ?? 0) + (primaryMachineRun.ng3Qty ?? 0);

        // Find if post-machine has any leaks (either result says R or it lists post-defects)
        const hasPostRejects = postMachineEntries.some(
          e => {
            const res = e.result?.toUpperCase() || '';
            const desc = (e.defectDesc || '').toUpperCase();
            const countsAsReject = res === 'R' || res.startsWith('REJ') || (e.ngQty ?? 0) > 0 || (e.defectsList && e.defectsList.length > 0);
            
            // If the remark contains "TEPA", it's a special test case that is considered acceptable
            if (desc.includes('TEPA')) return false;
            
            return countsAsReject;
          }
        );

        if (hasPostRejects) {
          machinePerfStatus = 'DISCREPANCY';
          machinePerfDesc = `🚨 Defect Leak Slipped: Post-QC hand inspection detected rejects AFTER machine run. The machine failed to filter these out! Calibration advised.`;
        } else if (totalNgBeforeMachine > 0) {
          const hasTepaInPre = preMachineEntries.some(e => (e.defectDesc || '').toUpperCase().includes('TEPA'));
          
          if (machineNgDetected > 0) {
            machinePerfStatus = 'VERIFIED';
            machinePerfDesc = `🔍 Calibration Verified: Humans found ${totalNgBeforeMachine} rejects prior. The AOI machine successfully identified and filtered defects (${machineNgDetected} defects reported). Calibration is fully aligned.`;
          } else if (hasTepaInPre) {
            machinePerfStatus = 'VERIFIED';
            machinePerfDesc = `🔍 Calibration Verified (Special): Humans logged ${totalNgBeforeMachine} defect(s) involving TEPA tests. The machine correctly ignored these and reported 0 defects. Acceptable behavior confirmed.`;
          } else {
            machinePerfStatus = 'DISCREPANCY';
            machinePerfDesc = `🚨 Calibration Alarm: Pre-QC logged ${totalNgBeforeMachine} defects, but machine reported 0 defects during software run. Check camera sensors!`;
          }
        } else {
          machinePerfStatus = 'OK';
          machinePerfDesc = `✅ Perfect Run: Clean lot with zero Pre-QC rejects. Machine operated as intended and human Post-QC reported zero leakage.`;
        }
      }

      return {
        lotNumber: lotNum,
        manualEntries: sortedManualEntries,
        preMachineEntries,
        postMachineEntries,
        ambiguousEntries,
        machineRuns: sortedMachineRuns,
        primaryMachineRun,
        hasMachineRun,
        machineStartTime,
        machineEndTime,
        machinePerfStatus,
        machinePerfDesc
      };
    });
  }, [qcManualSessions, qcAutoSessions, filteredMachineSessions, localModelFilter, selectedMonths, selectedWeeks, selectedDates]);

  // Combined performance stats
  const stats = useMemo(() => {
    let pending = 0;
    let okVerified = 0;
    let discrepancy = 0;

    analyzedLots.forEach(lot => {
      if (lot.machinePerfStatus === 'PENDING') pending++;
      else if (lot.machinePerfStatus === 'DISCREPANCY') discrepancy++;
      else okVerified++;
    });

    const activeRunCount = analyzedLots.length - pending;
    const accuracyRate = activeRunCount > 0 
      ? Math.round((okVerified / activeRunCount) * 100) 
      : 100;

    return {
      totalLots: analyzedLots.length,
      pending,
      okVerified,
      discrepancy,
      accuracyRate
    };
  }, [analyzedLots]);

  // Dynamic filter lists
  const filteredProcessedLots = useMemo(() => {
    return analyzedLots.filter(lot => {
      const s = searchTerm.trim().toLowerCase();
      const matchesSearch = !s || 
        lot.lotNumber.toLowerCase().includes(s) ||
        (lot.primaryMachineRun?.model && lot.primaryMachineRun.model.toLowerCase().includes(s)) ||
        lot.manualEntries.some(e => e.defectDesc && e.defectDesc.toLowerCase().includes(s)) ||
        lot.manualEntries.some(e => e.operator && e.operator.toLowerCase().includes(s));

      if (!matchesSearch) return false;

      // Local Model Filter
      const matchesLocalModel = localModelFilter === 'ALL' || 
        (localModelFilter === '1206' && (
           lot.lotNumber.toLowerCase().includes('1206') || 
           lot.manualEntries.some(e => e.model?.toLowerCase().includes('1206')) || 
           lot.primaryMachineRun?.model?.toLowerCase().includes('1206')
        )) ||
        (localModelFilter === '2010' && (
           lot.lotNumber.toLowerCase().includes('2010') || 
           lot.manualEntries.some(e => e.model?.toLowerCase().includes('2010')) || 
           lot.primaryMachineRun?.model?.toLowerCase().includes('2010')
        ));

      if (!matchesLocalModel) return false;

      if (filterType === 'OK_VERIFIED') {
        return lot.machinePerfStatus === 'OK' || lot.machinePerfStatus === 'VERIFIED';
      }
      if (filterType === 'DISCREPANCY') {
        return lot.machinePerfStatus === 'DISCREPANCY';
      }
      if (filterType === 'PENDING') {
        return lot.machinePerfStatus === 'PENDING';
      }

      return true;
    });
  }, [analyzedLots, searchTerm, filterType, localModelFilter]);

  // Seeding realistic datasets derived from user machine sessions to test cases instantly
  const handleSeedSamples = () => {
    const seededManuals: QCSessionRecord[] = [];

    // Case 1: WSL-1206 lot with Pre-Machine defect logging and Verification Caught
    seededManuals.push({
      lotNumber: '10058937',
      dateStr: '6/17/2026',
      dateVal: new Date('2026-06-17T00:00:00'),
      model: 'WSL-1206',
      totalQty: 14745,
      operator: 'Sarah (Pre-Check)',
      result: 'R',
      defectDesc: 'plating on side-1, plating on laser cut-1',
      defectsList: [
        { name: 'plating on side', qty: 1 },
        { name: 'Plating on top bottom', qty: 4 },
        { name: 'plating on laser cut', qty: 1 }
      ]
    });

    seededManuals.push({
      lotNumber: '10058937',
      dateStr: '6/17/2026',
      dateVal: new Date('2026-06-17T00:00:00'),
      model: 'WSL-1206',
      totalQty: 14745,
      operator: 'John (Post-Check)',
      result: 'A',
      defectDesc: '',
      defectsList: []
    });

    // Case 2: WSL-2010 lot representing Post-Machine Defect Leakage (Discrepancy)
    seededManuals.push({
      lotNumber: '10059999',
      dateStr: '6/17/2026',
      dateVal: new Date('2026-06-17T00:00:00'),
      model: 'WSL-2010-Gold',
      totalQty: 21865,
      operator: 'Dave (Pre-Check)',
      result: 'A',
      defectDesc: 'No visible pre-defects',
      defectsList: []
    });

    seededManuals.push({
      lotNumber: '10059999',
      dateStr: '6/17/2026',
      dateVal: new Date('2026-06-17T00:00:00'),
      model: 'WSL-2010-Gold',
      totalQty: 21865,
      operator: 'Sarah (Post-QC)',
      result: 'R',
      defectDesc: 'Found defective laser cuts in finished bin',
      defectsList: [
        { name: 'plating on laser cut', qty: 3 }
      ]
    });

    // Case 3: WSL-1206 lot that has not entered the machine yet (Pending)
    seededManuals.push({
      lotNumber: '10068888',
      dateStr: '6/18/2026',
      dateVal: new Date('2026-06-18T00:00:00'),
      model: 'WSL-1206 Mangan',
      totalQty: 8500,
      operator: 'Steve',
      result: 'R',
      defectDesc: 'Platting On Side-1, Damaged Body-2',
      defectsList: [
        { name: 'plating on side', qty: 1 },
        { name: 'damaged body', qty: 2 }
      ]
    });

    // If there are real machine sessions, we can map extra session targets
    if (machineSessions && machineSessions.length > 0) {
      machineSessions.slice(0, 2).forEach(lot => {
        const runLot = lot.lotNumber;
        if (runLot && runLot !== '10058937' && runLot !== '10059999') {
          // Add a clean pass same-day verification check
          seededManuals.push({
            lotNumber: runLot,
            dateStr: '6/17/2026',
            dateVal: new Date('2026-06-17T00:00:00'),
            model: lot.model?.includes('1206') || lot.model?.includes('2010') ? lot.model : 'WSL-1206',
            totalQty: lot.total,
            operator: 'Dave (Post-Check)',
            result: 'A',
            defectDesc: '',
            defectsList: []
          });
        }
      });
    }

    onManualLoaded(seededManuals, 'Simulated_QC_Manual_Log.xlsx');
  };

  const handleExportReconciliation = () => {
    try {
      const wb = XLSX.utils.book_new();

      const summaryHeader = [
        ["MACHINE PERFORMANCE RECONCILIATION REPORT (TIMELINE BASED)"],
        ["Export Date", new Date().toLocaleString()],
        ["Source QC File", qcManualFilename || "N/A"],
        [],
        ["STATION AUDIT RATIOS"],
        ["Total Lot IDs Logged", stats.totalLots],
        ["Machine Efficiency Grade", `${stats.accuracyRate}%`],
        ["Perfect Matches & Verified Rejects", stats.okVerified],
        ["Calibration Alarm/Leaks (Discrepancy)", stats.discrepancy],
        ["Awaiting Conveyor Run (Pending)", stats.pending]
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryHeader);
      wsSummary['!cols'] = [{ wch: 35 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Verification Metrics");

      // Detailed Lot Table
      const tableHeaders = [
        "Lot ID",
        "Machine Status",
        "Performance Explanation",
        "Machine Run Time (Start - End)",
        "Machine Total Input",
        "Machine Software Defects",
        "QC Pre-Machine Date/Rejects",
        "QC Post-Machine Date/Result",
        "QC Operator Signoff",
        "Remarks & Hand Notes"
      ];

      const tableRows = analyzedLots.map(lot => {
        let runTimeStr = 'N/A';
        if (lot.primaryMachineRun) {
          runTimeStr = `${lot.primaryMachineRun.startTime || ''} to ${lot.primaryMachineRun.endTime || ''}`;
        }

        const preQCStr = lot.preMachineEntries.map(e => `${e.dateStr} (Rejects: ${e.ngQty})`).join(', ') || 'None';
        const postQCStr = lot.postMachineEntries.map(e => `${e.dateStr} (${e.result || 'Accept'})`).join(', ') || 'None';
        const operatorStr = Array.from(new Set(lot.manualEntries.map(e => e.operator).filter(Boolean))).join(', ') || 'N/A';
        const remarkStr = lot.manualEntries.map(e => e.defectDesc).filter(Boolean).join(' | ') || 'Passed';

        const machineNg = lot.primaryMachineRun 
          ? (lot.primaryMachineRun.ng1Qty ?? 0) + (lot.primaryMachineRun.ng2Qty ?? 0) + (lot.primaryMachineRun.ng3Qty ?? 0)
          : '-';

        return [
          lot.lotNumber,
          lot.machinePerfStatus === 'PENDING' ? 'Not Run' : lot.machinePerfStatus,
          lot.machinePerfDesc,
          runTimeStr,
          lot.primaryMachineRun?.total ?? '-',
          machineNg,
          preQCStr,
          postQCStr,
          operatorStr,
          remarkStr
        ];
      });

      const wsTable = XLSX.utils.aoa_to_sheet([tableHeaders, ...tableRows]);
      wsTable['!cols'] = [
        { wch: 18 }, // Lot
        { wch: 15 }, // Status
        { wch: 45 }, // Explanation
        { wch: 35 }, // Run Time
        { wch: 12 }, // Total
        { wch: 15 }, // Machine ng
        { wch: 25 }, // Pre QC
        { wch: 25 }, // Post QC
        { wch: 15 }, // Operator
        { wch: 35 }  // Remarks
      ];

      XLSX.utils.book_append_sheet(wb, wsTable, "Lot Validation Logs");

      XLSX.writeFile(wb, `Machine_Calibration_Report_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`);
    } catch (e: any) {
      alert("Spreadsheet build failed: " + e.message);
    }
  };

  const hasData = qcManualSessions.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent animate-in fade-in duration-300">
      
      {/* RECONCILIATION SUMMARY SCORECARD */}
      {hasData && (
        <div className="mt-4 bg-[#0d0f14]/40 border-b border-zinc-900/60 py-3.5 px-1.5 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs font-bold font-mono text-zinc-450 uppercase tracking-widest">Calibration Ratios:</div>
            
            <div 
              onClick={() => setFilterType('ALL')}
              className="px-2.5 py-1 bg-zinc-950/80 border border-zinc-800 rounded flex items-center gap-1.5 text-xs font-semibold text-zinc-350 cursor-pointer hover:bg-zinc-850 hover:text-zinc-100 transition-colors"
              title="Click to show All Lots"
            >
              <Boxes className="w-3.5 h-3.5 text-zinc-500" /> Managed QC Lots: <span className="text-zinc-100 font-mono font-bold">{stats.totalLots}</span>
            </div>

            <div className={`px-2.5 py-1 rounded border flex items-center gap-1.5 text-xs font-bold ${
              stats.accuracyRate > 85 ? 'bg-emerald-955/20 border-emerald-900/30 text-emerald-450' : 'bg-amber-955/20 border-amber-900/30 text-amber-500'
            }`}>
              <Clock className="w-3.5 h-3.5" /> Machine Accuracy: <span className="font-mono">{stats.accuracyRate}%</span>
            </div>

            {stats.discrepancy > 0 && (
              <div 
                onClick={() => setFilterType('DISCREPANCY')}
                className="px-2.5 py-1 bg-red-955/25 border border-red-900/40 rounded flex items-center gap-1.5 text-xs font-bold text-red-400 animate-pulse cursor-pointer hover:bg-red-900/35 hover:text-red-350 transition-colors"
                title="Click to instantly filter defected lots (Defects Slippage)"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Defects Slippage: <span className="font-mono text-red-200 font-extrabold">{stats.discrepancy} Lots</span>
              </div>
            )}

            {stats.pending > 0 && (
              <div 
                onClick={() => setFilterType('PENDING')}
                className="px-2.5 py-1 bg-amber-950/40 border border-amber-900/30 rounded flex items-center gap-1.5 text-xs font-semibold text-amber-400 cursor-pointer hover:bg-amber-900/30 hover:text-amber-300 transition-colors"
                title="Click to instantly filter waiting/pending lots"
              >
                <Info className="w-3.5 h-3.5 text-amber-500" /> Pending Machine Run: <span className="font-mono text-amber-200" style={{ fontWeight: 700 }} >{stats.pending}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button 
              onClick={handleExportReconciliation}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-400 bg-sky-950/20 border border-sky-900/40 hover:bg-sky-900/30 hover:text-sky-300 transition-colors cursor-pointer"
              title="Export complete reconciliation performance chart to spreadsheet"
            >
              <Download className="w-3.5 h-3.5" /> <span>Export Verification Sheet</span>
            </button>
          </div>
        </div>
      )}

      {/* SEARCH AND CASE CATEGORIES SPLIT TABS */}
      {hasData && (
        <div className="mt-4 bg-transparent py-2.5 shrink-0 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          {/* SEARCH INPUT */}
          <div className="relative flex-1 bg-transparent">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-4 h-4" />
            </div>
            <input 
              type="text" 
              placeholder="Filter lot comparison timeline by Lot ID, operators, defect comments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-[#0b0d12]/90 border border-zinc-900 rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono transition-colors shadow-inner"
            />
          </div>

          {/* LOCAL MODEL FOCUS FILTER */}
          <div className="flex items-center gap-1 bg-zinc-950/50 border border-zinc-850 rounded p-0.5 self-start xl:self-auto shrink-0 selection:bg-transparent">
            <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider px-2 shrink-0 animate-pulse">Model:</span>
            {(['ALL', '1206', '2010'] as const).map((mType) => {
              const labels: Record<string, string> = {
                ALL: 'All (1206/2010)',
                '1206': '1206 Only',
                '2010': '2010 Only'
              };
              const isSelected = localModelFilter === mType;
              return (
                <button
                  key={mType}
                  onClick={() => setLocalModelFilter(mType)}
                  className={`px-2.5 py-1 text-[10px] md:text-xs font-bold rounded transition-colors cursor-pointer ${
                    isSelected 
                      ? 'bg-amber-955/55 text-amber-350 border border-amber-900/45 font-extrabold shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-350 bg-transparent border border-transparent'
                  }`}
                >
                  {labels[mType]}
                </button>
              );
            })}
          </div>

          {/* FILTERING PILLS */}
          <div className="flex items-center gap-1 bg-zinc-950/50 border border-zinc-850 rounded p-0.5 self-start xl:self-auto shrink-0 selection:bg-transparent">
            {(['ALL', 'OK_VERIFIED', 'DISCREPANCY', 'PENDING'] as const).map((type) => {
              const labels: Record<string, string> = {
                ALL: 'All Lots',
                OK_VERIFIED: 'OK / Verified',
                DISCREPANCY: 'Discrepancy (Leaks)',
                PENDING: 'Waiting Run (Pending)'
              };

              let activeBg = 'bg-zinc-800 text-zinc-200';
              if (type === 'DISCREPANCY') activeBg = 'bg-rose-955/65 text-rose-300 border border-rose-900/30';
              if (type === 'OK_VERIFIED') activeBg = 'bg-emerald-950/50 text-emerald-300 border border-emerald-900/20';
              if (type === 'PENDING') activeBg = 'bg-amber-950/40 text-amber-300 border border-amber-900/20';

              const isActive = filterType === type;

              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 text-[10px] md:text-xs font-bold rounded transition-colors cursor-pointer ${
                    isActive ? activeBg : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TIMELINE COMPARISON MAIN CONTAINER */}
      <div className="flex-1 mt-4 overflow-hidden flex flex-col bg-transparent min-h-0">
        {!hasData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950/10 rounded-lg">
            <div className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-full mb-3 text-zinc-650 animate-pulse">
              <FileSpreadsheet className="w-10 h-10" />
            </div>
            <h3 className="text-zinc-300 font-medium mb-1">Lot Verification & Machine Validation Workspace</h3>
            <p className="text-zinc-500 text-xs max-w-lg mx-auto leading-relaxed">
              Upload your hand-written **QC Manual Excel Spreadsheet**. Our comparison engine matches them automatically 
              with the loaded machine software records to analyze is the machine working well.
            </p>
            <p className="text-zinc-400 mt-6 text-sm font-semibold">
              Click "Add QC File" in the upper right corner to get started.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
            {filteredProcessedLots.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-550 font-mono">
                No matching lots found in calibration database for "{searchTerm}".
              </div>
            ) : (
              filteredProcessedLots.map((lot) => {
                const { 
                  lotNumber, 
                  hasMachineRun, 
                  preMachineEntries, 
                  postMachineEntries, 
                  ambiguousEntries, 
                  primaryMachineRun, 
                  machineStartTime, 
                  machineEndTime, 
                  machinePerfStatus, 
                  machinePerfDesc 
                } = lot;

                // Color themes for the result status
                let statusBadgeColor = 'bg-zinc-900/80 text-zinc-400 border border-zinc-800';
                let statusTitle = 'Awaiting Run / Unknown';
                
                if (machinePerfStatus === 'PENDING') {
                  statusBadgeColor = 'bg-amber-950/50 text-amber-400 border border-amber-900/40';
                  statusTitle = '⏳ Lot exists, but has not passed machine';
                } else if (machinePerfStatus === 'OK') {
                  statusBadgeColor = 'bg-emerald-950/40 text-emerald-450 border border-emerald-900/30';
                  statusTitle = '✅ Accepted (Passed Machine OK)';
                } else if (machinePerfStatus === 'VERIFIED') {
                  statusBadgeColor = 'bg-sky-950/45 text-sky-400 border border-sky-900/30';
                  statusTitle = '🔍 Verified (Defects Correctly Caught)';
                } else if (machinePerfStatus === 'DISCREPANCY') {
                  statusBadgeColor = 'bg-rose-955/30 text-rose-400 border border-rose-900/40 animate-pulse';
                  statusTitle = '🚨 Calibration Alert (Mismatch)';
                }

                const totalPreNg = preMachineEntries.reduce((sum, e) => sum + (e.ngQty ?? e.defectsList?.reduce((acc, d) => acc + d.qty, 0) ?? 0), 0);
                const totalPostNg = postMachineEntries.reduce((sum, e) => sum + (e.ngQty ?? e.defectsList?.reduce((acc, d) => acc + d.qty, 0) ?? 0), 0);

                const machineNgSum = primaryMachineRun 
                  ? (primaryMachineRun.ng1Qty ?? 0) + (primaryMachineRun.ng2Qty ?? 0) + (primaryMachineRun.ng3Qty ?? 0)
                  : 0;

                return (
                  <div 
                    key={lotNumber} 
                    className={`bg-[#0d1017]/75 border border-zinc-900 border-l-4 p-5 rounded-xl flex flex-col md:flex-row md:items-stretch gap-5 transition-all hover:bg-[#0f131a] ${
                      machinePerfStatus === 'DISCREPANCY' ? 'border-l-rose-500/85' : 'border-l-zinc-700'
                    }`}
                  >
                    
                    {/* LEFT CELL: SPECIFICATION INFO */}
                    <div className="md:w-1/4 flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-850 pb-3 md:pb-0 md:pr-4">
                      <div>
                        <div className="text-[10px] font-mono text-zinc-550 font-bold uppercase tracking-widest mb-1">LOT ID</div>
                        <div className="text-sm font-bold text-zinc-100 font-sans tracking-tight truncate" title={lotNumber}>
                          {lotNumber}
                        </div>
                        <div className="text-xs text-zinc-400 font-medium truncate mt-0.5">
                          Model: {primaryMachineRun?.model || ambiguousEntries[0]?.model || preMachineEntries[0]?.model || 'Unspecified'}
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Calibration Status</div>
                        <div className={`px-2 py-1 text-[10px] font-extrabold rounded-md text-center inline-block ${statusBadgeColor}`}>
                          {statusTitle}
                        </div>
                      </div>
                    </div>

                    {/* MID CELL: FLOWTIMELINE */}
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="text-[10px] font-mono text-zinc-550 uppercase tracking-widest font-bold mb-3">Reconciliation Flow Timeline</div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        
                        {/* STEP 1: PRE-MACHINE QC */}
                        <div className="bg-[#121622]/25 border-t-2 border-teal-500/30 rounded p-3 flex flex-col justify-between shadow-lg">
                          <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5 mb-2">
                            <span className="text-[10px] font-extrabold text-teal-400 font-mono uppercase tracking-wider flex items-center gap-1">
                              1. Pre-Machine QC
                            </span>
                            {totalPreNg > 0 ? (
                              <span className="bg-rose-950/40 text-rose-450 px-1.5 py-0.2 rounded font-mono font-bold text-[9px] border border-rose-900/30">
                                {totalPreNg} REJECTS
                              </span>
                            ) : (
                              <span className="bg-zinc-900 text-zinc-500 px-1.5 py-0.2 rounded font-mono text-[9px]">
                                CLEAN
                              </span>
                            )}
                          </div>

                          {preMachineEntries.length > 0 ? (
                            <div className="space-y-1 text-[11px] font-mono">
                              {preMachineEntries.map((e, idx) => (
                                <div key={idx} className="bg-zinc-950/30 p-1.5 rounded">
                                  <div className="flex items-center justify-between text-zinc-300">
                                    <span className="font-semibold text-zinc-150">Checked QA</span>
                                    <span>{formatDateToDDMMYYYY(e.dateVal || e.dateStr)}</span>
                                  </div>
                                  {e.operator && e.operator.trim().toUpperCase() !== 'N/A' && e.operator.trim() !== '' && (
                                    <div className="text-zinc-400 text-[10px] truncate mt-1">
                                      Operator: {e.operator}
                                    </div>
                                  )}
                                  {e.defectsList && e.defectsList.length > 0 && (
                                    <div className="mt-2 pt-1.5 border-t border-zinc-900/60">
                                      <div className="text-[10px] font-extrabold text-teal-400 uppercase tracking-wider mb-1">Pre-QC Defects:</div>
                                      <div className="space-y-1 mt-1 bg-zinc-900/35 p-1 rounded">
                                        {e.defectsList.map((d, dIdx) => (
                                          <div key={dIdx} className="flex justify-between items-center text-[10px] text-zinc-350">
                                            <span className="capitalize">{d.name}</span>
                                            <span className="font-extrabold text-rose-400 font-mono bg-rose-955/20 px-1 border border-rose-900/10 rounded">{d.qty}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="text-zinc-500 text-[10px] italic leading-relaxed mt-1 whitespace-pre-wrap select-text selection:bg-amber-500/30">
                                    Remarks: <span className="text-zinc-300">{cleanRemarksString(e.defectDesc || '') || 'None'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-3 text-[10px] text-zinc-600 italic">
                              No pre-machine logs logged.
                            </div>
                          )}
                        </div>

                        {/* STEP 2: AOI MACHINE INGRESS */}
                        <div className="bg-[#141824]/40 border-t-2 border-purple-500/20 rounded p-3 flex flex-col justify-between shadow-lg">
                          <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5 mb-2">
                            <span className="text-[10px] font-extrabold text-purple-400 font-mono uppercase tracking-wider">
                              2. AOI Machine Run
                            </span>
                            {hasMachineRun ? (
                              <span className="bg-purple-950/40 text-purple-400 px-1.5 py-0.2 rounded font-mono font-bold text-[9px] border border-purple-900/20">
                                PLOTTED
                              </span>
                            ) : (
                              <span className="bg-rose-950/40 text-rose-400 px-1.5 py-0.2 rounded font-mono font-bold text-[9px] border border-rose-900/30">
                                MISSING
                              </span>
                            )}
                          </div>

                          {hasMachineRun && primaryMachineRun ? (
                            <div className="space-y-1 text-[11px] font-mono">
                              <div className="bg-zinc-955/30 p-1.5 rounded">
                                <div className="flex items-center justify-between text-zinc-300">
                                  <span>Total Runs</span>
                                  <span className="text-zinc-150 font-bold">{primaryMachineRun.total?.toLocaleString() || 0}</span>
                                </div>
                                <div className="flex items-center justify-between text-zinc-400 text-[10px] mt-1.5">
                                  <span>Run Date</span>
                                  <span className="text-zinc-300 font-semibold">{formatDateToDDMMYYYY(primaryMachineRun.startTime)}</span>
                                </div>
                                <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                                  <span>Start Time</span>
                                  <span className="truncate max-w-[100px]">{primaryMachineRun.startTime?.split(' ')[1] || primaryMachineRun.startTime || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                                  <span>AOI Yield</span>
                                  <span className="text-teal-400 font-extrabold">{primaryMachineRun.yieldRate || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                                  <span>Defects</span>
                                  <span className={`font-semibold ${machineNgSum > 0 ? 'text-rose-400 font-bold' : 'text-zinc-500'}`}>
                                    {machineNgSum} pcs
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-3 text-[10px] text-zinc-650 bg-zinc-900/10 rounded">
                              ⏳ Lot hasn't entered machine yet
                            </div>
                          )}
                        </div>

                        {/* STEP 3: POST-MACHINE MANUAL QC */}
                        <div className="bg-[#121622]/25 border-t-2 border-amber-500/20 rounded p-3 flex flex-col justify-between shadow-lg">
                          <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5 mb-2">
                            <span className="text-[10px] font-extrabold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-1">
                              3. Post-Machine QC
                            </span>
                            {postMachineEntries.length > 0 ? (
                              <div className="flex items-center gap-1">
                                {postMachineEntries.map((e, idx) => {
                                  let resCol = 'bg-rose-955/35 text-rose-300 border border-rose-900/20';
                                  if (e.result?.toUpperCase() === 'A' || e.result?.toUpperCase() === 'PASS' || e.result?.toUpperCase() === 'OK') {
                                    resCol = 'bg-emerald-955/20 border-emerald-900/25 text-emerald-400';
                                  }
                                  return (
                                    <span key={idx} className={`px-1 py-0.2 rounded font-mono font-extrabold text-[9px] border ${resCol}`}>
                                      {e.result || 'R'}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="bg-zinc-900 text-zinc-500 px-1.5 py-0.2 rounded font-mono text-[9px]">
                                UNCHECKED
                              </span>
                            )}
                          </div>

                          {postMachineEntries.length > 0 ? (
                            <div className="space-y-1 text-[11px] font-mono">
                              {postMachineEntries.map((e, idx) => (
                                <div key={idx} className="bg-zinc-950/30 p-1.5 rounded">
                                  <div className="flex items-center justify-between text-zinc-300">
                                    <span className="font-semibold text-zinc-150">QC Post</span>
                                    <span>{formatDateToDDMMYYYY(e.dateVal || e.dateStr)}</span>
                                  </div>
                                  {e.operator && e.operator.trim().toUpperCase() !== 'N/A' && e.operator.trim() !== '' && (
                                    <div className="text-zinc-400 text-[10px] truncate mt-1">
                                      Operator: {e.operator}
                                    </div>
                                  )}
                                  {e.defectsList && e.defectsList.length > 0 && (
                                    <div className="mt-2 pt-1.5 border-t border-zinc-900/60">
                                      <div className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider mb-1">Leak Defects Found:</div>
                                      <div className="space-y-1 mt-1 bg-zinc-900/35 p-1 rounded">
                                        {e.defectsList.map((d, dIdx) => (
                                          <div key={dIdx} className="flex justify-between items-center text-[10px] text-zinc-350">
                                            <span className="capitalize">{d.name}</span>
                                            <span className="font-extrabold text-rose-400 font-mono bg-rose-955/20 px-1 border border-rose-900/10 rounded">{d.qty}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="text-zinc-500 text-[10px] italic leading-relaxed mt-1 whitespace-pre-wrap select-text selection:bg-amber-500/30">
                                    Remarks: <span className="text-zinc-300">{cleanRemarksString(e.defectDesc || '') || 'None'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-3 text-[10px] text-zinc-600 italic">
                              No post-machine entries yet.
                            </div>
                          )}
                        </div>

                      </div>

                      {/* PERFORMANCE VERIFICATION TEXT BLOCK */}
                      <div className="mt-3 p-2 bg-[#0d1017] border border-zinc-900 rounded-md flex items-start gap-2 select-text text-zinc-350 text-[11px] leading-relaxed">
                        <Info className="w-3.5 h-3.5 mt-0.5 text-zinc-500 shrink-0" />
                        <div>
                          <span className="font-bold text-zinc-150 uppercase font-mono tracking-wider mr-1 text-[10px]">Verification Verdict:</span>
                          {machinePerfDesc}
                        </div>
                      </div>

                    </div>

                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

    </div>
  );
}
