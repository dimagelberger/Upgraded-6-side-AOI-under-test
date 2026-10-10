import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';

interface UploadButtonProps {
  onFilesSelected: (files: File[]) => void;
}

export function UploadButton({ onFilesSelected }: UploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  // Cleanup effect
  useEffect(() => {
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleFocus = () => {
    // When the window regains focus, the OS dialog has closed.
    // If the user selected thousands of files, the browser can take 10-30 seconds
    // to build the FileList object BEFORE the 'change' event fires.
    // We wait 15 seconds. If no files were selected, we assume cancel.
    setTimeout(() => {
      setIsPreparing(false);
    }, 15000);
    window.removeEventListener('focus', handleFocus);
  };

  const handleDirClick = () => {
    if (isPreparing) return;
    setIsPreparing(true);
    window.addEventListener('focus', handleFocus);
    dirInputRef.current?.click();
  };

  const handleFileClick = () => {
    if (isPreparing) return;
    setIsPreparing(true);
    window.addEventListener('focus', handleFocus);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    window.removeEventListener('focus', handleFocus);
    if (e.target.files && e.target.files.length > 0) {
      setIsPreparing(true);
      // Create a shallow copy of the FileList using Array.from asynchronously
      // to let the browser paint the "Preparing..." UI first.
      // This helps significantly when 2000+ files are selected via "Add Folder"
      // because building the array and passing to React can block the main thread.
      const files = e.target.files;
      setTimeout(() => {
        const fileArray = Array.from(files) as File[];
        onFilesSelected(fileArray);
        setIsPreparing(false);
        // Clear inputs inside a setTimeout to avoid sync layout trashing
        setTimeout(() => {
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (dirInputRef.current) dirInputRef.current.value = '';
        }, 100);
      }, 50);
    } else {
      setIsPreparing(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="file"
        accept=".csv,.txt"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <input
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        ref={dirInputRef}
        onChange={handleFileChange}
      />
      <button
        onClick={handleFileClick}
        disabled={isPreparing}
        className={`flex items-center gap-2 px-3.5 py-1.5 text-white text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${isPreparing ? 'bg-emerald-800 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer'}`}
        title="Add specific AOI .csv/.txt log files"
      >
        {isPreparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />} 
        <span className="inline">{isPreparing ? 'Scanning Files...' : 'Add Logs'}</span>
      </button>
      <button
        onClick={handleDirClick}
        disabled={isPreparing}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors ${isPreparing ? 'bg-emerald-900/50 border border-emerald-900 text-emerald-500 cursor-wait' : 'bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 cursor-pointer'}`}
        title="Upload a whole directory containing AOI logs"
      >
        {isPreparing ? <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />} 
        <span className="whitespace-nowrap">{isPreparing ? 'Scanning OS...' : 'Add Folder'}</span>
      </button>
    </div>
  );
}
