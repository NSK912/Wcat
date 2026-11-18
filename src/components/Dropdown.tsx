import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface DropdownProps {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  id,
  value,
  options,
  onChange,
  className = '',
  placeholder = 'Select option...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`} id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between bg-slate-900/90 text-violet-300 font-mono text-[11px] rounded-lg px-2.5 py-1.5 border transition-all duration-150 cursor-pointer shadow-inner select-none ${
          isOpen
            ? 'border-violet-500 ring-2 ring-violet-500/20 bg-slate-900 text-white'
            : 'border-slate-700/80 hover:border-violet-500/60 hover:bg-slate-850'
        }`}
      >
        <div className="flex items-center space-x-1.5 truncate">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-slate-400 ml-1.5 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-violet-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Panel (App Dark Glass Theme) */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-lg bg-slate-950/95 border border-violet-500/40 shadow-2xl backdrop-blur-xl py-1 overflow-y-auto max-h-56 divide-y divide-white/5">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`px-2.5 py-1.5 text-[11px] font-mono flex items-center justify-between cursor-pointer transition-colors duration-100 select-none ${
                  isSelected
                    ? 'bg-violet-600/25 text-violet-200 font-semibold'
                    : 'text-slate-300 hover:bg-violet-500/15 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-1.5 truncate">
                  {option.icon && <span className="shrink-0">{option.icon}</span>}
                  <span className="truncate">{option.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0 ml-1.5" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
