import React from 'react';
import { FiCalendar, FiDownload } from 'react-icons/fi';
import { CustomDateInput } from '../../../../components/common';

const TimePeriodFilter = ({ selectedPeriod, onPeriodChange, onExport, customDates, onCustomDateChange }) => {
  const periods = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left group: calendar + segmented control */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onPeriodChange(selectedPeriod === 'custom' ? 'month' : 'custom')}
            className={`h-10 w-10 rounded-xl border shadow-sm flex items-center justify-center transition-all ${
              selectedPeriod === 'custom'
                ? 'bg-primary-600 border-primary-600 text-white shadow-md scale-105'
                : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
            }`}
            aria-label="Custom Range"
          >
            <FiCalendar className="w-5 h-5" />
          </button>

          <div className="flex items-center bg-gray-100/80 backdrop-blur-sm rounded-2xl p-1.5 shadow-inner">
            {periods.map((p) => {
              const active = selectedPeriod === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onPeriodChange(p.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                    active
                      ? 'bg-white text-primary-700 shadow-md transform scale-100'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-white/40'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {selectedPeriod === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-primary-100 rounded-2xl p-1.5 px-4 shadow-sm animate-in fade-in slide-in-from-left-4 duration-500">
              <CustomDateInput
                value={customDates?.start || ''}
                max={customDates?.end || new Date().toISOString().split('T')[0]}
                onChange={(val) => onCustomDateChange({ ...customDates, start: val })}
                inputClassName="text-sm font-semibold text-gray-700 w-24 cursor-pointer"
              />
              <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">to</span>
              <CustomDateInput
                value={customDates?.end || ''}
                min={customDates?.start}
                max={new Date().toISOString().split('T')[0]}
                onChange={(val) => onCustomDateChange({ ...customDates, end: val })}
                inputClassName="text-sm font-semibold text-gray-700 w-24 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Right: Export */}
        <button
          type="button"
          onClick={onExport}
          className="h-10 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.95] transition-all whitespace-nowrap"
        >
          <FiDownload className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
};

export default TimePeriodFilter;


