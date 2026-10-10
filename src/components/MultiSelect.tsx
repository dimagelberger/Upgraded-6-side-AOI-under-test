import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X, Square, CheckSquare } from 'lucide-react';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select Items',
  emptyLabel = 'No options available'
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = () => {
    onChange([...options]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="relative font-sans text-xs w-full sm:w-60" ref={containerRef}>
      {/* Target Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-zinc-850 hover:bg-zinc-800 text-zinc-100 border border-zinc-800 rounded px-3 py-2 text-left shadow-sm transition-all focus:outline-none focus:border-zinc-700 select-none cursor-pointer"
      >
        <div className="flex flex-col gap-0.5 min-w-0 pr-2">
          <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 font-mono block leading-none">
            {label}
          </span>
          <span className="truncate font-semibold text-zinc-200 text-xs mt-0.5">
            {selected.length === 0 ? `All ${label}s` : selected.length === 1 ? selected[0] : `${selected.length} Selected`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {selected.length > 0 && (
            <span className="flex items-center justify-center bg-blue-600 text-[10px] text-white font-bold px-1.5 py-0.5 rounded-full leading-none font-mono">
              {selected.length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Flyout Window */}
      {isOpen && (
        <div className="absolute left-0 mt-1 w-full min-w-[240px] bg-zinc-900 border border-zinc-850 rounded-lg shadow-2xl z-50 p-2 flex flex-col gap-2 max-h-72 select-none animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Action Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/85 pb-2 shrink-0">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-black">
              Multi-Select Options
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[10px] text-zinc-300 hover:text-white font-bold hover:underline"
              >
                All
              </button>
              <span className="text-zinc-750 font-mono">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[10px] text-red-400 hover:text-red-300 font-bold hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Options list selection block */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-0.5 custom-scrollbar max-h-52">
            {options.length === 0 ? (
              <div className="text-zinc-550 italic text-center py-4 font-mono">
                {emptyLabel}
              </div>
            ) : (
              options.map(option => {
                const isChecked = selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleOption(option)}
                    className={`w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded transition-all text-left group ${
                      isChecked 
                        ? 'bg-zinc-800/60 text-blue-400 font-semibold' 
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white font-medium'
                    }`}
                  >
                    <span className="truncate font-mono text-[11px]">{option}</span>
                    <div className="shrink-0">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-blue-500 fill-blue-500/10" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
