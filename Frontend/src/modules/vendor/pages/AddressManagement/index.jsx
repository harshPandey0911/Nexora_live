import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiSave, FiSearch, FiHome } from 'react-icons/fi';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-hot-toast';
import vendorService from '../../../../services/vendorService';
import LocationPicker from '../../../user/pages/Checkout/components/LocationPicker';

const libraries = ['places', 'geometry'];

const AddressManagement = () => {
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [autocomplete, setAutocomplete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries
  });

  useEffect(() => {
    const loadAddress = async () => {
      try {
        const response = await vendorService.getProfile();
        if (response.success && response.vendor?.address) {
          const addr = response.vendor.address;

          let displayAddress = '';
          let location = null;
          let houseNum = '';

          if (typeof addr === 'string') {
            displayAddress = addr;
          } else {
            houseNum = addr.addressLine1 || '';
            displayAddress = addr.fullAddress ||
              addr.address ||
              '';

            if (!displayAddress && addr.city) {
              displayAddress = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
            }

            if (addr.lat && addr.lng) {
              location = {
                lat: parseFloat(addr.lat),
                lng: parseFloat(addr.lng),
                address: displayAddress
              };
            }
          }

          setAddress(displayAddress);
          setSearchQuery(displayAddress);
          setHouseNumber(houseNum);
          if (location) {
            setSelectedLocation(location);
          }
        }
      } catch (error) {
        console.error('Error loading address:', error);
      }
    };
    loadAddress();
  }, []);

  useEffect(() => {
    return () => {
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach(container => {
        container.remove();
      });
    };
  }, []);

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setSearchQuery(location.address);
    setAddress(location.address);
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
        setAddress(place.formatted_address);
        setSearchQuery(place.formatted_address);
      }
    }
  };

  const onAutocompleteLoad = (autocompleteInstance) => {
    setAutocomplete(autocompleteInstance);
  };

  const handleSave = async () => {
    if (!address || !selectedLocation) {
      toast.error('Please select an address');
      return;
    }

    setLoading(true);

    let city = '';
    let state = '';
    let pincode = '';
    let addressLine2 = '';

    if (selectedLocation.components) {
      selectedLocation.components.forEach(comp => {
        if (comp.types.includes('locality')) city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
        if (comp.types.includes('postal_code')) pincode = comp.long_name;
        if (comp.types.includes('sublocality')) addressLine2 = comp.long_name;
      });
    }

    const addrData = {
      fullAddress: selectedLocation.address || address,
      addressLine1: houseNumber,
      addressLine2: addressLine2,
      city: city,
      state: state,
      pincode: pincode,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng
    };

    try {
      const response = await vendorService.updateProfile({
        address: addrData
      });

      if (response.success) {
        const vendorDataRaw = localStorage.getItem('vendorData');
        if (vendorDataRaw) {
          const vendor = JSON.parse(vendorDataRaw);
          const updatedVendor = { ...vendor, address: addrData };
          const finalVendor = response.vendor ? { ...vendor, ...response.vendor } : updatedVendor;
          localStorage.setItem('vendorData', JSON.stringify(finalVendor));
        } else if (response.vendor) {
          localStorage.setItem('vendorData', JSON.stringify(response.vendor));
        }

        window.dispatchEvent(new Event('vendorDataUpdated'));
        toast.success('Address saved successfully!');
      } else {
        toast.error(response.message || 'Failed to save address');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error(error.response?.data?.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Header Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors shrink-0 cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize truncate">
              Deployment Base Location
            </h2>
            <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5 truncate">
              Calibrate store address & GPS coordinates for dispatch accuracy
            </p>
          </div>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <FiMapPin className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <main className="space-y-3 sm:space-y-4 max-w-2xl mx-auto">
        {/* Info Card */}
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
            <FiMapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Geospatial Configuration</h3>
            <p className="text-[10px] font-medium text-gray-500 mt-0.5 leading-relaxed">
              Precise pin placement improves customer distance calculations and automatic order allocation efficiency.
            </p>
          </div>
        </div>

        {/* Map Section */}
        <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-2xs h-[280px] sm:h-[340px] relative">
          <LocationPicker
            onLocationSelect={handleLocationSelect}
            initialPosition={selectedLocation}
          />
        </div>

        {/* Form Inputs Container */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-2xs space-y-3.5">
          {/* Address Autocomplete */}
          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">
              Search Base Location (Street / Area) *
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
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search address or landmark..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder-gray-300"
                  />
                </div>
              </Autocomplete>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Synchronizing maps engine..."
                  disabled
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-400 animate-pulse"
                />
              </div>
            )}
          </div>

          {/* House Number / Shop Name */}
          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">
              Facility Identifier (Shop / Building / Flat)
            </label>
            <div className="relative">
              <FiHome className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="e.g. Shop #12, Apex Commercial Complex"
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder-gray-300"
              />
            </div>
          </div>

          {/* Coordinates Display */}
          {selectedLocation && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
              <p className="text-[10px] font-bold text-emerald-700 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>GPS: {selectedLocation.lat?.toFixed(6)}, {selectedLocation.lng?.toFixed(6)}</span>
              </p>
            </div>
          )}

          {/* Save Button */}
          <div className="pt-1">
            <button
              onClick={handleSave}
              disabled={!searchQuery || !selectedLocation || loading}
              className="w-full py-2.5 rounded-xl bg-[#00246b] hover:bg-[#001c54] text-white text-xs font-bold uppercase tracking-wider shadow-2xs active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  <span>Authorize Base Location</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AddressManagement;
