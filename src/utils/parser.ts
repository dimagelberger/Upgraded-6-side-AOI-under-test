import Papa from 'papaparse';
import { SessionSummary, DefectRecord } from '../types';

export function normalizeDefectName(name: string, camera: string): string {
    if (!name) return "";

    // Clean name: strip Chinese characters and other non-printable chars
    const cleanedName = name
        .replace(/[\u4e00-\u9fa5]/g, "") // Strip Chinese characters
        .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Strip control characters
        .trim()
        .replace(/\s+/g, ' ');
        
    const s = cleanedName.toLowerCase();

    // Clean camera name
    let cleanedCamera = (camera || "")
        .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
        .trim()
        .toUpperCase();

    // Fallback to CAMERA - TOP if the camera name does not have direction indicators
    const hasCameraDirection = cleanedCamera.includes('TOP') || 
                               cleanedCamera.includes('BOTTOM') || 
                               cleanedCamera.includes('LEFT') || 
                               cleanedCamera.includes('RIGHT') || 
                               cleanedCamera.includes('FRONT') || 
                               cleanedCamera.includes('BACK') ||
                               cleanedCamera.includes('BOT');

    if (!hasCameraDirection || cleanedCamera === 'CAMERA -' || cleanedCamera === 'CAMERA') {
        cleanedCamera = 'CAMERA - TOP';
    }

    // Support common abbreviations
    if (cleanedCamera.includes('BOT') && !cleanedCamera.includes('BOTTOM')) {
        cleanedCamera = cleanedCamera.replace('BOT', 'BOTTOM');
    }

    const isTop = cleanedCamera.includes('TOP');
    const isBottom = cleanedCamera.includes('BOTTOM');
    const isRedundantCamera = cleanedCamera.includes('2');

    // Angle & Character Qty / Similarity / Boundary
    if (s.includes('angle')) return 'Angle';
    if (s.includes('character qty') || s.includes('character_qty')) {
        return isRedundantCamera || s.includes('redundancy') ? 'Character Qty (Redundancy)' : 'Character Qty';
    }
    if (s.includes('character similarity') || s.includes('character_similarity') || s.includes('charater similarity') || s.includes('charater similarty')) {
        return isRedundantCamera || s.includes('redundancy') ? 'Character Similarity (Redundancy)' : 'Character Similarity';
    }
    if (s.includes('character boundary (u/d)') || s.includes('character boundary u/d') || s.includes('min gap till u/l boundary') || (s.includes('boundary') && s.includes('u/d'))) {
        return isRedundantCamera || s.includes('redundancy') ? 'Character Boundary U/D (Redundancy)' : 'Character Boundary (U/D)';
    }
    if (s.includes('character boundary (l/r)') || s.includes('character boundary l/r') || s.includes('min gap till l/r boundary') || (s.includes('boundary') && s.includes('l/r'))) {
        return isRedundantCamera || s.includes('redundancy') ? 'Character Boundary L/R (Redundancy)' : 'Character Boundary (L/R)';
    }

    // Length of body
    if (s === 'length' || s.includes('full body length') || s.includes('body length')) {
        return isTop ? 'Full Body Length Top (X)' : (isBottom ? 'Full Body Length Bottom (X)' : 'Full Body Length (X)');
    }
    // Width of body
    if (s === 'width' || s.includes('full body width') || s.includes('body width')) {
        return isTop ? 'Full Body Width Top (Y)' : (isBottom ? 'Full Body Width Bottom (Y)' : 'Full Body Width (Y)');
    }

    // Electrodes Qty / Terminal Qty
    if (s.includes('electrodes qty') || s.includes('terminal qty')) {
        return isTop ? 'Electrodes Qty Top' : (isBottom ? 'Terminal Qty Bottom' : 'Electrodes Qty');
    }

    // Terminal Brightness
    if (s.includes('left electrode') && s.includes('brightness') || s.includes('left terminal brightness')) {
        return isTop ? 'Left Terminal Brightness Top' : (isBottom ? 'Left Terminal Brightness Bottom' : 'Left Terminal Brightness');
    }
    if (s.includes('right electrode') && s.includes('brightness') || s.includes('right terminal brightness')) {
        return isTop ? 'Right Terminal Brightness Top' : (isBottom ? 'Right Terminal Brightness Bottom' : 'Right Terminal Brightness');
    }

    // Terminal Length / Width (Max / Min for Left and Right)
    const isMin = /\bmin\b/i.test(s);
    const isMax = /\bmax\b/i.test(s);
    const minMaxPrefix = isMin ? 'Min ' : (isMax ? 'Max ' : '');

    if (s.includes('left') && (s.includes('terminal length') || (s.includes('terminal') && s.includes('length')))) {
        return isTop ? `${minMaxPrefix}Left Terminal Length Top (X)`.trim() : (isBottom ? `${minMaxPrefix}Left Terminal Length Bot (X)`.trim() : `${minMaxPrefix}Left Terminal Length (X)`.trim());
    }
    if (s.includes('left') && (s.includes('terminal width') || (s.includes('terminal') && s.includes('width')))) {
        return isTop ? `${minMaxPrefix}Left Terminal Width Top (Y)`.trim() : (isBottom ? `${minMaxPrefix}Left Terminal Width Bot (Y)`.trim() : `${minMaxPrefix}Left Terminal Width (Y)`.trim());
    }
    if (s.includes('right') && (s.includes('terminal length') || (s.includes('terminal') && s.includes('length')))) {
        return isTop ? `${minMaxPrefix}Right Terminal Length Top (X)`.trim() : (isBottom ? `${minMaxPrefix}Right Terminal Length Bot (X)`.trim() : `${minMaxPrefix}Right Terminal Length (X)`.trim());
    }
    if (s.includes('right') && (s.includes('terminal width') || (s.includes('terminal') && s.includes('width')))) {
        return isTop ? `${minMaxPrefix}Right Terminal Width Top (Y)`.trim() : (isBottom ? `${minMaxPrefix}Right Terminal Width Bot (Y)`.trim() : `${minMaxPrefix}Right Terminal Width (Y)`.trim());
    }

    // Width Deviation
    if (s.includes('width deviation')) {
        return isTop ? 'Width Deviation Top' : (isBottom ? 'Width Deviation Bottom' : 'Width Deviation');
    }

    // Inner Straightness
    if (s.includes('inner straightness')) {
        return isTop ? 'Inner Straightness Top' : (isBottom ? 'Inner Straightness Bottom' : 'Inner Straightness');
    }

    // Coating/Damage on Terminal / Chipped Core / Coating Loss / Less Coating (Area, X, Y)
    const isCoatingDefect = (s.includes('chipped core') || 
                             s.includes('coating') || 
                             s.includes('less coating') || 
                             s.includes('coating loss')) && 
                             !s.includes('brightness') && 
                             !s.includes('black coating') &&
                             !s.includes('white coating');

    if (isCoatingDefect) {
        const isX = s.includes('(x)') || s.includes('length');
        const isY = s.includes('(y)') || s.includes('width');
        if (isTop) {
            if (isX) return 'Coating on Terminal Top (X)';
            if (isY) return 'Coating on Terminal Top (Y)';
            return 'Damage/Coating on Terminal Top (Area)';
        } else {
            if (isX) return 'B/W Coating on Terminal Bottom (X)';
            if (isY) return 'B/W Coating on Terminal Bottom (Y)';
            return 'B/W Coating on Terminal Bottom (Area)';
        }
    }

    // Bump
    if (s.includes('bump')) {
        if (s.includes('(x)') || s.includes('length')) return isTop ? 'Bump Top (X)' : (isBottom ? 'Bump Bottom (X)' : 'Bump (X)');
        if (s.includes('(y)') || s.includes('width')) return isTop ? 'Bump Top (Y)' : (isBottom ? 'Bump Bottom (Y)' : 'Bump (Y)');
        return isTop ? 'Bump Top (Area)' : (isBottom ? 'Bump Bottom (Area)' : 'Bump (Area)');
    }

    // Missing Coating Top
    if (s.includes('missing coating')) {
        const isX = s.includes('(x)') || s.includes('length');
        const isY = s.includes('(y)') || s.includes('width');
        const isTotal = s.includes('total area') || s.includes('total_area');
        if (isX) return 'Missing Coating Top (X)';
        if (isY) return 'Missing Coating Top (Y)';
        if (isTotal) return 'Missing Coating Top (Total Area)';
        return 'Missing Coating Top (Area)';
    }

    // Bouble / Scratch on Body
    if (s.includes('bouble') || s.includes('scratch')) {
        const isTotal = s.includes('total area') || s.includes('total_area');
        const isX = s.includes('(x)') || s.includes('length');
        const isY = s.includes('(y)') || s.includes('width') || s.includes('scrtach');
        if (isTop) {
            if (isX) return 'Scratch on Body Top (X)';
            if (isY) return 'Scratch on Body Top (Y)';
            if (isTotal) return 'Scratch on Body Top (Total Area)';
            return 'Scratch on Body Top (Area)';
        }
        if (isBottom) {
            if (isX) return 'Scratch on Body Bottom (X)';
            if (isY) return 'Scratch on Body Bottom (Y)';
            if (isTotal) return 'Scratch on Body Bottom (Total Area)';
            return 'Scratch on Body Bottom (Area)';
        }
        return 'Scratch';
    }

    // Straightness
    if (s.includes('straightness')) {
        if (cleanedCamera.includes('FRONT') || cleanedCamera.includes('BACK')) {
            if (s.includes('left')) return 'Left Side Straightness';
            if (s.includes('right')) return 'Right Side Straightness';
            if (s.includes('upper')) return 'Upper Side Straightness';
            if (s.includes('lower')) return 'Lower Side Straightness';
        }
        if (s.includes('u/d') || s.includes('1') || s.includes('upper') || s.includes('lower') || s.includes('up') || s.includes('down')) {
            return isTop ? 'Straightness Top (U/D)' : (isBottom ? 'Straightness Bottom (U/D)' : 'Straightness (U/D)');
        }
        if (s.includes('l/r') || s.includes('2') || s.includes('left') || s.includes('right') || s.includes('side')) {
            return isTop ? 'Straightness Top (L/R)' : (isBottom ? 'Straightness Bottom (L/R)' : 'Straightness (L/R)');
        }
    }

    // Coating Brightness
    if (s.includes('coating brightness') || s.includes('coating b channel brightness')) {
        return isTop ? 'Coating Brightness Top (Inverted)' : (isBottom ? 'Coating Brightness Bottom (Inverted)' : 'Coating Brightness (Inverted)');
    }

    // Plating on Body / Solder on Body / Excess Metalization / Plating Max
    const isPlatingDefect = s.includes('plating on body') || 
                            s.includes('plating on top body') || 
                            s.includes('plating on bottom body') || 
                            (s.includes('solder') && s.includes('on body')) ||
                            s.includes('excess metalization') ||
                            s.includes('excess metallization') ||
                            s.includes('plating max');

    if (isPlatingDefect) {
        const isX = s.includes('(x)') || s.includes('length');
        const isY = s.includes('(y)') || s.includes('width');
        const isTotal = s.includes('total area') || s.includes('total_area');
        if (isTop) {
            if (isX) return 'Plating on Body Top (X)';
            if (isY) return 'Plating on Body Top (Y)';
            if (isTotal) return 'Plating on Body Top (Total Area)';
            return 'Plating on Body Top (Area)';
        } else {
            if (isX) return 'Plating on Body Bottom (X)';
            if (isY) return 'Plating on Body Bottom (Y)';
            if (isTotal) return 'Plating on Body Bottom (Total Area)';
            return 'Plating on Body Bottom (Area)';
        }
    }

    // Plating on Laser Cut
    if (s.includes('plating on') && s.includes('laser cut')) {
        const isRedun = isRedundantCamera || s.includes('redundancy') || s.includes('redundency');
        const redunSuffix = isRedun ? ' (Redundancy)' : '';
        if (s.includes('total area') || s.includes('total_area') || s.includes('total')) {
            return isTop ? `Plating on Laser Cut Top (Total Area)${redunSuffix}` : (isBottom ? `Plating on Laser Cut Bottom (Total Area)${redunSuffix}` : `Plating on Laser Cut (Total Area)${redunSuffix}`);
        }
        if (s.includes('(x)')) return isTop ? `Plating on Laser Cut Top (X)${redunSuffix}` : (isBottom ? `Plating on Laser Cut Bottom (X)${redunSuffix}` : `Plating on Laser Cut (X)${redunSuffix}`);
        if (s.includes('(y)')) return isTop ? `Plating on Laser Cut Top (Y)${redunSuffix}` : (isBottom ? `Plating on Laser Cut Bottom (Y)${redunSuffix}` : `Plating on Laser Cut (Y)${redunSuffix}`);
        return isTop ? `Plating on Laser Cut Top (Area)${redunSuffix}` : (isBottom ? `Plating on Laser Cut Bottom (Area)${redunSuffix}` : `Plating on Laser Cut (Area)${redunSuffix}`);
    }

    // White Coating on Terminal
    if (s.includes('white coating')) {
        const isX = s.includes('(x)') || s.includes('length');
        const isY = s.includes('(y)') || s.includes('width');
        if (isX) return 'White Coating on Terminal Bottom (X)';
        if (isY) return 'White Coating on Terminal Bottom (Y)';
        return 'White Coating on Terminal Bottom (Area)';
    }

    // Black Coating on White
    if (s.includes('black coating') || s.includes('coating on white')) {
        const isX = s.includes('(x)') || s.includes('length');
        const isY = s.includes('(y)') || s.includes('width');
        if (isX) return 'Black Coating on White (X)';
        if (isY) return 'Black Coating on White (Y)';
        return 'Black Coating on White (Area)';
    }

    // Plating spot / Lack of Terminal / Dirt
    if (s.includes('plating spot') || s.includes('dirt')) {
        if (s.includes('(x)') || s.includes('length')) return isTop ? 'Plating Spot on Body Top (X)' : (isBottom ? 'Plating Spot on Body Bottom (X)' : 'Plating Spot on Body (X)');
        if (s.includes('(y)') || s.includes('width')) {
            if (s.includes('dirt')) return isTop ? 'Lack of Terminal Top (Y)' : (isBottom ? 'Lack of Terminal Bottom (Y)' : 'Lack of Terminal (Y)');
            return isTop ? 'Plating Spot on Body Top (Y)' : (isBottom ? 'Plating Spot on Body Bottom (Y)' : 'Plating Spot on Body (Y)');
        }
        return isTop ? 'Plating Spot on Body Top (Area)' : (isBottom ? 'Plating Spot on Body Bottom (Area)' : 'Plating Spot on Body (Area)');
    }

    if (s.includes('lack of terminal')) {
        if (s.includes('(x)')) return isTop ? 'Lack of Terminal Top (X)' : (isBottom ? 'Lack of Terminal Bottom (X)' : 'Lack of Terminal (X)');
        if (s.includes('(y)')) return isTop ? 'Lack of Terminal Top (Y)' : (isBottom ? 'Lack of Terminal Bottom (Y)' : 'Lack of Terminal (Y)');
        return isTop ? 'Lack of Terminal Top (Area)' : (isBottom ? 'Lack of Terminal Bottom (Area)' : 'Lack of Terminal (Area)');
    }

    // Open Laser Cut
    if (s.includes('open laser cut')) {
        if (isRedundantCamera || s.includes('redundancy')) return 'Open Laser Cut (Redundancy)';
        return isTop ? 'Open Laser Cut Top' : (isBottom ? 'Open Laser Cut Bottom' : 'Open Laser Cut');
    }

    // Burs
    if (s.includes('burs')) {
        if (s.includes('(x)')) return isTop ? 'Burs Top (X)' : (isBottom ? 'Burs Bottom (X)' : 'Burs (X)');
        if (s.includes('(y)')) return isTop ? 'Burs Top (Y)' : (isBottom ? 'Burs Bottom (Y)' : 'Burs (Y)');
        return isTop ? 'Burs Top (Area)' : (isBottom ? 'Burs Bottom (Area)' : 'Burs (Area)');
    }

    // Left/Right Side cameras
    if (cleanedCamera.includes('LEFT') || cleanedCamera.includes('RIGHT')) {
        if (s.includes('plating on side-edge') || s.includes('plating on side')) {
            if (s.includes('length') || s.includes('(x)')) return 'Plating on Side-Edge (X)';
            if (s.includes('width') || s.includes('(y)')) return 'Plating on Side-Edge (Y)';
            return 'Plating on Side-Edge (Area)';
        }
        if (s.includes('black spot') || s.includes('blackspot') || s.includes('bent part')) {
            if (s.includes('length') || s.includes('(x)')) return 'Bent Part (X)';
            if (s.includes('width') || s.includes('(y)')) return 'Bent Part (Y)';
            return 'Bent Part (Area)';
        }
    } else {
        if (s.includes('plating on side-edge') || s.includes('plating on side')) {
            if (s.includes('(x)')) return 'Plating on Side-Edge (X)';
            if (s.includes('(y)')) return 'Plating on Side-Edge (Y)';
            return 'Plating on Side-Edge (Area)';
        }
        if (s.includes('bent part')) {
            if (s.includes('(x)')) return 'Bent Part (X)';
            if (s.includes('(y)')) return 'Bent Part (Y)';
            return 'Bent Part (Area)';
        }
    }
    if (s.includes('crack')) return 'Crack Length';
    if (s.includes('height')) return 'Height (Y)';

    // Front/Back Side cameras
    if (s.includes('g-channel brightness') || s.includes('g-channel_brightness')) return 'Metal G-channel brightness';
    if (s.includes('damaged terminal')) {
        if (s.includes('(x)')) return 'Damaged Terminal (X)';
        if (s.includes('(y)')) return 'Damaged Terminal (Y)';
        return 'Damaged Terminal (Area)';
    }

    // Standardize Case for general items: Title Case
    return cleanedName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function parseAOILog(text: string, filename: string) {
  const result = Papa.parse<any[]>(text, { skipEmptyLines: true });
  const rows = result.data;

  // Build header map to identify column indices by name
  let headerMap: { [key: string]: number } = {};
  const updateHeaderMap = (hRow: any[]) => {
    hRow.forEach((h: any, idx: number) => {
      if (h) headerMap[String(h).trim()] = idx;
    });
  };

  if (rows.length > 0) {
    updateHeaderMap(rows[0]);
  }
  
  const getColIdx = (name: string) => {
    const normalize = (s: string) => s.toLowerCase().replace(/[\s_:-]/g, '');
    const normName = normalize(name);
    const foundKey = Object.keys(headerMap).find(k => normalize(k) === normName);
    return foundKey ? headerMap[foundKey] : -1;
  };

  const session: Partial<SessionSummary> = { 
    filename, 
    total: 0, okQty: 0, ng1Qty: 0, ng2Qty: 0, ng3Qty: 0, retestQty: 0,
    barcodeNumber: '-', lotNumber: '-', model: '-',
    operator: '-', startTime: '-', endTime: '-', yieldRate: '-', ngRate: '-', rstRate: '-', speed: '-'
  };
  
  const defects: DefectRecord[] = [];

  let currentCamera = "CAMERA - TOP"; 
  let parsingDefects = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const col0 = String(row[0]).trim();
    const col1 = String(row[1] || "").trim();
    const col0Clean = col0.replace(/[:：]/g, '').toLowerCase().trim();

    // Ignore the Chinese duplicate summary rows which can mess up defect parsing
    if (col0.includes("当前总数") || col0.includes("当前良品数") || (i > 0 && String(rows[i-1][0]).includes("当前总数"))) {
        continue;
    }

    // 1. Metadata Ingestion
    if (col0Clean === "operator") session.operator = col1;
    if (col0Clean.includes("start time") || col0Clean === "start_time") session.startTime = col1;
    if (col0Clean.includes("end time") || col0Clean === "end_time") session.endTime = col1;
    if (col0Clean.includes("barcode") || col0Clean === "serial" || col0Clean === "sn") session.barcodeNumber = col1;
    if (col0Clean.includes("lot") || col0Clean === "batch" || col0Clean === "batch no") session.lotNumber = col1;
    if (col0Clean === "model" || col0Clean.includes("part") || col0Clean === "product") session.model = col1;
    if (col0Clean.includes("rst") || col0Clean.includes("retest") || col0Clean.includes("复测")) {
        // Only take it as rate if it's explicitly a rate field in metadata (unlikely, but just in case)
        if (col0Clean.includes("%") || col0Clean.includes("rate") || col0Clean.includes("rat")) {
            session.rstRate = col1;
        }
    }
    if (col0Clean === "speed" || col0Clean === "pcs/min" || col0Clean === "uph" || col0Clean === "ct" || col0Clean.includes("速度") || col0Clean.includes("产能")) session.speed = col1;

    // 2. Summary Level Indicators
    // Detect if this row contains 'Total' and 'OK' or 'Yield'
    const normalizeStr = (s: string) => s.toLowerCase().replace(/[\s_:-]/g, '');
    const rowClean = row.map((c: any) => normalizeStr(String(c || "")));
    const hasTotalCol = rowClean.some(c => c === "total" || c === "totalqty");
    const hasOkCol = rowClean.some(c => c.includes("ok"));
    
    if (hasTotalCol && hasOkCol) {
       updateHeaderMap(row);
       
       // Try current row first (in case it's a flat data row)
       const getVal = (r: any[], colNames: string[]) => {
           for (const name of colNames) {
               const idx = getColIdx(name);
               if (idx !== -1 && r[idx] !== undefined && r[idx] !== null && r[idx] !== "") {
                   return String(r[idx]);
               }
           }
           // Fallback to partial matches on headers
           const normalize = (s: string) => s.toLowerCase().replace(/[\s_:-]/g, '');
           for (const name of colNames) {
               const normName = normalize(name);
               const foundKey = Object.keys(headerMap).find(k => {
                   const normK = normalize(k);
                   if (normK === normName) return true;
                   // Only allow partial matches if the search term is long enough to avoid false positives 
                   // (e.g. 'ct' matching 'product', 'rst' matching 'first')
                   if (normName.length > 3 && normK.includes(normName)) return true;
                   return false;
               });
               if (foundKey) {
                   const idx = headerMap[foundKey];
                   if (idx !== -1 && r[idx] !== undefined && r[idx] !== null && r[idx] !== "") {
                       return String(r[idx]);
                   }
               }
           }
           return "";
       };

       const checkTotal = (r: any[]) => {
           const val = getVal(r, ['Total', 'Total Qty']);
           const num = parseInt(val.replace(/,/g, ''));
           return isNaN(num) ? 0 : num;
       };

       let finalTotal = checkTotal(row);
       let targetRow = row;

       // If current row total is 0 or NaN, try NEXT row
       if (finalTotal === 0) {
           const nextRow = rows[i + 1];
           if (nextRow) {
               finalTotal = checkTotal(nextRow);
               if (finalTotal > 0) {
                   targetRow = nextRow;
               }
           }
       }

       if (finalTotal > 0) {
           session.total = finalTotal;
           const okVal = parseInt(getVal(targetRow, ['OK Qty', 'OK', 'OKQty', '良品数', 'Pass Qty', 'Pass', 'Good', 'Accept']).replace(/,/g, ''));
           session.okQty = !isNaN(okVal) ? okVal : 0;
           session.ng1Qty = parseInt(getVal(targetRow, ['NG1 Qty', 'NG1']).replace(/,/g, '')) || 0;
           session.ng2Qty = parseInt(getVal(targetRow, ['NG2 Qty', 'NG2']).replace(/,/g, '')) || 0;
           session.ng3Qty = parseInt(getVal(targetRow, ['NG3 Qty', 'NG3']).replace(/,/g, '')) || 0;
           session.retestQty = parseInt(getVal(targetRow, ['Retest Qty', 'Retest', 'RST Qty']).replace(/,/g, '')) || 0;
           let yRateStr = String(getVal(targetRow, ['Yield Rate', 'Yield', 'YieldRate', 'Yield%']) || "0%");
           if (yRateStr === "0%" || yRateStr === "0") {
               yRateStr = session.total > 0 ? ((session.okQty / session.total) * 100).toFixed(2) + '%' : "0%";
           }
           session.yieldRate = yRateStr;
           session.ngRate = String(getVal(targetRow, ['NG Rate', 'NG%']) || "0%");
           const parsedRst = getVal(targetRow, ['RST Rate', 'RST%', 'Retest%', 'Retest Rate', 'Retest Rat', '复测率']);
           if (parsedRst) session.rstRate = String(parsedRst);
           const parsedSpeed = getVal(targetRow, ['Speed', 'PCS/min', 'UPH', 'CT', '速度', '平均速度', '产能']);
           if (parsedSpeed) session.speed = String(parsedSpeed);
       }
    }

    // 3. Drilldown Initialization
    if (col0.toLowerCase() === "no" && col1.toLowerCase().includes("test item")) {
       updateHeaderMap(row);
       parsingDefects = true;
       continue;
    }

    if (parsingDefects) {
        const col0Upper = col0.toUpperCase();
        const isCameraHeader = isNaN(parseInt(col0)) && 
                               col0 !== "" && 
                               (col1 === "" || col1 === undefined) &&
                               (col0Upper.includes('CAMERA') || 
                                col0Upper.includes('TOP') || 
                                col0Upper.includes('BOTTOM') || 
                                col0Upper.includes('LEFT') || 
                                col0Upper.includes('RIGHT') || 
                                col0Upper.includes('FRONT') || 
                                col0Upper.includes('BACK') ||
                                col0Upper.includes('BOT'));
        if (isCameraHeader) {
            const cleanedCamStr = col0.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
            // Exchange Top 2 and Bottom 2 from raw CSV
            currentCamera = getNormalizedCameraName(cleanedCamStr, true);
            continue;
        }

        if (!isNaN(parseInt(col0)) && col1 !== "") {
            // Robustly identify columns by name
            const testItemIdx = getColIdx('Test item');
            const ngQtyIdx = getColIdx('NG Qty');
            const ngRateIdx = getColIdx('NG Rate');
            const loLimIdx = getColIdx('Lo Lim');
            const hiLimIdx = getColIdx('Hi Lim');
            const unitIdx = getColIdx('Unit');
            const ngBoxIdx = getColIdx('NG Box');
            const remarkIdx = getColIdx('Remarks');
            
            // Fallback for missing/varied headers
            const testItem = testItemIdx !== -1 ? row[testItemIdx] : col1;
            const cleanTestItem = String(testItem)
                .replace(/[（]/g, '(')
                .replace(/[）]/g, ')')
                .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
                .replace(/[^\x00-\x7F]+/g, '')
                .trim();
            const testItemLower = cleanTestItem.toLowerCase();

            // 1. Exclude Left and Right Terminal Brightness completely for all cameras
            if (testItemLower.includes('terminal brightness') || (testItemLower.includes('terminal') && testItemLower.includes('brightness'))) {
                continue;
            }

            // 2. Camera Top: remove "Maximum width of excess metalization" / "excess metalization"
            if (currentCamera.includes('TOP') && (testItemLower.includes('excess metal') || testItemLower.includes('excess metall'))) {
                continue;
            }

            // 3. Camera Left/Right: remove "max forien length and width" / "foreign"
            const isLeftRight = currentCamera.includes('LEFT') || currentCamera.includes('RIGHT');
            if (isLeftRight && (testItemLower.includes('forien') || testItemLower.includes('foreign'))) {
                continue;
            }

            const ngQty = ngQtyIdx !== -1 ? parseFloat(row[ngQtyIdx]) : parseFloat(row[2]) || 0;
            const ngRate = ngRateIdx !== -1 ? parseFloat(row[ngRateIdx]) : parseFloat(row[3]) || 0;
            const loLim = loLimIdx !== -1 ? String(row[loLimIdx]) : String(row[4] || "-");
            const hiLim = hiLimIdx !== -1 ? String(row[hiLimIdx]) : String(row[5] || "-");
            const unit = unitIdx !== -1 ? String(row[unitIdx]) : String(row[6] || "-");
            const ngBox = ngBoxIdx !== -1 ? String(row[ngBoxIdx]) : (remarkIdx !== -1 ? String(row[remarkIdx]) : "");

            const baseCat = getBaseCategory(cleanTestItem, currentCamera);

            defects.push({
                lotNumber: '-', // assigned after loop
                filename,
                camera: currentCamera.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim(),
                no: parseInt(col0),
                testItem: cleanTestItem,
                baseCategory: baseCat,
                ngQty: ngQty,
                rawNgQty: ngQty,
                normalizedNgQty: ngQty,
                ngRate: ngRate,
                loLim: loLim,
                hiLim: hiLim,
                unit: unit,
                ngBox: ngBox,
                sessionStartTime: session.startTime,
            });
        }
    }
  }

  // Cross-reference screenshots: "Lot Number ID" holds what the CSV calls "barcode number"
  // "Barcode" holds what the CSV calls "lot number"
  // Heuristic: If it has both letters and numbers, it's a barcode. 
  // If it has only numbers (and typically 7-8 chars), it's a lot number.
  let baseLotId = filename.replace('.csv', '');
  
  let actualLotId = '-';
  let actualBarcode = '-';

  const csvVals = [session.barcodeNumber, session.lotNumber].filter(v => v && v !== '-').map(v => String(v).trim());
  
  for (const v of csvVals) {
      if (/^\d{7,8}$/.test(v)) {
          actualLotId = v;
      } else if (/[a-zA-Z]/.test(v)) {
          actualBarcode = v;
      }
  }

  // If CSV didn't give us a clear lot ID, try checking filename
  if (actualLotId === '-') {
      if (/^\d{7,8}/.test(baseLotId)) {
          actualLotId = baseLotId.split('-')[0]; // Extract "10050381" from "10050381-WW20"
      }
  }

  // If CSV didn't give us a barcode, try checking filename
  if (actualBarcode === '-') {
      if (baseLotId.includes('-') && /^\d{7,8}-/.test(baseLotId)) {
          actualBarcode = baseLotId.split('-').slice(1).join('-');
      } else if (/[a-zA-Z]/.test(baseLotId)) {
          // It might be something like "WW20-28 130650"
          // We can try to strip the date part (e.g. "-28 130650")
          actualBarcode = baseLotId.replace(/-\d{2,}\s+\d{4,}/, '').trim();
      }
  }

  if (actualLotId === '-') {
    actualLotId = baseLotId;
  }

  if (actualBarcode === actualLotId && actualLotId !== '-') {
      actualBarcode = '-';
  }

  session.lotNumber = actualLotId;
  session.barcodeNumber = actualBarcode;


  defects.forEach(d => d.lotNumber = actualLotId || '-');

  return { session: session as SessionSummary, defects };
}

export function getBaseCategory(testItem: string, camera?: string): string {
    if (!testItem) return '';
    let s = String(testItem)
        .replace(/[（]/g, '(')
        .replace(/[）]/g, ')')
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
        .replace(/[^\x00-\x7F]+/g, '')
        .trim();

    // Strip sub-parameter indicators (Area, Total Area, X, Y, Redundancy, etc.)
    s = s.replace(/\s*\(\s*(Area|Total\s*Area|TotalArea|X|Y)\s*\)/gi, '');
    s = s.replace(/\s+(Area|Total\s*Area|TotalArea)$/gi, '');
    s = s.replace(/\s*\(Redundancy\)/gi, '');
    s = s.replace(/\s+Redundancy/gi, '');
    s = s.replace(/\s*\(Redundency\)/gi, '');
    s = s.replace(/\s+Redundency/gi, '');
    s = s.trim();

    const camUpper = (camera || '').toUpperCase();
    const sLower = s.toLowerCase();

    // 1. FRONT and BACK Camera Specific Defects
    if (camUpper.includes('FRONT') || camUpper.includes('BACK')) {
        if (sLower.includes('damaged terminal') || sLower.includes('damage')) {
            return 'Damaged Terminal';
        }
        if (sLower.includes('g-channel') || sLower.includes('metal g')) {
            return 'Metal G-channel brightness';
        }
        if (sLower.includes('left side straightness') || sLower.includes('left')) return 'Left Side Straightness';
        if (sLower.includes('right side straightness') || sLower.includes('right')) return 'Right Side Straightness';
        if (sLower.includes('upper side straightness') || sLower.includes('upper')) return 'Upper Side Straightness';
        if (sLower.includes('lower side straightness') || sLower.includes('lower')) return 'Lower Side Straightness';
        if (sLower.includes('scratch')) return 'Scratch';
        if (sLower.includes('bump')) return 'MAX bump of side';
    }

    // 2. LEFT and RIGHT Camera Specific Defects
    if (camUpper.includes('LEFT') || camUpper.includes('RIGHT')) {
        if (sLower.includes('plating on side-edge') || sLower.includes('plating on side') || sLower.includes('plating')) {
            return 'Plating on Side-Edge';
        }
        if (sLower.includes('bent part') || sLower.includes('black spot') || sLower.includes('blackspot')) {
            return 'Bent Part';
        }
        if (sLower.includes('crack')) return 'Crack Length';
        if (sLower.includes('height')) return 'Height (Y)';
    }

    // 3. Plating on Laser Cut
    if (sLower.includes('plating on') && sLower.includes('laser cut')) {
        if (camUpper.includes('TOP') || sLower.includes('top')) {
            return 'Plating on Laser Cut Top';
        }
        return 'Plating on Laser Cut Bottom';
    }

    // 4. Open Laser Cut
    if (sLower.includes('open laser cut')) {
        if (camUpper.includes('TOP') || sLower.includes('top')) {
            return 'Open Laser Cut Top';
        }
        return 'Open Laser Cut Bottom';
    }

    // 5. Plating on Body / Excess Metalization / Solder on Body
    if (sLower.includes('plating on') && sLower.includes('body')) {
        if (camUpper.includes('TOP') || sLower.includes('top')) {
            return 'Plating on Body Top';
        }
        return 'Plating on Body Bottom';
    }

    // 6. Plating Spot on Body / Dirt
    if (sLower.includes('plating spot') || sLower.includes('dirt')) {
        if (camUpper.includes('TOP') || sLower.includes('top')) {
            return 'Plating Spot on Body Top';
        }
        return 'Plating Spot on Body Bottom';
    }

    // 7. Missing Coating
    if (sLower.includes('missing coating')) {
        if (camUpper.includes('TOP') || sLower.includes('top')) {
            return 'Missing Coating Top';
        }
        return 'Missing Coating on Body Bottom';
    }

    // 8. Scratch / Bouble on Body
    if (sLower.includes('bouble') || sLower.includes('scratch')) {
        if (camUpper.includes('TOP') || sLower.includes('top')) {
            return 'Scratch on Body Top';
        }
        if (camUpper.includes('BOTTOM') || camUpper.includes('BOT') || sLower.includes('bottom') || sLower.includes('bot')) {
            return 'Scratch on Body Bottom';
        }
        return 'Scratch';
    }

    // 8. White Coating on Terminal
    if (sLower.includes('white coating')) {
        return 'White Coating on Terminal Bottom';
    }

    // 9. Black Coating on White
    if (sLower.includes('black coating') || sLower.includes('coating on white')) {
        return 'Black Coating on White';
    }

    // 10. Damage / Coating on Terminal Top / Bottom
    if (sLower.includes('damage') || sLower.includes('chipped') || (sLower.includes('coating') && sLower.includes('terminal')) || sLower.includes('coating loss') || sLower.includes('less coating')) {
        if (camUpper.includes('TOP') || sLower.includes('top')) {
            return 'Damage/Coating on Terminal Top';
        }
        if (camUpper.includes('BOTTOM') || camUpper.includes('BOT') || sLower.includes('bottom')) {
            return 'B/W Coating on Terminal Bottom';
        }
    }

    // 11. Burs
    if (sLower.includes('burs')) {
        if (camUpper.includes('TOP') || sLower.includes('top')) {
            return 'Burs Top';
        }
        return 'Burs Bottom';
    }

    // 12. Bump on Terminal
    if (sLower.includes('bump')) {
        if (camUpper.includes('TOP') || sLower.includes('top')) {
            return 'MAX Bump on Terminal Top';
        }
        if (camUpper.includes('BOTTOM') || camUpper.includes('BOT') || sLower.includes('bottom')) {
            return 'MAX Bump on Terminal Bottom';
        }
        return 'MAX Bump';
    }

    // 13. Lack of Terminal
    if (sLower.includes('lack of terminal')) {
        if (camUpper.includes('TOP') || sLower.includes('top')) {
            return 'Lack of Terminal Top';
        }
        return 'Lack of Terminal Bottom';
    }

    // 14. Terminal Width Min / Max
    if ((sLower.includes('terminal width') || (sLower.includes('terminal') && sLower.includes('width'))) && !sLower.includes('deviation') && !sLower.includes('brightness')) {
        if (/\bmin\b/i.test(s)) return 'Terminal Width Min (Y)';
        if (/\bmax\b/i.test(s)) return 'Terminal Width Max (Y)';
    }

    // 15. Terminal Length Min / Max
    if ((sLower.includes('terminal length') || (sLower.includes('terminal') && sLower.includes('length'))) && !sLower.includes('brightness')) {
        if (/\bmin\b/i.test(s)) return 'Terminal Length Min (X)';
        if (/\bmax\b/i.test(s)) return 'Terminal Length Max (X)';
    }

    // 16. Straightness
    if (sLower.includes('straightness')) {
        if (sLower.includes('inner')) {
            return camUpper.includes('TOP') || sLower.includes('top') ? 'Inner Straightness Top' : 'Inner Straightness Bottom';
        }
        if (sLower.includes('u/d') || sLower.includes('upper') || sLower.includes('lower')) {
            return camUpper.includes('TOP') || sLower.includes('top') ? 'Straightness Top (U/D)' : 'Straightness Bottom (U/D)';
        }
        if (sLower.includes('l/r') || sLower.includes('left') || sLower.includes('right') || sLower.includes('side')) {
            return camUpper.includes('TOP') || sLower.includes('top') ? 'Straightness Top (L/R)' : 'Straightness Bottom (L/R)';
        }
    }

    // 15. Coating Brightness
    if (sLower.includes('coating brightness') || sLower.includes('coating b channel')) {
        return camUpper.includes('TOP') || sLower.includes('top') ? 'Coating Brightness Top (Inverted)' : 'Coating Brightness Bottom (Inverted)';
    }

    // 16. Character Similarity / Qty / Boundary
    if (sLower.includes('character similarity') || sLower.includes('charater similarity')) {
        return 'Character Similarity';
    }
    if (sLower.includes('character qty') || sLower.includes('character_qty')) {
        return 'Character Qty';
    }
    if (sLower.includes('character boundary') || sLower.includes('min gap till')) {
        if (sLower.includes('u/d') || sLower.includes('u/l')) return 'Character Boundary (U/D)';
        if (sLower.includes('l/r')) return 'Character Boundary (L/R)';
        return 'Character Boundary';
    }

    return s;
}

export const DEFECT_MASTER_MAP: Record<string, Record<number, string>> = {
  'CAMERA - TOP': {
    1: 'Angle',
    2: 'Full Body Length Top (X)',
    3: 'Full Body Width Top (Y)',
    4: 'Electrodes Qty Top',
    7: 'Max Left Terminal Width Top (Y)',
    8: 'Min Left Terminal Width Top (Y)',
    9: 'Max Left Terminal Length Top (X)',
    10: 'Min Left Terminal Length Top (X)',
    11: 'Max Right Terminal Width Top (Y)',
    12: 'Min Right Terminal Width Top (Y)',
    13: 'Max Right Terminal Length Top (X)',
    14: 'Min Right Terminal Length Top (X)',
    15: 'Width Deviation Top',
    16: 'Inner Straightness Top',
    17: 'Coating/Damage on Terminal Top (Area)',
    18: 'Coating/Damage on Terminal Top (Total Area)',
    19: 'Coating on Terminal Top (X)',
    20: 'Coating on Terminal Top (Y)',
    21: 'Missing Coating Top (Area)',
    22: 'Missing Coating Top (Total Area)',
    23: 'Missing Coating Top (X)',
    24: 'Missing Coating Top (Y)',
    25: 'Bouble/Scratch on Body Top (Area)',
    26: 'Bouble/Scratch on Body Top (Total Area)',
    27: 'Straightness Top (U/D)',
    28: 'Straightness Top (L/R)',
    29: 'Coating Brightness Top (Inverted)',
    30: 'Plating on body Top (Area)',
    31: 'Plating on body Top (Total Area)',
    32: 'Plating on body Top (X)',
    33: 'Plating on body Top (Y)',
    34: 'Plating on Laser Cut Top (Area)',
    35: 'Plating on Laser Cut Top (Total Area)',
    36: 'Plating on Laser Cut Top (X)',
    37: 'Plating on Laser Cut Top (Y)',
    38: 'Plating on Body Top (Area)',
    39: 'Plating on Body Top (Total Area)',
    40: 'Lack of Terminal Top (X)',
    41: 'Lack of Terminal Top (Y)',
    42: 'Open Laser Cut Top',
    43: 'Burs Top (Area)',
    44: 'Burs Top (Total Area)',
    45: 'Burs Top (X)',
    46: 'Burs Top (Y)',
    47: 'Character Qty',
    48: 'Character Similarity',
    49: 'Character Boundary (U/D)',
    50: 'Character Boundary (L/R)',
  },
  'CAMERA - BOTTOM': {
    1: 'Angle',
    2: 'Full Body Length Bottom (X)',
    3: 'Full Body Width Bottom (Y)',
    4: 'Terminal Qty Bottom',
    7: 'Max Left Terminal Width Bot (Y)',
    8: 'Min Left Terminal Width Bot (Y)',
    9: 'Max Left Terminal Length Bot (X)',
    10: 'Min Left Terminal Length Bot (X)',
    11: 'Max Right Terminal Width Bot (Y)',
    12: 'Min Right Terminal Width Bot (Y)',
    13: 'Max Right Terminal Length Bot (X)',
    14: 'Min Right Terminal Length Bot (X)',
    15: 'Width Deviation Bottom',
    16: 'Inner Straightness Bottom',
    17: 'Black Coating on Terminal Bottom (Area)',
    18: 'Black Coating on Terminal Bottom (Total Area)',
    19: 'Black Coating on Terminal Bottom (X)',
    20: 'Black Coating on Terminal Bottom (Y)',
    21: 'Missing Coating on Body Bottom (Area)',
    22: 'Missing Coating on Body Bottom (Total Area)',
    23: 'Missing Coating on Body Bottom (X)',
    24: 'Missing Coating on Body Bottom (Y)',
    25: 'Bouble/Scratch on Body Bottom (Area)',
    26: 'Bouble/Scratch on Body Bottom (Total Area)',
    27: 'Straightness Bottom (U/D)',
    28: 'Straightness Bottom (L/R)',
    29: 'Coating Brightness Bottom (Inverted)',
    30: 'Plating on Body Bottom (Area)',
    31: 'Plating on Body Bottom (Total Area)',
    32: 'Plating on Body Bottom (X)',
    33: 'Plating on Body Bottom (Y)',
    34: 'Plating on Laser Cut Bottom (Area)',
    35: 'Plating on Laser Cut Bottom (Total Area)',
    36: 'Plating on Laser Cut Bottom (X)',
    37: 'Plating on Laser Cut Bottom (Y)',
    38: 'White Coating on Terminal bottom (Area)',
    39: 'White Coating on Terminal bottom (Total Area)',
    40: 'White Coating on Terminal bottom (X)',
    41: 'White Coating on Terminal bottom (Y)',
    42: 'Open Laser Cut Bottom',
    43: 'Burs Bottom (Area)',
    44: 'Burs Bottom (Total Area)',
    45: 'Burs Bottom (X)',
    46: 'Burs Bottom (Y)',
  },
  'CAMERA - LEFT': {
    1: 'Height (Y)',
    2: 'Plating on Side-Edge (Area)',
    3: 'Plating on Side-Edge (X)',
    4: 'Plating on Side-Edge (Y)',
    5: 'Bent Part (Area)',
    6: 'Bent Part (X)',
    7: 'Bent Part (Y)',
    8: 'Crack Length',
  },
  'CAMERA - RIGHT': {
    1: 'Height (Y)',
    2: 'Plating on Side-Edge (Area)',
    3: 'Plating on Side-Edge (X)',
    4: 'Plating on Side-Edge (Y)',
    5: 'Bent Part (Area)',
    6: 'Bent Part (X)',
    7: 'Bent Part (Y)',
    8: 'Crack Length',
  },
  'CAMERA - FRONT': {
    1: 'Metal G-channel brightness',
    2: 'Left Side Straightness',
    3: 'Right Side Straightness',
    4: 'Upper Side Straightness',
    5: 'Lower Side Straightness',
    6: 'Damaged Terminal (Area)',
    7: 'Damaged Terminal (X)',
    8: 'Damaged Terminal (Y)',
    9: 'Scratch (Area)',
    10: 'Scratch (X)',
    11: 'Scratch (Y)',
    12: 'MAX bump square凸点最大面积',
    13: 'MAX bump length凸点最大长度',
    14: 'MAX bump width凸点最大宽度',
  },
  'CAMERA - BACK': {
    1: 'Metal G-channel brightness',
    2: 'Left Side Straightness',
    3: 'Right Side Straightness',
    4: 'Upper Side Straightness',
    5: 'lower Side Straightness',
    6: 'Damaged Terminal (Area)',
    7: 'Damaged Terminal (X)',
    8: 'Damaged Terminal (Y)',
    9: 'Scratch (Area)',
    10: 'Scratch (X)',
    11: 'Scratch (Y)',
    12: 'MAX bump square凸点最大面积',
    13: 'MAX bump length 凸点最大长度',
    14: 'MAX bump width 凸点最大宽度',
  },
  'CAMERA - TOP 2': {
    1: 'Angle',
    2: 'Character Qty (Redundancy)',
    3: 'Character Similarity (Redundancy)',
    4: 'Character Boundary U/D (Redundancy)',
    5: 'Character Boundary L/R (Redundancy)',
    6: 'Black Coating on White (Area)',
    7: 'Black Coating on White (X)',
    8: 'Black Coating on White (Y)',
    9: 'Open Laser Cut (Redundancy)',
    10: 'Damaged Coating (Area) Redundancy',
    11: 'Damaged Coating (Total Area) Redundancy',
  },
  'CAMERA - BOTTOM 2': {
    1: 'Angle',
    2: 'Black Coating on White (Area)',
    3: 'Open Laser Cut Bot (Redundency) Area',
    4: 'Open Laser Cut Bot (Redundency) Total Area',
    9: 'Plating on Body Bottom (Area)',
    10: 'Plating on Body Bottom (Total Area)',
    11: 'Plating on Laser Cut Bottom (Redundancy) Area',
    12: 'Plating on Laser Cut Bottom (Redundancy) Total Area',
  }
};

export function getNormalizedCameraName(camera: string, isFromCsv: boolean = false): string {
    if (!camera) return 'CAMERA - TOP';

    let cleanedCamera = camera
        .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
        .trim()
        .toUpperCase();

    const direction = cleanedCamera.replace(/^CAMERA\s*-?\s*/, '').trim();

    if (direction.includes('TOP 2') || direction.includes('TOP2')) {
        // In CSV file, Top 2 is physically Bottom 2 (exchange names)
        return isFromCsv ? 'CAMERA - BOTTOM 2' : 'CAMERA - TOP 2';
    } else if (direction.includes('BOTTOM 2') || direction.includes('BOTTOM2') || direction.includes('BOT 2') || direction.includes('BOT2')) {
        // In CSV file, Bottom 2 is physically Top 2 (exchange names)
        return isFromCsv ? 'CAMERA - TOP 2' : 'CAMERA - BOTTOM 2';
    } else if (direction.includes('TOP')) {
        return 'CAMERA - TOP';
    } else if (direction.includes('BOTTOM') || direction.includes('BOT')) {
        return 'CAMERA - BOTTOM';
    } else if (direction.includes('LEFT')) {
        return 'CAMERA - LEFT';
    } else if (direction.includes('RIGHT')) {
        return 'CAMERA - RIGHT';
    } else if (direction.includes('FRONT')) {
        return 'CAMERA - FRONT';
    } else if (direction.includes('BACK')) {
        return 'CAMERA - BACK';
    }
    
    if (!cleanedCamera.startsWith('CAMERA -')) {
        return `CAMERA - ${cleanedCamera}`;
    }
    return cleanedCamera;
}

export function getDefectName(camera: string, no: number, defaultName: string): string {
    const cleanedCamera = getNormalizedCameraName(camera);
    
    // Prioritize the descriptive defaultName from the CSV if it contains English letters
    const trimmedName = (defaultName || '').trim();
    if (/[a-zA-Z]/.test(trimmedName)) {
        return normalizeDefectName(trimmedName, cleanedCamera);
    }
    
    // Otherwise, fall back to index-based master map
    const mapForCam = DEFECT_MASTER_MAP[cleanedCamera];
    let resolvedName = trimmedName;
    if (mapForCam && mapForCam[no]) {
        resolvedName = mapForCam[no];
    }

    return normalizeDefectName(resolvedName, cleanedCamera);
}
