import React from 'react';
import { FiChevronDown } from 'react-icons/fi';

const LocationSelector = ({ location, onLocationClick }) => {
  const displayAddress = location && location !== 'Select Location' ? location : 'Select Location';

  return (
    <div 
      className="flex items-center gap-1.5 cursor-pointer"
      onClick={onLocationClick}
    >
      <span className="text-xs text-gray-700 truncate max-w-[200px] leading-tight text-right">
        {displayAddress}
      </span>
      <FiChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: '#F59E0B' }} />
    </div>
  );
};

export default LocationSelector;
