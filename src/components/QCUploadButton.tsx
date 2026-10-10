import React, { useRef, useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseRawRowsToRecords } from './QCSummaryTab';
import { QCSessionRecord } from './QCSummaryTab';

interface QCUploadButtonProps {
  onManualLoaded: (records: QCSessionRecord[], filename: string) => void;
}

export function QCUploadButton({ onManualLoaded }: QCUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processQCExcelFile = (file: File) => {
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          alert('No printable worksheet found in ' + file.name);
          setIsProcessing(false);
          return;
        }

        const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        if (rawRows.length === 0) {
          alert('The worksheet has no data: ' + file.name);
          setIsProcessing(false);
          return;
        }

        const parsedRecords = parseRawRowsToRecords(rawRows, file.name);
        if (parsedRecords.length === 0) {
          alert(`Could not parse lot numbers. Make sure file "${file.name}" has columns like "Lot Number", "LOT", "批号", or similar.`);
          setIsProcessing(false);
          return;
        }

        onManualLoaded(parsedRecords, file.name);
      } catch (err: any) {
        alert(`Parsing failed: ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      alert("Error reading file.");
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Just process the first selected file
      processQCExcelFile(files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = ''; // Reset
  };

  return (
    <div className="flex gap-2">
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <button
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        disabled={isProcessing}
        className="flex items-center gap-2 px-4 py-2 bg-amber-600/90 hover:bg-amber-500 text-amber-50 text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> ...
          </>
        ) : (
          <>
            <UploadCloud className="w-4 h-4" /> Add QC File
          </>
        )}
      </button>
    </div>
  );
}
