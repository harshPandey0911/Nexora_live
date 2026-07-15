import React, { useRef } from 'react';
import { FiCalendar } from 'react-icons/fi';

const isoToDisplay = (iso) => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const CustomDateInput = ({ value, onChange, max, min, placeholder, className, inputClassName, showIcon = true }) => {
  const nativeRef = useRef(null);

  const handleTextChange = (e) => {
    const raw = e.target.value.replace(/[^0-9/]/g, '');
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, d, m, y] = match;
      const parsed = new Date(`${y}-${m}-${d}`);
      if (!isNaN(parsed.getTime())) {
        onChange(`${y}-${m}-${d}`);
      }
    } else if (!raw) {
      onChange('');
    }
  };

  return (
    <span className={`relative inline-flex items-center gap-1 ${className || ''}`}>
      <input
        key={value}
        type="text"
        defaultValue={isoToDisplay(value)}
        onChange={handleTextChange}
        onClick={() => nativeRef.current?.showPicker?.()}
        placeholder={placeholder || 'dd/mm/yyyy'}
        maxLength={10}
        className={`bg-transparent focus:outline-none placeholder:text-gray-400 cursor-pointer ${inputClassName || 'text-[11px] text-gray-600 w-[76px]'}`}
      />
      {showIcon && (
        <button
          type="button"
          onClick={() => nativeRef.current?.showPicker?.()}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Open calendar"
        >
          <FiCalendar className="w-3.5 h-3.5" />
        </button>
      )}
      <input
        ref={nativeRef}
        type="date"
        defaultValue={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
        aria-hidden="true"
      />
    </span>
  );
};

export default CustomDateInput;
