import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiSave, FiSearch, FiHome } from 'react-icons/fi';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../../theme';
import vendorService from '../../../../services/vendorService';
import LocationPicker from '../../../user/pages/Checkout/components/LocationPicker';

const libraries = ['places', 'geometry'];

const AddressManagement = () => {
  const navigate = useNavigate();
  const [address, setAddress] = useState(''); // Display address
  const [houseNumber, setHouseNumber] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null); // { lat, lng, address, components... }
  const [autocomplete, setAutocomplete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries
  });

  // Load saved address from backend
  useEffect(() => {
    const loadAddress = async () => {
      try {
        const response = await vendorService.getProfile();
        // Check if response has vendor data
        if (response.success && response.vendor?.address) {
          const addr = response.vendor.address;

          let displayAddress = '';
          let location = null;
          let houseNum = '';

          if (typeof addr === 'string') {
            displayAddress = addr;
          } else {
            // It's an object
            houseNum = addr.addressLine1 || '';
            displayAddress = addr.fullAddress ||
              addr.address ||
              '';

            // If we have city/pincode but no fullAddress, try to construct
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
      // Clean up google autocomplete container when page unmounts
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach(container => {
        container.remove();
      });
    };
  }, []);

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    // setAddress(location.address); 
    // Usually user selects from map -> we update search query & address field
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

    // Prepare full address object similar to `AddressSelectionModal`
    let city = '';
    let state = '';
    let pincode = '';
    let addressLine2 = '';

    // If we have components from Google API (either via map click or autocomplete)
    if (selectedLocation.components) {
      selectedLocation.components.forEach(comp => {
        if (comp.types.includes('locality')) city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
        if (comp.types.includes('postal_code')) pincode = comp.long_name;
        if (comp.types.includes('sublocality')) addressLine2 = comp.long_name;
      });
    }

    // We can also re-use existing logic from updateProfile controller which expects an object
    // consistent with what EditProfile sends.
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
        // Update localStorage vendorData
        const vendorDataRaw = localStorage.getItem('vendorData');
        if (vendorDataRaw) {
          const vendor = JSON.parse(vendorDataRaw);
          const updatedVendor = { ...vendor, address: addrData };
          const finalVendor = response.vendor ? { ...vendor, ...response.vendor } : updatedVendor;
          localStorage.setItem('vendorData', JSON.stringify(finalVendor));
        } else if (response.vendor) {
          localStorage.setItem('vendorData', JSON.stringify(response.vendor));
        }

        // Dispatch event to notify other components
        window.dispatchEvent(new Event('vendorDataUpdated'));

        toast.success('Address saved successfully!');
        setTimeout(() => {
          //   navigate('/vendor/profile'); // Stay here or go back settings? User preference.
          //   Let's just show success. Or maybe go back.
        }, 500);
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
    <div className="min-h-screen pb-20 relative">
      {/* Premium Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gray-50" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 border-b border-gray-100 px-6 lg:px-10 py-4 lg:py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/vendor/profile')}
            className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:text-blue-600 transition-all active:scale-95"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Deployment Base</h1>
            <p className="text-xs text-gray-400 font-medium hidden sm:block">Manage your operational address & coordinates</p>
          </div>
        </div>
        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <FiMapPin className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
        </div>
      </header>

      <main className="px-10 pt-10 relative z-10 max-w-[1600px] mx-auto">
        {/* Info Card */}
        <div className="bg-white rounded-[32px] p-6 mb-10 border border-gray-100 relative overflow-hidden group shadow-sm">
          <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-start gap-5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <FiMapPin className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="text-gray-900 font-medium text-sm capitalize tracking-widest mb-1">Geospatial Configuration</h3>
              <p className="text-[10px] font-medium text-gray-500 capitalize tracking-widest leading-relaxed">
                Calibrate your operational base coordinates. Precise positioning ensures optimal job matching and dispatch accuracy.
              </p>
            </div>
          </div>
        </div>

        {/* Map Section */}
        {/* Map Section */}
        <div className="bg-white/5 rounded-[48px] overflow-hidden mb-10 border border-white/10 shadow-2xl h-[400px]">
          <LocationPicker
            onLocationSelect={handleLocationSelect}
            initialPosition={selectedLocation}
          />
        </div>

        {/* Form Inputs Container */}
        {/* Form Inputs Container */}
        <div className="bg-white rounded-[48px] p-10 border border-gray-100 space-y-8 shadow-sm">

          {/* Address Autocomplete */}
          <div className="space-y-3">
            <label className="text-[10px] font-medium text-gray-500 capitalize tracking-[0.3em] ml-2">
              Primary Access Coordinates (Street/Area)
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
                  <FiSearch className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-300 w-6 h-6 z-10" />
                  <input
                    type="text"
                    placeholder="ENTER OPERATIONAL VECTOR..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-[28px] pl-16 pr-8 py-5 text-sm text-gray-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all capitalize tracking-widest placeholder:text-gray-200"
                  />
                </div>
              </Autocomplete>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="SYNCHRONIZING MAPS..."
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-[28px] pl-8 py-5 text-sm text-gray-800 animate-pulse"
                />
              </div>
            )}
          </div>

          {/* House Number */}
          <div className="space-y-3">
            <label className="text-[10px] font-medium text-gray-500 capitalize tracking-[0.3em] ml-2">
              Facility Identifier (Shop/Building)
            </label>
            <div className="relative">
              <FiHome className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-300 w-6 h-6" />
              <input
                type="text"
                placeholder="e.g. FACILITY 101, HUB B"
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-[28px] pl-16 pr-8 py-5 text-sm text-gray-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all capitalize tracking-widest placeholder:text-gray-200"
              />
            </div>
          </div>

          {/* Coordinates Display */}
          {selectedLocation && (
            <p className="text-[9px] font-medium text-gray-700 capitalize tracking-widest text-center">
              Global Position: {selectedLocation.lat?.toFixed(6)} / {selectedLocation.lng?.toFixed(6)}
            </p>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!searchQuery || !selectedLocation || loading}
            className="w-full py-6 rounded-[28px] bg-blue-600 text-white text-[12px] font-medium capitalize tracking-[0.4em] shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-20 transition-all flex items-center justify-center gap-4"
          >
            <FiSave className="w-5 h-5" />
            {loading ? 'AUTHORIZING...' : 'AUTHORIZE LOCATION'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default AddressManagement;
