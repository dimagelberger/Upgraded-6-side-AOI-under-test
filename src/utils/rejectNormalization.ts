import { DefectRecord, SessionSummary } from '../types';
import { getBaseCategory } from './parser';

export type NormalizationMode = 'UNIVERSAL' | 'NORMALIZED' | 'RAW';

export interface CategorySummaryRecord {
  camera: string;
  category: string;
  ngBox: string;
  rawQty: number;
  normalizedQty: number;
  effectiveQty: number;
  subItemCount: number;
  subItems: DefectRecord[];
}

/**
 * Returns the primary/unified camera name for a category.
 * Merges redundant inspection stations (Bottom 2 -> Bottom, Top 2 -> Top)
 * into their corresponding primary face for clean category rollups.
 */
export function getUnifiedCamera(camera: string): string {
  const c = (camera || '').toUpperCase().trim();
  if (c.includes('BOTTOM 2') || c.includes('BOT 2') || c.includes('BOTTOM') || c.includes('BOT')) return 'CAMERA - BOTTOM';
  if (c.includes('TOP 2') || c.includes('TOP')) return 'CAMERA - TOP';
  if (c.includes('LEFT')) return 'CAMERA - LEFT';
  if (c.includes('RIGHT')) return 'CAMERA - RIGHT';
  if (c.includes('FRONT')) return 'CAMERA - FRONT';
  if (c.includes('BACK')) return 'CAMERA - BACK';
  return c.startsWith('CAMERA -') ? c : `CAMERA - ${c}`;
}

/**
 * Maps a defect parameter into its Universal grouping:
 * 1. Whole-Body/Global: Body Length, Body Width, Angle, Open Laser Cut, Burs, Coating Brightness
 * 2. Symmetrical Side Edges: Merges LEFT and RIGHT cameras
 * 3. Symmetrical End Faces: Merges FRONT and BACK cameras
 * 4. Face-Specific: Preserves TOP and BOTTOM face-specific defects (POLC, Character Marking, Coating, etc.)
 */
export function getUniversalCategoryAndCamera(testItem: string, camera: string): { camera: string; category: string; orderNo: number } {
  const baseCat = getBaseCategory(testItem, camera);
  const baseLower = baseCat.toLowerCase();
  const camUpper = (camera || '').toUpperCase();

  // 1. Whole-Body / Global properties
  if (baseLower.includes('full body length') || baseLower.includes('body length')) {
    return { camera: 'GLOBAL / WHOLE-BODY', category: 'Full Body Length (X)', orderNo: 1 };
  }
  if (baseLower.includes('full body width') || baseLower.includes('body width')) {
    return { camera: 'GLOBAL / WHOLE-BODY', category: 'Full Body Width (Y)', orderNo: 2 };
  }
  if (baseLower.includes('angle')) {
    return { camera: 'GLOBAL / WHOLE-BODY', category: 'Angle', orderNo: 3 };
  }
  if (baseLower.includes('open laser cut')) {
    return { camera: 'GLOBAL / WHOLE-BODY', category: 'Open Laser Cut', orderNo: 4 };
  }
  if (baseLower.includes('burs')) {
    return { camera: 'GLOBAL / WHOLE-BODY', category: 'Burs', orderNo: 5 };
  }
  if (baseLower.includes('coating brightness')) {
    return { camera: 'GLOBAL / WHOLE-BODY', category: 'Coating Brightness (Inverted)', orderNo: 6 };
  }

  // 2. Symmetrical Side Edges: LEFT and RIGHT cameras
  if (camUpper.includes('LEFT') || camUpper.includes('RIGHT')) {
    let orderNo = 50;
    if (baseLower.includes('plating on side-edge') || baseLower.includes('side-edge')) orderNo = 51;
    else if (baseLower.includes('bent part') || baseLower.includes('black spot')) orderNo = 52;
    else if (baseLower.includes('crack')) orderNo = 53;
    else if (baseLower.includes('height')) orderNo = 54;
    return { camera: 'CAMERA - SIDES (LEFT / RIGHT)', category: baseCat, orderNo };
  }

  // 3. Symmetrical End Faces: FRONT and BACK cameras
  if (camUpper.includes('FRONT') || camUpper.includes('BACK')) {
    let orderNo = 60;
    if (baseLower.includes('g-channel')) orderNo = 61;
    else if (baseLower.includes('damaged terminal')) orderNo = 62;
    else if (baseLower.includes('straightness')) orderNo = 63;
    else if (baseLower.includes('bump')) orderNo = 64;
    else if (baseLower.includes('scratch')) orderNo = 65;
    return { camera: 'CAMERA - ENDS (FRONT / BACK)', category: baseCat, orderNo };
  }

  // 4. Face-Specific Top & Bottom:
  const unifiedCam = getUnifiedCamera(camera);
  return { camera: unifiedCam, category: baseCat, orderNo: 100 };
}

/**
 * Normalizes defect records per lot.
 * - UNIVERSAL Mode:
 *   Combines whole-body features (Length, Width, Angle, Open Laser Cut, Burs) across cameras,
 *   merges symmetrical side pairs (Left+Right) and end pairs (Front+Back), and keeps face-specific defects separated.
 * - NORMALIZED Mode (Combined by station):
 *   Combines sub-parameters (Area, X, Y) and redundant camera channels per inspection face.
 * - RAW Mode:
 *   Retains the raw, unnormalized individual parameter trigger counts directly from the CSV lines.
 */
export function normalizeDefectsList(
  defects: DefectRecord[],
  sessions: SessionSummary[],
  mode: NormalizationMode = 'NORMALIZED'
): DefectRecord[] {
  if (defects.length === 0) return [];
  if (mode === 'RAW') {
    return defects.map(d => ({
      ...d,
      rawNgQty: d.rawNgQty ?? d.ngQty,
      normalizedNgQty: d.rawNgQty ?? d.ngQty,
      ngQty: d.rawNgQty ?? d.ngQty,
    }));
  }

  const sessionMap = new Map<string, SessionSummary>();
  sessions.forEach(s => {
    if (s.lotNumber) sessionMap.set(s.lotNumber, s);
  });

  const defectsByLot = new Map<string, DefectRecord[]>();
  defects.forEach(d => {
    const lot = d.lotNumber || '-';
    if (!defectsByLot.has(lot)) defectsByLot.set(lot, []);
    defectsByLot.get(lot)!.push(d);
  });

  const normalizedResults: DefectRecord[] = [];

  for (const [lot, lotDefects] of defectsByLot.entries()) {
    const session = sessionMap.get(lot);

    // Group defects in this lot by: unifiedCamera + '::' + unifiedCategory
    const categoryGroups = new Map<string, {
      camera: string;
      category: string;
      ngBox: string;
      records: DefectRecord[];
      rawSum: number;
      maxQty: number;
      minNo: number;
      sampleRecord: DefectRecord;
    }>();

    lotDefects.forEach(d => {
      let box = (d.ngBox || '').trim().toUpperCase();
      if (!box || box === '-') {
        box = 'NG1';
      } else if (box.includes('NG1')) {
        box = 'NG1';
      } else if (box.includes('NG2')) {
        box = 'NG2';
      } else if (box.includes('NG3')) {
        box = 'NG3';
      } else if (box.includes('RST') || box.includes('RETEST')) {
        box = 'RST';
      } else {
        box = 'NG1';
      }

      const isRedundant = d.camera.includes('2');
      let targetCam: string;
      let targetCat: string;
      let sortOrderNo: number;

      if (mode === 'UNIVERSAL') {
        const u = getUniversalCategoryAndCamera(d.testItem, d.camera);
        // For the universal filter: don't show "Coating Brightness" and "Angle"
        const catLower = u.category.toLowerCase();
        if (catLower.includes('angle') || catLower.includes('coating brightness')) {
          return;
        }
        targetCam = u.camera;
        targetCat = u.category;
        sortOrderNo = u.orderNo < 100 ? u.orderNo : (isRedundant ? (100 + d.no) : d.no);
      } else {
        targetCam = getUnifiedCamera(d.camera);
        targetCat = d.baseCategory || getBaseCategory(d.testItem, d.camera);
        sortOrderNo = isRedundant ? (100 + d.no) : d.no;
      }

      const key = `${targetCam}::${targetCat}`;

      if (!categoryGroups.has(key)) {
        categoryGroups.set(key, {
          camera: targetCam,
          category: targetCat,
          ngBox: box,
          records: [],
          rawSum: 0,
          maxQty: 0,
          minNo: sortOrderNo,
          sampleRecord: d,
        });
      }

      const g = categoryGroups.get(key)!;
      g.records.push(d);
      
      if (mode === 'UNIVERSAL') {
        if (sortOrderNo < g.minNo) {
          g.minNo = sortOrderNo;
        }
      } else {
        if (!isRedundant) {
          g.minNo = g.minNo >= 100 ? d.no : Math.min(g.minNo, d.no);
        }
      }

      if (d.ngBox && d.ngBox !== '-' && d.ngBox !== '') {
        g.ngBox = box;
      }
      const rawVal = d.rawNgQty ?? d.ngQty;
      g.rawSum += rawVal;
      if (rawVal > g.maxQty) {
        g.maxQty = rawVal;
      }
    });

    // Output ONE unified record per category for this lot with exact deduplicated peak detected parts
    for (const g of categoryGroups.values()) {
      if (g.maxQty > 0 || g.rawSum > 0) {
        const sample = g.sampleRecord;
        normalizedResults.push({
          lotNumber: lot,
          filename: sample.filename,
          camera: g.camera,
          no: g.minNo,
          testItem: g.category,
          baseCategory: g.category,
          rawNgQty: g.maxQty,
          normalizedNgQty: g.maxQty,
          ngQty: g.maxQty,
          ngRate: session && session.total > 0 ? (g.maxQty / session.total) * 100 : 0,
          loLim: sample.loLim || '-',
          hiLim: sample.hiLim || '-',
          unit: sample.unit || '-',
          ngBox: g.ngBox,
          sessionStartTime: sample.sessionStartTime,
        });
      }
    }
  }

  return normalizedResults;
}

/**
 * Computes unified category-level summaries for Pareto and Top Defect rankings.
 */
export function getCategorySummaries(
  defects: DefectRecord[],
  sessions: SessionSummary[],
  mode: NormalizationMode = 'NORMALIZED'
): CategorySummaryRecord[] {
  const normDefects = normalizeDefectsList(defects, sessions, mode);
  const map = new Map<string, CategorySummaryRecord>();

  normDefects.forEach(d => {
    const cam = d.camera;
    const cat = d.baseCategory || getBaseCategory(d.testItem, d.camera);
    const key = `${cam}::${cat}`;

    if (!map.has(key)) {
      map.set(key, {
        camera: cam,
        category: cat,
        ngBox: d.ngBox || 'NG1',
        rawQty: 0,
        normalizedQty: 0,
        effectiveQty: 0,
        subItemCount: 0,
        subItems: [],
      });
    }

    const entry = map.get(key)!;
    entry.rawQty += (d.rawNgQty ?? d.ngQty);
    entry.normalizedQty += (d.normalizedNgQty ?? d.ngQty);
    entry.effectiveQty += d.ngQty;
    entry.subItemCount += 1;
    entry.subItems.push(d);
  });

  return Array.from(map.values()).sort((a, b) => b.effectiveQty - a.effectiveQty);
}
