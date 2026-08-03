import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiX, FiSearch, FiMapPin, FiHome } from 'react-icons/fi';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { themeColors } from '../../../../../theme';
import LocationPicker from './LocationPicker';

const libraries = ['places', 'geometry'];

const AddressSelectionModal = ({ 
  isOpen, 
  onClose, 
  address = '', 
  houseNumber = '', 
  city: initialCity = '',
  state: initialState = '',
  pincode: initialPincode = '',
  onHouseNumberChange, 
  onSave 
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapAddress, setMapAddress] = useState(address || '');
  const [searchQuery, setSearchQuery] = useState(address || '');
  const [autocomplete, setAutocomplete] = useState(null);
  const [city, setCity] = useState(initialCity || '');
  const [stateName, setStateName] = useState(initialState || '');
  const [pincode, setPincode] = useState(initialPincode || '');

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      setMapAddress(address || '');
      setSearchQuery(address || '');
      setCity(initialCity || '');
      setStateName(initialState || '');
      setPincode(initialPincode || '');
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      setIsClosing(false);

      // Clean up google autocomplete container when closing
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach(container => {
        container.remove();
      });
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';

      // Clean up google autocomplete container when unmounting
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach(container => {
        container.remove();
      });
    };
  }, [isOpen, address, initialCity, initialState, initialPincode]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setMapAddress(location.address);
    setSearchQuery(location.address);
    if (location.components) {
      location.components.forEach(comp => {
        if (comp.types.includes('locality')) setCity(comp.long_name);
        if (comp.types.includes('administrative_area_level_1')) setStateName(comp.long_name);
        if (comp.types.includes('postal_code')) setPincode(comp.long_name);
      });
    }
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address,
          components: place.address_components
        };
        setSelectedLocation(location);
        setMapAddress(place.formatted_address);
        setSearchQuery(place.formatted_address);
        if (place.address_components) {
          place.address_components.forEach(comp => {
            if (comp.types.includes('locality')) setCity(comp.long_name);
            if (comp.types.includes('administrative_area_level_1')) setStateName(comp.long_name);
            if (comp.types.includes('postal_code')) setPincode(comp.long_name);
          });
        }
      }
    }
  };

  const handleSave = () => {
    const components = [
      { long_name: city, types: ['locality'] },
      { long_name: stateName, types: ['administrative_area_level_1'] },
      { long_name: pincode, types: ['postal_code'] }
    ];
    const locationToSave = {
      ...(selectedLocation || {}),
      address: mapAddress || searchQuery,
      components: components
    };
    const addressToPass = (houseNumber && houseNumber.length > 5) ? houseNumber : (mapAddress || searchQuery || houseNumber);
    onSave(addressToPass, locationToSave);
  };

  const onAutocompleteLoad = (autocompleteInstance) => {
    setAutocomplete(autocompleteInstance);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center sm:items-start justify-center p-4 sm:pt-24">
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity ${isClosing ? 'opacity-0' : 'opacity-100'}`}
        onClick={handleClose}
      />
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full sm:max-w-md h-auto max-h-[95vh] relative z-10 ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '1px solid rgba(0,0,0,0.05)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-2.5 z-10 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
              <FiArrowLeft className="w-5 h-5 text-black" />
            </button>
            <div>
              <h1 className="text-base font-bold text-black leading-tight">Confirm Location</h1>
              <p className="text-[10px] text-gray-500 font-medium">Pinpoint coordinates accurately on the map</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <FiX className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Map Section */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="rounded-xl overflow-hidden shadow-sm border border-gray-100">
            <LocationPicker
              onLocationSelect={handleLocationSelect}
              initialPosition={selectedLocation}
            />
          </div>
        </div>

        {/* Address Details - Form Fields */}
        <div className="px-4 py-2 overflow-y-auto flex-1 scrollbar-hide">
          {/* Address Search */}
          <div className="mb-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
              Pinpoint your Address
            </label>
            {isLoaded ? (
              <Autocomplete
                onLoad={onAutocompleteLoad}
                onPlaceChanged={onPlaceChanged}
                options={{
                  componentRestrictions: { country: 'in' },
                  fields: ['formatted_address', 'geometry', 'name', 'address_components']
                }}
              >
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                  <input
                    type="text"
                    placeholder="Search for area, street name..."
                    value={searchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      setMapAddress(val);
                    }}
                    className="w-full pl-9 pr-10 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-1 focus:ring-primary-500 transition-all font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setMapAddress('');
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-all z-20"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Autocomplete>
            ) : (
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                <input
                  type="text"
                  placeholder="Enter location / address manually..."
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    setMapAddress(val);
                  }}
                  className="w-full pl-9 pr-10 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-1 focus:ring-primary-500 transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setMapAddress('');
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-all z-20"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* House/Flat Number */}
          <div className="mb-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
              House / Flat / Office No. (Optional)
            </label>
            <div className="relative">
              <FiHome className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
              <input
                type="text"
                placeholder="e.g. Flat 101, Nexora Tower"
                value={houseNumber}
                onChange={(e) => onHouseNumberChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-1 focus:ring-primary-500 transition-all font-medium"
              />
            </div>
          </div>

          {/* City, State, Pincode fields */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                City
              </label>
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-xs focus:ring-1 focus:ring-primary-500 transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                State
              </label>
              <input
                type="text"
                placeholder="State"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-xs focus:ring-1 focus:ring-primary-500 transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                Pincode
              </label>
              <input
                type="text"
                placeholder="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-xs focus:ring-1 focus:ring-primary-500 transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* Fixed Footer with Save Button */}
        <div className="px-4 pb-4 pt-2 shrink-0 bg-white border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={!mapAddress}
            className="w-full py-3 rounded-xl font-black text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl uppercase tracking-wider text-xs"
            style={{
              backgroundColor: themeColors.button,
              boxShadow: `0 8px 16px ${themeColors.button}30`
            }}
          >
            Verify & Save Address
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressSelectionModal;
