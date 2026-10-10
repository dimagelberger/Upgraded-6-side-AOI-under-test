import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { UploadButton } from './components/UploadButton';
import { QCUploadButton } from './components/QCUploadButton';
import { SessionTable, calcTotalTimeValue } from './components/SessionTable';
import { DefectTable } from './components/DefectTable';
import { DefectMatrix } from './components/DefectMatrix';
import { SystemStats } from './components/SystemStats';
import { IngestionLogList } from './components/IngestionLogList';
import { LotYieldChart } from './components/LotYieldChart';
import { OeeAnalytics } from './components/OeeAnalytics';
import { DefectParetoChart } from './components/DefectParetoChart';
import { MultiSelect } from './components/MultiSelect';
import { SessionSummary, DefectRecord, IngestionLog } from './types';
import { parseAOILog } from './utils/parser';
import { reconcileSessions } from './utils/reconciliation';
import { parseDateTime, getWeekInfo } from './utils/dateUtils';
import { normalizeDefectsList, NormalizationMode } from './utils/rejectNormalization';
import { QCSummaryTab, QCSessionRecord } from './components/QCSummaryTab';
import { Cpu, Search, X, Download, Trash2, LayoutDashboard, List, Grid3X3, Save, FolderOpen, AlertTriangle, ScrollText, Activity, Gauge, GitCompare, Loader2, CheckCircle2, XCircle, AlertCircle, Github, GitBranch, Copy, Check, ExternalLink, Sliders } from 'lucide-react';

export default function App() {
  const [mainSessions, setMainSessions] = useState<SessionSummary[]>([]);
  const [mainDefects, setMainDefects] = useState<DefectRecord[]>([]);
  
  const [probSessions, setProbSessions] = useState<SessionSummary[]>([]);
  const [probDefects, setProbDefects] = useState<DefectRecord[]>([]);
  
  const [appMode, setAppMode] = useState<'MAIN' | 'PROBLEMATIC'>('MAIN');
  const [normalizationMode, setNormalizationMode] = useState<NormalizationMode>('UNIVERSAL');

  // Dynamically reconcile and deduplicate mainSessions according to QC multi-run rules
  const reconciledData = useMemo(() => {
    return reconcileSessions(mainSessions);
  }, [mainSessions]);

  const sessions = useMemo(() => {
    const raw = appMode === 'MAIN' 
      ? reconciledData.activeSessions 
      : [...probSessions, ...reconciledData.rejectedSessions];
      
    // Default sort by date desc if not sorted elsewhere (like in SessionTable)
    // This helps in other views like Overview/Charts that use this sessions array.
    return [...raw].sort((a, b) => {
      const ta = parseDateTime(a.startTime);
      const tb = parseDateTime(b.startTime);
      return tb - ta;
    });
  }, [appMode, reconciledData, probSessions]);

  const defects = appMode === 'MAIN' ? mainDefects : probDefects;

  const setSessions = appMode === 'MAIN' ? setMainSessions : setProbSessions;
  const setDefects = appMode === 'MAIN' ? setMainDefects : setProbDefects;

  const [ingestionLogs, setIngestionLogs] = useState<IngestionLog[]>([]);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'RUNS' | 'MATRIX' | 'TOP_DEFECTS' | 'QC_SUMMARY'>('QC_SUMMARY');
  const [highlightedLot, setHighlightedLot] = useState<string | undefined>(undefined);
  const [searchLotTopDefects, setSearchLotTopDefects] = useState<string>('');

  // States for QC Reconciliation Excel upload
  const [qcAutoSessions, setQcAutoSessions] = useState<QCSessionRecord[]>([]);
  const [qcManualSessions, setQcManualSessions] = useState<QCSessionRecord[]>([]);
  const [qcAutoFilename, setQcAutoFilename] = useState<string>('');
  const [qcManualFilename, setQcManualFilename] = useState<string>('');

  const reconciledLotsCount = useMemo(() => {
    const allLots = Array.from(new Set([
      ...qcAutoSessions.map(s => s.lotNumber),
      ...qcManualSessions.map(s => s.lotNumber)
    ])).filter(Boolean);
    return allLots.length;
  }, [qcAutoSessions, qcManualSessions]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isLoadedFromIdb, setIsLoadedFromIdb] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Ingestion wizard / modal states
  const ingestQueueRef = React.useRef<File[]>([]);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<'CONFIRM' | 'PROCESSING' | 'COMPLETED'>('CONFIRM');
  const [ingestStats, setIngestStats] = useState({
    total: 0,
    toImportCount: 0,
    duplicateCount: 0,
    processed: 0,
    success: 0,
    error: 0,
    warning: 0,
  });
  const [currentIngestFile, setCurrentIngestFile] = useState<string>('');
  const [isIngestCancelled, setIsIngestCancelled] = useState(false);
  const ingestCancelledRef = React.useRef(false);

  // Load database from IndexedDB on initial mount
  useEffect(() => {
    const loadStored = async () => {
      try {
        const storedSessions = await idbGet('aoi_sessions');
        const storedDefects = await idbGet('aoi_defects');
        const storedProbSessions = await idbGet('aoi_prob_sessions');
        const storedProbDefects = await idbGet('aoi_prob_defects');
        const storedLogs = await idbGet('aoi_logs');
        
        const storedQcAuto = await idbGet('aoi_qc_auto');
        const storedQcManual = await idbGet('aoi_qc_manual');
        const storedQcAutoName = await idbGet('aoi_qc_auto_name');
        const storedQcManualName = await idbGet('aoi_qc_manual_name');

        if (storedSessions && Array.isArray(storedSessions)) setMainSessions(storedSessions);
        if (storedDefects && Array.isArray(storedDefects)) setMainDefects(storedDefects);
        if (storedProbSessions && Array.isArray(storedProbSessions)) setProbSessions(storedProbSessions);
        if (storedProbDefects && Array.isArray(storedProbDefects)) setProbDefects(storedProbDefects);
        if (storedLogs && Array.isArray(storedLogs)) setIngestionLogs(storedLogs);
        
        if (storedQcAuto && Array.isArray(storedQcAuto)) setQcAutoSessions(storedQcAuto);
        if (storedQcManual && Array.isArray(storedQcManual)) setQcManualSessions(storedQcManual);
        if (storedQcAutoName) setQcAutoFilename(storedQcAutoName);
        if (storedQcManualName) setQcManualFilename(storedQcManualName);

        if (storedSessions && Array.isArray(storedSessions) && storedSessions.length > 0) {
          setActiveTab('OVERVIEW');
        } else {
          setActiveTab('QC_SUMMARY');
        }
      } catch (e) {
        console.error('Failed to load store from idb-keyval:', e);
      } finally {
        setIsLoadedFromIdb(true);
      }
    };
    loadStored();
  }, []);

  // Sync to IndexedDB whenever states change
  useEffect(() => {
    if (isLoadedFromIdb) {
      idbSet('aoi_sessions', mainSessions).catch(err => console.error('Error saving sessions:', err));
    }
  }, [mainSessions, isLoadedFromIdb]);

  useEffect(() => {
    if (isLoadedFromIdb) {
      idbSet('aoi_defects', mainDefects).catch(err => console.error('Error saving defects:', err));
    }
  }, [mainDefects, isLoadedFromIdb]);
  
  useEffect(() => {
    if (isLoadedFromIdb) {
      idbSet('aoi_prob_sessions', probSessions).catch(console.error);
    }
  }, [probSessions, isLoadedFromIdb]);

  useEffect(() => {
    if (isLoadedFromIdb) {
      idbSet('aoi_prob_defects', probDefects).catch(console.error);
    }
  }, [probDefects, isLoadedFromIdb]);

  useEffect(() => {
    if (isLoadedFromIdb) {
      idbSet('aoi_logs', ingestionLogs).catch(err => console.error('Error saving logs:', err));
    }
  }, [ingestionLogs, isLoadedFromIdb]);

  // Sync QC Reconciliation datasets to IndexedDB
  useEffect(() => {
    if (isLoadedFromIdb) {
      idbSet('aoi_qc_auto', qcAutoSessions).catch(err => console.error('Error saving QC auto:', err));
    }
  }, [qcAutoSessions, isLoadedFromIdb]);

  useEffect(() => {
    if (isLoadedFromIdb) {
      idbSet('aoi_qc_manual', qcManualSessions).catch(err => console.error('Error saving QC manual:', err));
    }
  }, [qcManualSessions, isLoadedFromIdb]);

  useEffect(() => {
    if (isLoadedFromIdb) {
      idbSet('aoi_qc_auto_name', qcAutoFilename).catch(err => console.error('Error saving QC auto file name:', err));
    }
  }, [qcAutoFilename, isLoadedFromIdb]);

  useEffect(() => {
    if (isLoadedFromIdb) {
      idbSet('aoi_qc_manual_name', qcManualFilename).catch(err => console.error('Error saving QC manual file name:', err));
    }
  }, [qcManualFilename, isLoadedFromIdb]);

  const models = useMemo(() => {
     return Array.from(new Set(sessions.map(s => s.model))).filter(Boolean).sort();
  }, [sessions]);

  const filteredSessions = useMemo(() => {
     if (selectedModels.length === 0) return sessions;
     return sessions.filter(s => s.model && selectedModels.includes(s.model));
  }, [sessions, selectedModels]);

  const availableMonths = useMemo(() => {
     return Array.from(new Set(filteredSessions.map(s => {
         const date = new Date(s.startTime);
         return !isNaN(date.getTime()) ? date.toLocaleDateString('default', { month: '2-digit', year: '2-digit' }) : '';
     }))).filter(Boolean).sort((a: any, b: any) => {
         const [mA, yA] = a.split('/');
         const [mB, yB] = b.split('/');
         return (parseInt(yA) * 100 + parseInt(mA)) - (parseInt(yB) * 100 + parseInt(mB));
     });
  }, [filteredSessions]);

  const availableWeeks = useMemo(() => {
     let matchingSessions = filteredSessions;
     if (selectedMonths.length > 0) {
         matchingSessions = matchingSessions.filter(s => {
             const date = new Date(s.startTime);
             if (isNaN(date.getTime())) return false;
             const monthString = date.toLocaleDateString('default', { month: '2-digit', year: '2-digit' });
             return selectedMonths.includes(monthString);
         });
     }
     return Array.from(new Set(matchingSessions.map(s => getWeekInfo(s.startTime)))).filter(Boolean).sort((a: any, b: any) => {
        const [aW, aY] = a.replace('WW','').split('-');
        const [bW, bY] = b.replace('WW','').split('-');
        return (parseInt(aY) * 100 + parseInt(aW)) - (parseInt(bY) * 100 + parseInt(bW));
     });
  }, [filteredSessions, selectedMonths]);

  const availableDates = useMemo(() => {
      let matchingSessions = filteredSessions;
      if (selectedMonths.length > 0) {
         matchingSessions = matchingSessions.filter(s => {
             const date = new Date(s.startTime);
             if (isNaN(date.getTime())) return false;
             const monthString = date.toLocaleDateString('default', { month: '2-digit', year: '2-digit' });
             return selectedMonths.includes(monthString);
         });
      }
      if (selectedWeeks.length > 0) {
          matchingSessions = matchingSessions.filter(s => selectedWeeks.includes(getWeekInfo(s.startTime)));
      }
      return Array.from(new Set(matchingSessions.map(s => {
          const date = new Date(s.startTime);
          return !isNaN(date.getTime()) ? date.toLocaleDateString() : '';
      }))).filter(Boolean).sort((a: any, b: any) => new Date(a).getTime() - new Date(b).getTime());
  }, [filteredSessions, selectedMonths, selectedWeeks]);

  const chartSessions = useMemo(() => {
     let result = filteredSessions;
     if (selectedMonths.length > 0) {
         result = result.filter(s => {
             const date = new Date(s.startTime);
             if (isNaN(date.getTime())) return false;
             const monthString = date.toLocaleDateString('default', { month: '2-digit', year: '2-digit' });
             return selectedMonths.includes(monthString);
         });
     }
     if (selectedWeeks.length > 0) {
         result = result.filter(s => selectedWeeks.includes(getWeekInfo(s.startTime)));
     }
     if (selectedDates.length > 0) {
         result = result.filter(s => {
             const date = new Date(s.startTime);
             return !isNaN(date.getTime()) && selectedDates.includes(date.toLocaleDateString());
         });
     }
     return result;
  }, [filteredSessions, selectedMonths, selectedWeeks, selectedDates]);

  const activeDefects = useMemo(() => {
     const filenames = new Set<string>();
     chartSessions.forEach(cs => {
       if (cs.sourceFilenames && cs.sourceFilenames.length > 0) {
         cs.sourceFilenames.forEach(fn => filenames.add(fn.toLowerCase()));
       } else if (cs.filename) {
         filenames.add(cs.filename.toLowerCase());
       }
     });
     return defects.filter(d => d.filename && filenames.has(d.filename.toLowerCase()));
  }, [defects, chartSessions]);

  const universalActiveDefects = useMemo(() => {
     return normalizeDefectsList(activeDefects, chartSessions, 'UNIVERSAL');
  }, [activeDefects, chartSessions]);

  const stationActiveDefects = useMemo(() => {
     return normalizeDefectsList(activeDefects, chartSessions, 'NORMALIZED');
  }, [activeDefects, chartSessions]);

  const normalizedActiveDefects = useMemo(() => {
     return normalizeDefectsList(activeDefects, chartSessions, normalizationMode);
  }, [activeDefects, chartSessions, normalizationMode]);

  const topDefectsToRender = useMemo(() => {
     if (!searchLotTopDefects.trim()) return normalizedActiveDefects;
     const searchStr = searchLotTopDefects.trim().toLowerCase();
     return normalizedActiveDefects.filter(d => d.lotNumber?.toLowerCase().includes(searchStr));
  }, [normalizedActiveDefects, searchLotTopDefects]);

  const filteredDefects = normalizedActiveDefects;
  const _unusedFilteredDefects = useMemo(() => {
     if (selectedModels.length === 0) return defects;
     
     const sessionMap = new Map<string, SessionSummary>();
     sessions.forEach(s => {
         if (s.filename) {
             sessionMap.set(s.filename.toLowerCase(), s);
         }
     });

     return defects.filter(d => {
         if (!d.filename) return false;
         const session = sessionMap.get(d.filename.toLowerCase());
         return session && selectedModels.includes(session.model);
     });
  }, [defects, sessions, selectedModels]);

  const [saveStatus, setSaveStatus] = useState<string>('');

  const handleSaveData = () => {
    try {
      const data = { 
        sessions: mainSessions, 
        defects: mainDefects, 
        probSessions, 
        probDefects, 
        ingestionLogs 
      };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aoi_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error exporting JSON');
    }
  };

  const handleLoadData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target?.result as string);
                    if (data.sessions && data.defects) {
                        setMainSessions(data.sessions);
                        setMainDefects(data.defects);
                        if (data.probSessions) setProbSessions(data.probSessions);
                        if (data.probDefects) setProbDefects(data.probDefects);
                        if (data.ingestionLogs) setIngestionLogs(data.ingestionLogs);
                        alert('Data loaded successfully!');
                    }
                } catch (err) {
                    alert('Invalid file format');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
  };

  const handleLotDoubleClick = (lotId: string) => {
      setHighlightedLot(lotId);
      setActiveTab('MATRIX');
      // A small timeout to let the tab render before possible scrolling
      setTimeout(() => {
          // Can add scroll-into-view logic here if needed, but the column highlight usually suffices
      }, 100);
  };

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;

    // Collect existing filenames to avoid duplicates
    const existingMainFiles = new Set(mainSessions.map(s => s.filename?.toLowerCase()).filter(Boolean));
    const existingProbFiles = new Set(probSessions.map(s => s.filename?.toLowerCase()).filter(Boolean));

    let duplicateCount = 0;
    const toImport: File[] = [];

    // Fast loop for maximum performance over huge arrays
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const filenameLower = (f.name || '').toLowerCase();

      // ONLY accept CSV and TXT files. This is CRITICAL for large directory uploads
      // which might contain thousands of irrelevant files (images, exes, subdirs, etc).
      if (!filenameLower.endsWith('.csv') && !filenameLower.endsWith('.txt')) {
        continue;
      }

      if (existingMainFiles.has(filenameLower) || existingProbFiles.has(filenameLower)) {
        duplicateCount++;
      } else {
        toImport.push(f);
      }
    }

    ingestQueueRef.current = toImport;
    setIngestStats({
      total: files.length,
      toImportCount: toImport.length,
      duplicateCount: duplicateCount,
      processed: 0,
      success: 0,
      error: 0,
      warning: 0,
    });
    setIngestStatus('CONFIRM');
    setIsIngestCancelled(false);
    ingestCancelledRef.current = false;
    setCurrentIngestFile('');
    setShowIngestModal(true);
  };

  const cancelIngestProcess = () => {
    ingestCancelledRef.current = true;
    setIsIngestCancelled(true);
  };

  const startIngestProcess = async () => {
    setIngestStatus('PROCESSING');
    setIsIngestCancelled(false);
    ingestCancelledRef.current = false;

    // Force a paint cycle so the processing layout and progress bar appear immediately!
    await new Promise(resolve => setTimeout(resolve, 100));

    const totalToProcess = ingestQueueRef.current.length;
    if (totalToProcess === 0) {
      setIngestStatus('COMPLETED');
      return;
    }

    const newMainSessions: SessionSummary[] = [];
    const newMainDefects: DefectRecord[] = [];
    const newProbSessions: SessionSummary[] = [];
    const newProbDefects: DefectRecord[] = [];
    const newLogs: IngestionLog[] = [];

    let successCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    const BATCH_SIZE = 200;

    for (let i = 0; i < totalToProcess; i += BATCH_SIZE) {
      if (ingestCancelledRef.current) {
        break;
      }

      const chunk = ingestQueueRef.current.slice(i, i + BATCH_SIZE);
      const lastFileInChunk = chunk[chunk.length - 1];
      setCurrentIngestFile(lastFileInChunk.name);

      // Read chunk in parallel using highly optimized native browser file.text() method
      const readResults = await Promise.all(
        chunk.map(async (file) => {
          try {
            const text = await file.text();
            return { file, text };
          } catch (err) {
            return { file, text: '' };
          }
        })
      );

      // Synchronously parse contents for the chunk, but yield periodically
      for (let j = 0; j < readResults.length; j++) {
        const { file, text } = readResults[j];
        const timestampStr = new Date().toISOString().split('T')[1].split('.')[0];

        if (!text) {
          errorCount++;
          newLogs.push({
            filename: file.name,
            timestamp: timestampStr,
            status: 'ERROR',
            message: 'Failed to read file contents'
          });
        } else {
          try {
            const parsed = parseAOILog(text, file.name);
            
            if (parsed.session.total <= 0 && parsed.defects.length === 0) {
              warningCount++;
              newLogs.push({
                filename: file.name,
                timestamp: timestampStr,
                status: 'WARNING',
                message: 'Skipped: No parts found or empty log'
              });
            } else {
              const coreLotNum = (parsed.session.lotNumber || '').split('-')[0].trim();
              const isStandardLot = /^\d{7,8}$/.test(coreLotNum);

              if (parsed.session.total < 5000 || parsed.session.total > 150000 || !isStandardLot) {
                newProbSessions.push(parsed.session as SessionSummary);
                newProbDefects.push(...parsed.defects);
                
                let reason = `Out of bounds parts (${parsed.session.total})`;
                if (!isStandardLot) {
                    reason = `Invalid lot number format (${parsed.session.lotNumber})`;
                }

                errorCount++;
                newLogs.push({
                  filename: file.name,
                  timestamp: timestampStr,
                  status: 'ERROR',
                  message: `Rejected: ${reason}`,
                  yieldRate: parsed.session.yieldRate
                });
              } else {
                successCount++;
                newMainSessions.push(parsed.session as SessionSummary);
                newMainDefects.push(...parsed.defects);
                
                newLogs.push({
                  filename: file.name,
                  timestamp: timestampStr,
                  status: 'SUCCESS',
                  message: `${parsed.session.total} pcs parsed`,
                  yieldRate: parsed.session.yieldRate
                });
              }
            }
          } catch (err) {
            errorCount++;
            newLogs.push({
              filename: file.name,
              timestamp: timestampStr,
              status: 'ERROR',
              message: 'Parsing failure'
            });
          }
        }
        
        // Yield every 25 files to prevent main thread lockup
        if (j > 0 && j % 25 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      const processedCount = Math.min(i + BATCH_SIZE, totalToProcess);

      // Update statistics once per batch to avoid component re-rendering lag
      setIngestStats(prev => ({
        ...prev,
        processed: processedCount,
        success: successCount,
        error: errorCount,
        warning: warningCount,
      }));

      // Yield control back to UI rendering thread between batches so progress bar is perfectly smooth
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 5)));
    }

    // Batch apply updates to state to optimize performance
    if (newMainSessions.length > 0) {
      setMainSessions(prev => [...prev, ...newMainSessions]);
    }
    if (newMainDefects.length > 0) {
      setMainDefects(prev => [...prev, ...newMainDefects]);
    }
    if (newProbSessions.length > 0) {
      setProbSessions(prev => [...prev, ...newProbSessions]);
    }
    if (newProbDefects.length > 0) {
      setProbDefects(prev => [...prev, ...newProbDefects]);
    }
    if (newLogs.length > 0) {
      setIngestionLogs(prev => [...newLogs, ...prev]);
    }

    setIngestStatus('COMPLETED');
  };



  const clearData = () => {
    setShowClearConfirm(true);
  };

  const confirmClearData = () => {
    setMainSessions([]);
    setMainDefects([]);
    setProbSessions([]);
    setProbDefects([]);
    setIngestionLogs([]);
    setQcAutoSessions([]);
    setQcManualSessions([]);
    setQcAutoFilename('');
    setQcManualFilename('');
    setActiveTab('QC_SUMMARY');
    setHighlightedLot(undefined);
    setShowClearConfirm(false);
    setSelectedModels([]);
    setSelectedMonths([]);
    setSelectedWeeks([]);
    setSelectedDates([]);
    if (isLoadedFromIdb) {
      idbSet('aoi_sessions', []).catch(console.error);
      idbSet('aoi_defects', []).catch(console.error);
      idbSet('aoi_prob_sessions', []).catch(console.error);
      idbSet('aoi_prob_defects', []).catch(console.error);
      idbSet('aoi_logs', []).catch(console.error);
      idbSet('aoi_qc_auto', []).catch(console.error);
      idbSet('aoi_qc_manual', []).catch(console.error);
      idbSet('aoi_qc_auto_name', '').catch(console.error);
      idbSet('aoi_qc_manual_name', '').catch(console.error);
    }
  };

  const { totalProcessed, totalOk, totalNg, aggregateYield } = useMemo(() => {
    if (chartSessions.length === 0) return { totalProcessed: 0, totalOk: 0, totalNg: 0, aggregateYield: '0.00%' };
    let processed = 0, ok = 0, ng = 0;
    
    chartSessions.forEach(s => {
      processed += s.total;
      ok += s.okQty;
      ng += (s.total - s.okQty);
    });

    const yld = processed > 0 ? ((ok / processed) * 100).toFixed(2) + '%' : '0.00%';
    return { totalProcessed: processed, totalOk: ok, totalNg: ng, aggregateYield: yld };
  }, [chartSessions]);

  const handleExportXLSX = () => {
    try {
      const wb = XLSX.utils.book_new();

      const totalPartsSum = chartSessions.reduce((sum, s) => sum + s.total, 0);
      const totalOkSum = chartSessions.reduce((sum, s) => sum + s.okQty, 0);
      const totalNgSum = chartSessions.reduce((sum, s) => sum + (s.ng1Qty + s.ng2Qty + s.ng3Qty), 0);
      const calculatedYield = totalPartsSum > 0 ? ((totalOkSum / totalPartsSum) * 100).toFixed(2) + '%' : '0.00%';

      const overviewData = [
        ["AOI INGESTION SYSTEM REPORT"],
        ["Export Timestamp", new Date().toLocaleString()],
        [],
        ["FILTER CONSTRAINTS"],
        ["Models Filter", selectedModels.length > 0 ? selectedModels.join(", ") : "All Models"],
        ["Months Filter", selectedMonths.length > 0 ? selectedMonths.join(", ") : "All Months"],
        ["Weeks Filter", selectedWeeks.length > 0 ? selectedWeeks.join(", ") : "All Weeks"],
        ["Dates Filter", selectedDates.length > 0 ? selectedDates.join(", ") : "All Dates"],
        [],
        ["OVERALL METRICS FOR FILTERED DATA"],
        ["Total Processed Lots", chartSessions.length],
        ["Total Processed Parts", totalPartsSum],
        ["Total OK Parts", totalOkSum],
        ["Total NG Parts", totalNgSum],
        ["Overall Yield Rate", calculatedYield],
        ["System Mode", appMode === 'PROBLEMATIC' ? 'REJECTED/PROBLEMATIC DATA ONLY' : 'STANDARD DATA']
      ];

      const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
      wsOverview['!cols'] = [
        { wch: 25 },
        { wch: 40 }
      ];

      XLSX.utils.book_append_sheet(wb, wsOverview, "Report Summary");

      const runsHeader = [
        "Lot ID",
        "Date",
        "Model",
        "Barcode",
        "Total Qty",
        "OK Qty",
        "NG Qty",
        "NG1 (Critical)",
        "NG2 (Major)",
        "NG3 (Minor)",
        "Retest Qty",
        "Yield Rate",
        "NG %",
        "RST %",
        "Start Time",
        "End Time",
        "Processing Time",
        "Speed (pcs/min)"
      ];

      const runsRows = chartSessions.map(s => {
        let displayDate = '-';
        if (s.startTime && s.startTime !== '-') {
            const part = s.startTime.split(' ')[0];
            const dParts = part.split(/[-/]/);
            if (dParts.length === 3) {
                displayDate = `${dParts[2].padStart(2, '0')}-${dParts[1].padStart(2, '0')}-${dParts[0].slice(-2)}`;
            } else {
                displayDate = part;
            }
        }

        const totalTimeVal = calcTotalTimeValue(s.startTime, s.endTime);
        const totalTimeText = totalTimeVal >= 0 ? `${totalTimeVal} min` : '-';
        const startTimePart = s.startTime ? (s.startTime.split(' ')[1] || s.startTime) : '-';
        const endTimePart = s.endTime ? (s.endTime.split(' ')[1] || s.endTime) : '-';

        return [
          s.lotNumber || '-',
          displayDate,
          s.model || '-',
          s.barcodeNumber || '-',
          s.total || 0,
          s.okQty || 0,
          (s.ng1Qty || 0) + (s.ng2Qty || 0) + (s.ng3Qty || 0),
          s.ng1Qty || 0,
          s.ng2Qty || 0,
          s.ng3Qty || 0,
          s.retestQty || 0,
          s.yieldRate || '-',
          s.ngRate || '-',
          s.rstRate || '-',
          startTimePart,
          endTimePart,
          totalTimeText,
          s.speed || '-'
        ];
      });

      const wsRuns = XLSX.utils.aoa_to_sheet([runsHeader, ...runsRows]);
      wsRuns['!cols'] = [
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, wsRuns, "Production Runs");

      const defectsHeader = [
        "Lot ID",
        "Camera",
        "Item No",
        "Test Item",
        "NG Qty",
        "NG Rate (%)",
        "Lo Lim",
        "Hi Lim",
        "Unit",
        "NG Box"
      ];

      const defectsRows = normalizedActiveDefects.map(d => [
        d.lotNumber || '-',
        d.camera ? d.camera.replace(/^CAMERA\s*-\s*/gi, '').toUpperCase() : '-',
        d.no || 0,
        d.testItem || '-',
        d.ngQty || 0,
        d.ngRate || 0,
        d.loLim || '-',
        d.hiLim || '-',
        d.unit || '-',
        d.ngBox || '-'
      ]);

      const wsDefects = XLSX.utils.aoa_to_sheet([defectsHeader, ...defectsRows]);
      wsDefects['!cols'] = [
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 25 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, wsDefects, "Defects Log");

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      XLSX.writeFile(wb, `AOI_Quality_Report_${dateStr}.xlsx`);
    } catch (err) {
      console.error("Failed to export Excel report:", err);
      alert("Error exporting report to Excel: " + (err as Error).message);
    }
  };

  const handleTabChange = (tab: typeof activeTab) => {
     setActiveTab(tab);
     if (tab !== 'MATRIX') setHighlightedLot(undefined);
  };

  return (
    <div className="min-h-screen lg:h-screen bg-black text-zinc-100 p-3 md:p-6 font-sans selection:bg-zinc-800 flex flex-col overflow-y-auto lg:overflow-hidden">
      {showIngestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg shadow-2xl max-w-lg w-full flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-500 animate-pulse" />
                AOI Log Ingestion Wizard
              </h3>
              {ingestStatus !== 'PROCESSING' && (
                <button
                  onClick={() => setShowIngestModal(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-sm font-mono"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Step 1: CONFIRM */}
            {ingestStatus === 'CONFIRM' && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-950 border border-zinc-850 rounded">
                  <p className="text-zinc-400 text-xs uppercase tracking-wider font-mono mb-2">Selection Summary</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800 text-center">
                      <div className="text-xl font-mono font-bold text-zinc-200">{ingestStats.total}</div>
                      <div className="text-[10px] text-zinc-500 uppercase mt-1">Total Selected</div>
                    </div>
                    <div className="bg-zinc-900/50 p-3 rounded border border-emerald-950/40 text-center">
                      <div className="text-xl font-mono font-bold text-emerald-400">{ingestStats.toImportCount}</div>
                      <div className="text-[10px] text-zinc-500 uppercase mt-1">New to Import</div>
                    </div>
                    <div className="bg-zinc-900/50 p-3 rounded border border-amber-950/40 text-center">
                      <div className="text-xl font-mono font-bold text-amber-400">{ingestStats.duplicateCount}</div>
                      <div className="text-[10px] text-zinc-500 uppercase mt-1">Duplicate Skip</div>
                    </div>
                  </div>
                </div>

                {ingestStats.duplicateCount > 0 && (
                  <div className="p-3 bg-amber-950/15 border border-amber-900/30 rounded text-amber-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>
                      Detected {ingestStats.duplicateCount} file(s) that already exist in your local database. They will be skipped automatically to prevent duplication.
                    </span>
                  </div>
                )}

                {ingestStats.toImportCount === 0 ? (
                  <div className="p-3 bg-red-950/20 border border-red-900/30 rounded text-red-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <span>All selected files are already in the database. There are no new files to import.</span>
                  </div>
                ) : (
                  <p className="text-zinc-400 text-xs leading-relaxed text-left">
                    Click <strong>Start Import</strong> to parse and ingest these log files progressively. The page will remain fully responsive and show a live progress indicator.
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-2 font-mono text-xs">
                  <button
                    onClick={() => setShowIngestModal(false)}
                    className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  {ingestStats.toImportCount > 0 && (
                    <button
                      onClick={startIngestProcess}
                      className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      Start Import
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: PROCESSING */}
            {ingestStatus === 'PROCESSING' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    {isIngestCancelled ? 'Stopping...' : 'Ingesting files...'}
                  </span>
                  <span>
                    {ingestStats.processed} / {ingestStats.toImportCount} ({Math.round((ingestStats.processed / (ingestStats.toImportCount || 1)) * 100)}%)
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-zinc-950 border border-zinc-805 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-100 ease-out"
                    style={{ width: `${(ingestStats.processed / (ingestStats.toImportCount || 1)) * 100}%` }}
                  />
                </div>

                {/* Current Active File */}
                <div className="p-2.5 bg-zinc-950 border border-zinc-850 rounded text-[11px] font-mono text-zinc-400 truncate text-left" title={currentIngestFile}>
                  <span className="text-zinc-600 mr-1.5">Active:</span>
                  {currentIngestFile || 'Preparing...'}
                </div>

                {/* Sub Stats Counters */}
                <div className="grid grid-cols-3 gap-2 font-mono text-center text-xs">
                  <div className="bg-emerald-950/10 border border-emerald-900/20 py-2 rounded">
                    <span className="block text-emerald-400 font-bold text-sm">{ingestStats.success}</span>
                    <span className="text-[9px] text-zinc-500 uppercase mt-0.5 block">Success</span>
                  </div>
                  <div className="bg-amber-950/10 border border-amber-900/20 py-2 rounded">
                    <span className="block text-amber-400 font-bold text-sm">{ingestStats.warning}</span>
                    <span className="text-[9px] text-zinc-500 uppercase mt-0.5 block">Skipped</span>
                  </div>
                  <div className="bg-red-950/10 border border-red-900/20 py-2 rounded">
                    <span className="block text-red-400 font-bold text-sm">{ingestStats.error}</span>
                    <span className="text-[9px] text-zinc-500 uppercase mt-0.5 block">Rejected</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={cancelIngestProcess}
                    disabled={isIngestCancelled}
                    className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-750 text-red-400 hover:text-red-300 border border-red-900/20 font-mono text-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isIngestCancelled ? 'Stopping...' : 'Stop Import'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: COMPLETED */}
            {ingestStatus === 'COMPLETED' && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-950 border border-zinc-850 rounded flex flex-col items-center text-center">
                  <div className="p-2.5 bg-emerald-950/30 border border-emerald-900/30 rounded-full mb-3 text-emerald-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-100 mb-1">
                    {isIngestCancelled ? 'Import Stopped By User' : 'Import Complete!'}
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-xs leading-normal">
                    {isIngestCancelled 
                      ? 'Process was stopped. Some files were imported and database was updated successfully.' 
                      : 'All new files have been successfully processed, deduplicated, and integrated.'}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 font-mono text-center text-xs">
                  <div className="bg-zinc-900/60 border border-zinc-855 py-2 rounded">
                    <span className="block text-zinc-300 font-bold">{ingestStats.processed}</span>
                    <span className="text-[9px] text-zinc-500 uppercase mt-0.5 block">Processed</span>
                  </div>
                  <div className="bg-emerald-950/20 border border-emerald-900/30 py-2 rounded">
                    <span className="block text-emerald-400 font-bold">{ingestStats.success}</span>
                    <span className="text-[9px] text-zinc-500 uppercase mt-0.5 block">Success</span>
                  </div>
                  <div className="bg-amber-950/20 border border-amber-900/30 py-2 rounded">
                    <span className="block text-amber-400 font-bold">{ingestStats.warning}</span>
                    <span className="text-[9px] text-zinc-500 uppercase mt-0.5 block">Skipped</span>
                  </div>
                  <div className="bg-red-950/20 border border-red-900/30 py-2 rounded">
                    <span className="block text-red-400 font-bold">{ingestStats.error}</span>
                    <span className="text-[9px] text-zinc-500 uppercase mt-0.5 block">Rejected</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowIngestModal(false)}
                    className="w-full px-4 py-2.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-mono text-xs font-semibold transition-colors border border-zinc-700/50 cursor-pointer"
                  >
                    Close Ingestion Wizard
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg shadow-2xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Clear All Data
            </h3>
            <p className="text-zinc-400 text-sm mb-6">
              Are you sure you want to delete all database data? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 font-mono text-sm">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmClearData}
                className="px-4 py-2 rounded bg-red-900/50 hover:bg-red-600 text-red-100 border border-red-900/50 transition-colors"
              >
                Delete Data
              </button>
            </div>
          </div>
        </div>
      )}

      {showGithubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-400">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    Upgraded 6-side AOI - under test
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
                      Saved & Ready
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">Project saved as is, cloned, and prepared for GitHub repository</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGithubModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 overflow-y-auto font-sans">
              {/* Preserved status block */}
              <div className="p-4 rounded-lg bg-emerald-950/15 border border-emerald-900/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-emerald-300">Project State Preserved & Copied</div>
                  <div className="text-zinc-300 leading-relaxed">
                    The entire current project state has been saved and committed to Git on branch <code className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-emerald-300">main</code>. A complete copy is also archived and ready under the new project name: <strong>&ldquo;Upgraded 6-side AOI - under test&rdquo;</strong>.
                  </div>
                </div>
              </div>

              {/* Download ZIP Card */}
              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <Download className="w-4 h-4 text-blue-400" />
                    Download Complete Source Archive
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">.ZIP Archive</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Download the complete standalone codebase including all components, utilities, and build configs. You can directly drag and drop or upload this into any GitHub repository.
                </p>
                <a
                  href="/Upgraded-6-side-AOI-under-test.zip"
                  download="Upgraded-6-side-AOI-under-test.zip"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-blue-900/20"
                >
                  <Download className="w-4 h-4" />
                  Download Upgraded-6-side-AOI-under-test.zip
                </a>
              </div>

              {/* GitHub Push Instructions */}
              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-3">
                <div className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  Push to New GitHub Repository
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Target GitHub Repository Name: <strong className="text-purple-300">Upgraded 6-side AOI - under test</strong> (or <code className="px-1 bg-zinc-800 font-mono text-zinc-200">Upgraded-6-side-AOI-under-test</code>)
                </p>

                {/* Option A: Quick Automated Script */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
                    <span>Option 1: Quick Push Script (creates repo & pushes)</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('./push_to_github.sh <YOUR_GITHUB_USERNAME> <GITHUB_TOKEN>');
                        setCopiedCmd('script');
                        setTimeout(() => setCopiedCmd(null), 2000);
                      }}
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                    >
                      {copiedCmd === 'script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCmd === 'script' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                    ./push_to_github.sh &lt;YOUR_GITHUB_USERNAME&gt; &lt;GITHUB_PERSONAL_ACCESS_TOKEN&gt;
                  </pre>
                </div>

                {/* Option B: Standard Git Remote */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
                    <span>Option 2: Push via standard Git remote</span>
                    <button
                      onClick={() => {
                        const cmd = 'git remote add origin https://github.com/<YOUR_USERNAME>/Upgraded-6-side-AOI-under-test.git\ngit branch -M main\ngit push -u origin main';
                        navigator.clipboard.writeText(cmd);
                        setCopiedCmd('git');
                        setTimeout(() => setCopiedCmd(null), 2000);
                      }}
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                    >
                      {copiedCmd === 'git' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCmd === 'git' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto whitespace-pre">
{`git remote add origin https://github.com/<YOUR_USERNAME>/Upgraded-6-side-AOI-under-test.git
git branch -M main
git push -u origin main`}
                  </pre>
                </div>

                <div className="p-3 bg-purple-950/20 border border-purple-900/30 rounded text-purple-200 text-xs flex items-start gap-2 mt-2">
                  <ExternalLink className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
                  <span>
                    <strong>Direct Assistant Push:</strong> If you prefer, reply in this chat with your GitHub Personal Access Token or repository URL, and I will execute the push directly from the terminal for you!
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-6 py-3 border-t border-zinc-800 bg-zinc-950/60 font-mono text-xs">
              <button
                onClick={() => setShowGithubModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-full lg:h-full flex flex-col mx-auto space-y-6 min-h-0">
        
        {/* HEADER */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between border-b border-zinc-800 pb-3 md:pb-4 shrink-0 gap-3 md:gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-900 rounded border border-zinc-800 shrink-0">
              <Cpu className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-semibold tracking-tight text-zinc-100 text-left text-[15px] md:text-[20px] leading-snug md:leading-[28px]">ATV - 6-SIDE AOI for 1206/2010/1020</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-purple-950/70 border border-purple-800/80 text-purple-300">
                  <GitBranch className="w-3 h-3 text-purple-400" />
                  Upgraded 6-side AOI &bull; under test
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-zinc-500 uppercase tracking-widest font-mono text-[9px] md:text-[12px]">Statistical data of the total processed lots</p>
                <span className="text-zinc-650 font-mono text-[10px] hidden sm:inline">&bull;</span>
                <a 
                  href="https://github.com/dimagelberger/Upgraded-6-side-AOI-under-test" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-purple-400 hover:text-purple-300 font-mono text-[11px] flex items-center gap-1 hover:underline"
                  title="View on GitHub"
                >
                  <Github className="w-3 h-3" />
                  dimagelberger/Upgraded-6-side-AOI-under-test
                </a>
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full xl:w-auto">
            {sessions.length > 0 && (
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
                  <MultiSelect 
                    label="Model"
                    options={models}
                    selected={selectedModels}
                    onChange={setSelectedModels}
                  />
                  <MultiSelect 
                    label="Month"
                    options={availableMonths}
                    selected={selectedMonths}
                    onChange={setSelectedMonths}
                  />
                  <MultiSelect 
                    label="Week"
                    options={availableWeeks}
                    selected={selectedWeeks}
                    onChange={setSelectedWeeks}
                  />
                  <MultiSelect 
                    label="Date"
                    options={availableDates}
                    selected={selectedDates}
                    onChange={setSelectedDates}
                  />
                  {(selectedModels.length > 0 || selectedMonths.length > 0 || selectedWeeks.length > 0 || selectedDates.length > 0) && (
                      <button 
                         onClick={() => { setSelectedModels([]); setSelectedMonths([]); setSelectedWeeks([]); setSelectedDates([]); }}
                         className="px-3.5 py-1.5 bg-red-950/35 hover:bg-red-650 text-red-400 hover:text-white border border-red-900/40 rounded flex items-center justify-center transition-all cursor-pointer font-bold shrink-0 self-stretch sm:self-center text-xs"
                         title="Clear All Filters"
                      >
                         <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                         <span className="uppercase tracking-wider font-mono font-bold leading-none">Clear</span>
                      </button>
                  )}
                </div>
            )}
            
            <div className={`flex flex-wrap items-center gap-2 md:gap-3 ${sessions.length > 0 ? "lg:pl-4 lg:border-l lg:border-zinc-800" : ""}`}>
              <button 
                onClick={handleLoadData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 bg-zinc-900 border border-zinc-800 rounded hover:bg-zinc-800 transition-colors relative"
                title="Load Saved Data from IndexedDB"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-400" /> <span className="inline">Load DB</span>
                {saveStatus && <div className="absolute top-10 left-0 bg-blue-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">{saveStatus}</div>}
              </button>
              
              <UploadButton onFilesSelected={handleFilesSelected} />

              <QCUploadButton 
                onManualLoaded={(recs, filename) => {
                  setQcManualSessions(prev => {
                    const merged = [...prev, ...recs];
                    const unique = new Map<string, QCSessionRecord>();
                    merged.forEach(r => {
                      const key = `${r.lotNumber}|${r.dateStr}|${r.operator}|${r.result}`;
                      unique.set(key, r);
                    });
                    return Array.from(unique.values());
                  });
                  setQcManualFilename(prev => prev ? `${prev}, ${filename}` : filename);
                }} 
              />
              {qcManualSessions.length > 0 && (
                <button 
                  onClick={() => {
                    setQcAutoSessions([]);
                    setQcManualSessions([]);
                    setQcAutoFilename('');
                    setQcManualFilename('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-955/20 border border-rose-900/40 rounded hover:bg-rose-900/30 transition-colors"
                  title="Clear loaded QC data"
                >
                  <Trash2 className="w-3.5 h-3.5" /> <span className="inline">Clear QC</span>
                </button>
              )}

              {sessions.length > 0 && (
                <>
                  <button 
                    onClick={handleExportXLSX}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-400 bg-sky-950/20 border border-sky-900/30 rounded hover:bg-sky-950/40 transition-colors"
                    title="Export Current Filtered Report to XLSX"
                  >
                    <Download className="w-3.5 h-3.5" /> <span className="inline">Export Excel</span>
                  </button>

                  <button 
                    onClick={handleSaveData}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 rounded hover:bg-emerald-950/40 transition-colors"
                    title="Save State Offline"
                  >
                    <Save className="w-3.5 h-3.5" /> <span className="inline">Save DB</span>
                  </button>
                  
                  <button 
                    onClick={clearData}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-950/20 border border-red-900/30 rounded hover:bg-red-950/40 transition-colors"
                    title="Reset VM & Delete DB"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              
              <button 
                onClick={() => setAppMode(appMode === 'MAIN' ? 'PROBLEMATIC' : 'MAIN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded transition-colors ${appMode === 'PROBLEMATIC' ? 'bg-amber-900/40 text-amber-500 border-amber-800 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}
                title="Toggle Rejected/Problematic Data Logs"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> 
                <span>{appMode === 'PROBLEMATIC' ? 'REJECTED' : 'VIEW REJECTED'}</span>
              </button>

              <button 
                onClick={() => setShowLogsModal(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-zinc-350 bg-zinc-900 border border-zinc-800 rounded hover:bg-zinc-800 transition-colors"
                title="View Ingestion Logs"
              >
                <ScrollText className="w-3.5 h-3.5 text-indigo-400" /> Logs
              </button>

              <button 
                onClick={() => setShowGithubModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-purple-300 bg-purple-950/40 border border-purple-800/60 hover:bg-purple-900/50 rounded transition-colors shadow-sm cursor-pointer"
                title="GitHub Repository & Export Project"
              >
                <Github className="w-3.5 h-3.5 text-purple-400" />
                <span className="inline">GitHub / Export</span>
              </button>
            </div>
          </div>
        </div>

        {(sessions.length > 0 || qcAutoSessions.length > 0 || qcManualSessions.length > 0) && (
            <div className="grid grid-cols-5 bg-zinc-900/50 border border-zinc-800 rounded p-1 gap-1 selection:bg-transparent">
              <button 
                 onClick={() => handleTabChange('OVERVIEW')}
                 disabled={sessions.length === 0}
                 className={`flex flex-col md:flex-row items-center gap-1 md:gap-2.5 flex-1 justify-center py-2 md:py-2.5 text-[10px] sm:text-xs md:text-[13px] lg:text-sm rounded font-bold transition-colors ${activeTab === 'OVERVIEW' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'} ${sessions.length === 0 ? 'opacity-35 cursor-not-allowed text-zinc-655' : ''}`}
              >
                  <Gauge className="w-4 h-4 md:w-4.5 md:h-4.5 text-zinc-400" />
                  <span className="hidden sm:inline">Overview ({chartSessions.length})</span>
                  <span className="sm:hidden">Overview</span>
              </button>
              <button 
                 onClick={() => handleTabChange('RUNS')}
                 disabled={sessions.length === 0}
                 className={`flex flex-col md:flex-row items-center gap-1 md:gap-2.5 flex-1 justify-center py-2 md:py-2.5 text-[10px] sm:text-xs md:text-[13px] lg:text-sm rounded font-bold transition-colors ${activeTab === 'RUNS' ? 'bg-[#183c6c] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'} ${sessions.length === 0 ? 'opacity-35 cursor-not-allowed text-zinc-655' : ''}`}
              >
                  <List className="w-4 h-4 md:w-4.5 md:h-4.5 text-zinc-400" />
                  <span className="hidden sm:inline">Runs ({chartSessions.length})</span>
                  <span className="sm:hidden">Runs</span>
              </button>
              <button 
                 onClick={() => handleTabChange('MATRIX')}
                 disabled={sessions.length === 0}
                 className={`flex flex-col md:flex-row items-center gap-1 md:gap-2.5 flex-1 justify-center py-2 md:py-2.5 text-[10px] sm:text-xs md:text-[13px] lg:text-sm rounded font-bold transition-colors ${activeTab === 'MATRIX' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'} ${sessions.length === 0 ? 'opacity-35 cursor-not-allowed text-zinc-655' : ''}`}
              >
                  <Grid3X3 className="w-4 h-4 md:w-4.5 md:h-4.5 text-zinc-400" />
                  <span className="hidden sm:inline">Defect Matrix ({chartSessions.length})</span>
                  <span className="sm:hidden">Matrix</span>
              </button>
              <button 
                 onClick={() => handleTabChange('TOP_DEFECTS')}
                 disabled={sessions.length === 0}
                 className={`flex flex-col md:flex-row items-center gap-1 md:gap-2.5 flex-1 justify-center py-2 md:py-2.5 text-[10px] sm:text-xs md:text-[13px] lg:text-sm rounded font-bold transition-colors ${activeTab === 'TOP_DEFECTS' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'} ${sessions.length === 0 ? 'opacity-35 cursor-not-allowed text-zinc-655' : ''}`}
              >
                  <AlertTriangle className="w-4 h-4 md:w-4.5 md:h-4.5 text-zinc-400" />
                  <span className="hidden sm:inline">Top Defects ({chartSessions.length})</span>
                  <span className="sm:hidden">Defects</span>
              </button>
              <button 
                 onClick={() => handleTabChange('QC_SUMMARY')}
                 className={`flex flex-col md:flex-row items-center gap-1 md:gap-2.5 flex-1 justify-center py-2 md:py-2.5 text-[10px] sm:text-xs md:text-[13px] lg:text-sm rounded font-bold transition-colors ${activeTab === 'QC_SUMMARY' ? 'bg-zinc-805 text-teal-400 border border-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
              >
                  <GitCompare className="w-4 h-4 md:w-4.5 md:h-4.5 text-teal-500" />
                  <span className="hidden sm:inline">QC checks and results ({reconciledLotsCount})</span>
                  <span className="sm:hidden">QC checks and results</span>
              </button>
            </div>
        )}

        {/* Active Tab Content - Suspended during fast log ingestion to maximize DOM speed */}
        {showIngestModal ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-[#0b0e14]/50 border border-zinc-900 rounded-lg p-10 text-center animate-pulse">
            <Cpu className="w-12 h-12 text-emerald-500/80 mb-4 mx-auto animate-spin" style={{ animationDuration: '3s' }} />
            <h3 className="text-emerald-400 font-mono text-sm uppercase tracking-widest font-semibold">
              {ingestStatus === 'PROCESSING' ? 'Processing Ingestion Engine' : 'Preparing Ingestion Engine'}
            </h3>
            <p className="text-zinc-400 text-xs mt-2 max-w-md mx-auto font-sans leading-relaxed">
              Active database views and chart calculations are temporarily suspended to maximize ingestion performance and ensure butter-smooth rendering.
            </p>
          </div>
        ) : (
          <>
            {/* TOP ROW: Stats & Chart - Only in Overview */}
            {activeTab === 'OVERVIEW' && (
                <div className="flex-1 min-h-0 flex flex-col gap-6 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar pr-2 pb-6">
                    <div className="shrink-0">
                        <SystemStats 
                        totalProcessed={totalProcessed} 
                        totalOk={totalOk} 
                        totalNg={totalNg}
                        overallYield={aggregateYield} 
                        sessions={chartSessions}
                        selectedModels={selectedModels}
                        onModelSelect={(model) => setSelectedModels(prev => prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model])}
                        selectedMonths={selectedMonths}
                        onMonthSelect={(month) => setSelectedMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month])}
                        baseSessions={filteredSessions}
                        isFiltered={selectedModels.length > 0 || selectedMonths.length > 0 || selectedWeeks.length > 0 || selectedDates.length > 0}
                        />
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-2 min-h-[330px] sm:min-h-[440px] lg:min-h-0">
                       <div className="flex items-center gap-4 mb-2 shrink-0">
                         <h2 className="text-base font-medium text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                             Cumulative Yield Trend
                         </h2>
                         {selectedMonths.length > 0 && (
                            <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                              Month: {selectedMonths.join(', ')}
                            </span>
                         )}
                         {selectedWeeks.length > 0 && (
                            <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                              Week: {selectedWeeks.join(', ')}
                            </span>
                         )}
                         {selectedDates.length > 0 && (
                            <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                              Date: {selectedDates.join(', ')}
                            </span>
                         )}
                         {selectedModels.length > 0 && (
                            <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-blue-300">
                              Model: {selectedModels.join(', ')}
                            </span>
                         )}
                       </div>
                       <div className="flex-1 min-h-[280px] sm:min-h-[380px] lg:min-h-0 relative">
                         <LotYieldChart sessions={chartSessions} onLotDoubleClick={handleLotDoubleClick} />
                       </div>
                    </div>
                </div>
            )}

            {/* TOP DEFECTS TAB */}
            {activeTab === 'TOP_DEFECTS' && chartSessions.length > 0 && (
                <div className="flex-1 min-h-0 flex flex-col animate-in fade-in duration-300 overflow-y-auto custom-scrollbar pr-2 pb-6">
                   <div className="flex items-center gap-4 mb-4 shrink-0">
                      <h2 className="text-base font-medium text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                         <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                         Top Raw Defects
                      </h2>
                      {selectedModels.length > 0 && (
                        <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-amber-300">
                          Model: {selectedModels.join(', ')}
                        </span>
                      )}
                      {selectedMonths.length > 0 && (
                        <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                          Month: {selectedMonths.join(', ')}
                        </span>
                      )}
                      {selectedWeeks.length > 0 && (
                        <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                          Week: {selectedWeeks.join(', ')}
                        </span>
                      )}
                      {selectedDates.length > 0 && (
                        <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                          Date: {selectedDates.join(', ')}
                        </span>
                      )}
                      
                      <div className="inline-flex rounded-lg p-0.5 bg-zinc-950 border border-zinc-800 text-xs font-mono shrink-0 ml-auto sm:ml-0">
                        <button
                          onClick={() => setNormalizationMode('UNIVERSAL')}
                          className={`px-3 py-1.5 rounded transition-colors ${normalizationMode === 'UNIVERSAL' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
                          title="Universal: Combines whole-body features (Length, Width, Angle, Burs, Open Laser Cut) across cameras and symmetrical pairs"
                        >
                          Universal
                        </button>
                        <button
                          onClick={() => setNormalizationMode('NORMALIZED')}
                          className={`px-3 py-1.5 rounded transition-colors ${normalizationMode === 'NORMALIZED' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
                          title="Combined by Station: Combines co-triggers and redundant channels per station"
                        >
                          Combined (Station)
                        </button>
                        <button
                          onClick={() => setNormalizationMode('RAW')}
                          className={`px-3 py-1.5 rounded transition-colors ${normalizationMode === 'RAW' ? 'bg-zinc-800 text-zinc-100 font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                          title="Raw parameter trigger rows directly from CSV"
                        >
                          Raw Parameters
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Filter by Lot No..."
                          value={searchLotTopDefects}
                          onChange={(e) => setSearchLotTopDefects(e.target.value)}
                          className="pl-9 pr-8 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 w-[160px] sm:w-[200px]"
                        />
                        {searchLotTopDefects && (
                          <button 
                            onClick={() => setSearchLotTopDefects('')}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                   </div>
                   <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-4 md:gap-6">
                      <div className="flex-1 h-[340px] xl:h-auto bg-zinc-950/20 border border-zinc-900 shadow-[0_0_15px_rgba(0,0,0,0.2)] rounded overflow-hidden">
                          <DefectTable defects={topDefectsToRender} totalProcessed={totalProcessed} />
                      </div>
                      <div className="flex-1 h-[340px] xl:h-auto bg-zinc-950/20 border border-zinc-900 shadow-[0_0_15px_rgba(0,0,0,0.2)] rounded overflow-hidden">
                          <DefectParetoChart defects={topDefectsToRender} totalProcessed={totalProcessed} />
                      </div>
                   </div>
                </div>
            )}

            {/* RUN TRACKING LOG */}

            {activeTab === 'RUNS' && chartSessions.length > 0 && (
                <div className="flex-1 min-h-0 flex flex-col animate-in fade-in duration-300 overflow-y-auto custom-scrollbar pr-2 pb-6">
                  <div className="flex items-center gap-4 mb-4 shrink-0">
                    <h2 className="text-base font-medium text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                      Production Run Tracking Log
                    </h2>
                    {selectedModels.length > 0 && (
                      <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-amber-300">
                        Model: {selectedModels.join(', ')}
                      </span>
                    )}
                    {selectedMonths.length > 0 && (
                      <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                        Month: {selectedMonths.join(', ')}
                      </span>
                    )}
                    {selectedWeeks.length > 0 && (
                      <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                        Week: {selectedWeeks.join(', ')}
                      </span>
                    )}
                    {selectedDates.length > 0 && (
                      <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                        Date: {selectedDates.join(', ')}
                      </span>
                    )}
                  </div>
                  <SessionTable sessions={chartSessions} duplicateLots={reconciledData.duplicateLots} />
                </div>
            )}

            {/* DEFECT MATRIX */}
            {activeTab === 'MATRIX' && chartSessions.length > 0 && (
                <div className="flex-1 min-h-0 flex flex-col animate-in fade-in duration-300 overflow-y-auto custom-scrollbar pr-2 pb-6">
                  <div className="flex items-center gap-4 mb-4 shrink-0">
                    <h2 className="text-base font-medium text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                      Detailed Defect Matrix By Lot
                    </h2>
                    {selectedModels.length > 0 && (
                      <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-indigo-300">
                        Model: {selectedModels.join(', ')}
                      </span>
                    )}
                    {selectedMonths.length > 0 && (
                      <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                        Month: {selectedMonths.join(', ')}
                      </span>
                    )}
                    {selectedWeeks.length > 0 && (
                      <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                        Week: {selectedWeeks.join(', ')}
                      </span>
                    )}
                    {selectedDates.length > 0 && (
                      <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-emerald-300">
                        Date: {selectedDates.join(', ')}
                      </span>
                    )}
                  </div>
                  <DefectMatrix 
                    defects={stationActiveDefects.filter(d => chartSessions.some(cs => cs.lotNumber === d.lotNumber))} 
                    rawDefects={activeDefects.filter(d => chartSessions.some(cs => cs.lotNumber === d.lotNumber))}
                    universalDefects={universalActiveDefects.filter(d => chartSessions.some(cs => cs.lotNumber === d.lotNumber))}
                    sessions={chartSessions} 
                    highlightedLot={highlightedLot} 
                    onClearHighlight={() => setHighlightedLot(undefined)}
                  />
                </div>
            )}

            {/* COMPREHENSIVE RECONCILIATION QC SUMMARY TAB */}
            {activeTab === 'QC_SUMMARY' && (
                <QCSummaryTab
                  qcAutoSessions={qcAutoSessions}
                  qcManualSessions={qcManualSessions}
                  qcAutoFilename={qcAutoFilename}
                  qcManualFilename={qcManualFilename}
                  machineSessions={mainSessions}
                  filteredMachineSessions={chartSessions}
                  selectedMonths={selectedMonths}
                  selectedWeeks={selectedWeeks}
                  selectedDates={selectedDates}
                  onAutoLoaded={(recs, filename) => {
                    setQcAutoFilename(prev => {
                      const cleanedName = filename.trim();
                      const currentNames = prev ? prev.split(',').map(s => s.trim()) : [];
                      
                      if (currentNames.includes(cleanedName)) {
                        alert(`File "${cleanedName}" has already been uploaded. Skipping to prevent duplicate records.`);
                        return prev;
                      }

                      setQcAutoSessions(existingRecs => {
                        const filteredNewRecs = recs.filter(newRec => {
                          const isDuplicate = existingRecs.some(existing => 
                            existing.lotNumber === newRec.lotNumber &&
                            (existing.dateStr === newRec.dateStr || existing.dateVal === newRec.dateVal) &&
                            existing.operator === newRec.operator &&
                            existing.result === newRec.result
                          );
                          return !isDuplicate;
                        });
                        return [...existingRecs, ...filteredNewRecs];
                      });

                      return prev ? `${prev}, ${cleanedName}` : cleanedName;
                    });
                  }}
                   onManualLoaded={(recs, filename) => {
                    setQcManualFilename(prev => {
                      const cleanedName = filename.trim();
                      const currentNames = prev ? prev.split(',').map(s => s.trim()) : [];
                      
                      if (currentNames.includes(cleanedName)) {
                        alert(`File "${cleanedName}" has already been uploaded. Skipping to prevent duplicate records.`);
                        return prev;
                      }

                      setQcManualSessions(existingRecs => {
                        const filteredNewRecs = recs.filter(newRec => {
                          const isDuplicate = existingRecs.some(existing => 
                            existing.lotNumber === newRec.lotNumber &&
                            (existing.dateStr === newRec.dateStr || existing.dateVal === newRec.dateVal) &&
                            existing.operator === newRec.operator &&
                            existing.result === newRec.result
                          );
                          return !isDuplicate;
                        });
                        return [...existingRecs, ...filteredNewRecs];
                      });

                      return prev ? `${prev}, ${cleanedName}` : cleanedName;
                    });
                  }}
                  onClearQCData={() => {
                    setQcAutoSessions([]);
                    setQcManualSessions([]);
                    setQcAutoFilename('');
                    setQcManualFilename('');
                    if (isLoadedFromIdb) {
                      idbSet('aoi_qc_auto', []).catch(console.error);
                      idbSet('aoi_qc_manual', []).catch(console.error);
                      idbSet('aoi_qc_auto_name', '').catch(console.error);
                      idbSet('aoi_qc_manual_name', '').catch(console.error);
                    }
                  }}
                />
            )}
          </>
        )}



      </div>

      {showLogsModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0e14] border border-zinc-800 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-indigo-400" />
                Ingestion Logs
              </h3>
              <button 
                onClick={() => setShowLogsModal(false)}
                className="text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-700/50 p-2 rounded transition-colors"
                title="Close"
              >
                <div className="w-4 h-4 relative">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-current -translate-y-1/2 rotate-45"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-current -translate-y-1/2 -rotate-45"></div>
                </div>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar custom-scrollbar-horizontal">
              <IngestionLogList logs={ingestionLogs} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
