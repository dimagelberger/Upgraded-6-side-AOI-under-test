import { SessionSummary } from '../types';
import { parseDateTime } from './dateUtils';

export interface ReconciliationResult {
  activeSessions: SessionSummary[];
  rejectedSessions: SessionSummary[];
  duplicateLots: Set<string>; // Set of lot numbers that have duplicate runs (multi-runs)
}

/**
 * Extracts the recipe program code dynamically:
 * - Checks barcodeNumber first (e.g. "WBI8 R1F 0" -> "WBI8", "WBT1 R2F 0" -> "WBT1")
 * - Checks filename and model for common program codes (WBI8, WBT1, 12LC, BENT, HAN8, etc.)
 */
function getProgramTag(s: SessionSummary): string {
  // 1. Check barcodeNumber first (e.g. "WBI8 R1F 0" -> "WBI8", "WBT1 R2F 0" -> "WBT1")
  const b = (s.barcodeNumber || '').trim().toUpperCase();
  if (b && b !== '-') {
    const firstToken = b.split(/[\s_-]+/)[0];
    if (firstToken && firstToken !== '-' && !/^\d+$/.test(firstToken)) {
      return firstToken;
    }
  }

  // 2. Check filename and model for common program codes
  const combined = `${s.filename} ${s.model}`.toUpperCase();
  const match = combined.match(/\b(WBI\d+|WBT\d*|12LC|BENT|HAN\d*|ACCORDION)\b/i);
  if (match) {
    return match[1].toUpperCase();
  }

  // 3. Check for any alphanumeric program code in filename
  const fnTokens = s.filename.replace(/\.csv$/i, '').split(/[_\s-]+/);
  for (const token of fnTokens) {
    const u = token.toUpperCase();
    if (/^[A-Z]{2,4}\d*$/.test(u) && !/^\d+$/.test(u)) {
      return u;
    }
  }

  return 'WBT1';
}

/**
 * Classifies a run's program recipe:
 * - BENT: Targeted screening pass for min/max terminals width/length (accordion)
 * - 12LC: Full engineering re-run with Bottom POLC enabled
 * - RETEST: Repaired / retested units run
 * - WBT1 / WBI8 / STANDARD: Standard production inspection program
 */
function classifyRun(s: SessionSummary): { isBent: boolean; is12LC: boolean; isRetest: boolean; programTag: string } {
  const combined = `${s.filename} ${s.model} ${s.lotNumber} ${s.barcodeNumber}`.toUpperCase();
  const isBent = combined.includes('BENT') || combined.includes('ACCORDION');
  const is12LC = combined.includes('12LC') || combined.includes('12-LC');
  const isRetest = combined.includes('RETEST') || combined.includes('RST');

  const programTag = getProgramTag(s);
  return { isBent, is12LC, isRetest, programTag };
}

/**
 * Reconcile machine sessions (runs) using intelligent manufacturing workflows:
 * 1. Specialized Screening Runs (BENT / Accordion):
 *    - BENT is a targeted secondary pass inspecting terminal width and length.
 *    - Merges with the standard foundation run (WBT1, WBI8, etc.), linking all source filenames.
 *    - Preserves all tools from both runs with zero data loss.
 * 2. Engineering Re-Run (12LC):
 *    - 12LC is a re-run with Bottom POLC enabled.
 *    - Adopts 12LC authoritative results and links earlier runs.
 * 3. Retests:
 *    - Sequential consolidation of retested units.
 *    - Setup Calibration Runs:
 *    - Aborted or tiny probe tests (<50%) are moved to rejected.
 */
export function reconcileSessions(sessions: SessionSummary[]): ReconciliationResult {
  const groups: { [lot: string]: SessionSummary[] } = {};
  const duplicateLots = new Set<string>();

  sessions.forEach(s => {
    if (!s.lotNumber || s.lotNumber === '-') return;
    const baseLot = s.lotNumber.split(/[-_]/)[0].trim();
    if (!groups[baseLot]) {
      groups[baseLot] = [];
    }
    groups[baseLot].push(s);
  });

  Object.keys(groups).forEach(lot => {
    if (groups[lot].length > 1) {
      duplicateLots.add(lot);
    }
  });

  const activeSessions: SessionSummary[] = [];
  const rejectedSessions: SessionSummary[] = [];

  Object.keys(groups).forEach(lot => {
    const allRuns = [...groups[lot]];
    
    // Sort runs of this lot chronologically
    allRuns.sort((a, b) => {
      const ta = parseDateTime(a.startTime);
      const tb = parseDateTime(b.startTime);
      return ta - tb;
    });

    // 1. Filter out runs with 0 total parts
    const runHistory = allRuns.filter(r => r.total > 0);
    const zeroPartRuns = allRuns.filter(r => r.total === 0);

    if (runHistory.length === 0) {
      zeroPartRuns.forEach(r => r.lotNumber = lot);
      rejectedSessions.push(...zeroPartRuns);
      return;
    }

    if (runHistory.length === 1) {
      const single = { ...runHistory[0], lotNumber: lot, sourceFilenames: [runHistory[0].filename] };
      activeSessions.push(single);
      rejectedSessions.push(...zeroPartRuns);
      return;
    }

    // Check for specialized programs in this lot's runs
    const bentRuns = runHistory.filter(r => classifyRun(r).isBent);
    const lcRuns = runHistory.filter(r => classifyRun(r).is12LC);
    const standardRuns = runHistory.filter(r => !classifyRun(r).isBent && !classifyRun(r).is12LC && !classifyRun(r).isRetest);
    const retestRuns = runHistory.filter(r => classifyRun(r).isRetest);

    // WORKFLOW 1: 12LC Re-Run (with Bottom POLC Enabled)
    if (lcRuns.length > 0) {
      // The latest 12LC run is the authoritative re-run
      const latestLC = lcRuns[lcRuns.length - 1];
      const allLinkedFiles = new Set<string>([latestLC.filename]);
      
      standardRuns.forEach(s => allLinkedFiles.add(s.filename));
      bentRuns.forEach(b => allLinkedFiles.add(b.filename));
      lcRuns.forEach(lc => allLinkedFiles.add(lc.filename));

      const primaryStandard = standardRuns.length > 0 ? [...standardRuns].sort((a, b) => b.total - a.total)[0] : null;
      const baseTag = primaryStandard ? classifyRun(primaryStandard).programTag : '';
      let label = baseTag ? `${baseTag} + 12LC` : '12LC (POLC Re-Run)';
      if (bentRuns.length > 0) {
        label = baseTag ? `${baseTag} + 12LC + BENT` : '12LC + BENT';
      }

      const mergedActive: SessionSummary = {
        ...latestLC,
        lotNumber: lot,
        sourceFilenames: Array.from(allLinkedFiles),
        multiPassLabel: label,
        multiPassType: 'POLC_RERUN',
      };

      activeSessions.push(mergedActive);
      rejectedSessions.push(...zeroPartRuns);
      return;
    }

    // WORKFLOW 2: Standard Full Run + BENT Targeted Screening Pass
    if (bentRuns.length > 0 && standardRuns.length > 0) {
      // Pick the primary standard full inspection run (highest total or latest)
      const primaryStandard = [...standardRuns].sort((a, b) => b.total - a.total)[0];
      const allLinkedFiles = new Set<string>([primaryStandard.filename]);
      
      bentRuns.forEach(b => allLinkedFiles.add(b.filename));

      const standardTag = classifyRun(primaryStandard).programTag;
      const label = `${standardTag} + BENT`;

      const mergedActive: SessionSummary = {
        ...primaryStandard,
        lotNumber: lot,
        sourceFilenames: Array.from(allLinkedFiles),
        multiPassLabel: label,
        multiPassType: 'BENT_SCREENING',
      };

      activeSessions.push(mergedActive);

      // Any discarded earlier standard runs (e.g. tiny aborted setup) go to rejected
      const discarded = standardRuns.filter(r => r.filename !== primaryStandard.filename);
      discarded.forEach(d => d.lotNumber = lot);
      rejectedSessions.push(...discarded, ...zeroPartRuns);
      return;
    }

    // WORKFLOW 3: Standard Multi-Runs / Retests / Setup adjustment
    let currentActive = { ...runHistory[0], lotNumber: lot, sourceFilenames: [runHistory[0].filename] };
    const historicalDiscarded: SessionSummary[] = [...zeroPartRuns];
    historicalDiscarded.forEach(r => r.lotNumber = lot);

    for (let i = 1; i < runHistory.length; i++) {
      const curr = runHistory[i];
      const T_prev = currentActive.total;
      const T_curr = curr.total;

      const isExplicitRetest = classifyRun(curr).isRetest;
      const isRetestSize = T_curr > 0 && T_curr < T_prev * 0.4;

      if (isExplicitRetest || isRetestSize) {
        // Consolidate retest
        const newOk = currentActive.okQty + curr.okQty;
        const newNg1 = curr.ng1Qty;
        const newNg2 = curr.ng2Qty;
        const newNg3 = curr.ng3Qty;
        const newRetest = curr.retestQty;
        const newTotal = Math.max(T_prev, newOk + newNg1 + newNg2 + newNg3);
        const newYieldRate = newTotal > 0 ? ((newOk / newTotal) * 100).toFixed(2) + '%' : '0.00%';

        const prevLinked = currentActive.sourceFilenames || [currentActive.filename];
        const newLinked = Array.from(new Set([...prevLinked, curr.filename]));

        historicalDiscarded.push({ ...currentActive });
        currentActive = {
          ...curr,
          lotNumber: lot,
          sourceFilenames: newLinked,
          multiPassType: 'RETEST',
          multiPassLabel: 'Retest Consolidated',
          total: newTotal,
          okQty: newOk,
          ng1Qty: newNg1,
          ng2Qty: newNg2,
          ng3Qty: newNg3,
          retestQty: newRetest,
          yieldRate: newYieldRate
        };
      } else {
        // Replace logic
        if (T_curr > T_prev * 1.5) {
          historicalDiscarded.push({ ...currentActive });
          currentActive = { ...curr, lotNumber: lot, sourceFilenames: [curr.filename] };
        } else if (T_curr < T_prev * 0.5) {
          historicalDiscarded.push({ ...curr, lotNumber: lot });
        } else {
          historicalDiscarded.push({ ...currentActive });
          currentActive = { ...curr, lotNumber: lot, sourceFilenames: [curr.filename] };
        }
      }
    }

    activeSessions.push(currentActive);
    rejectedSessions.push(...historicalDiscarded);
  });

  const sortByDateDesc = (a: SessionSummary, b: SessionSummary) => {
    const ta = parseDateTime(a.startTime);
    const tb = parseDateTime(b.startTime);
    return tb - ta;
  };

  activeSessions.sort(sortByDateDesc);
  rejectedSessions.sort(sortByDateDesc);

  return {
    activeSessions,
    rejectedSessions,
    duplicateLots
  };
}
