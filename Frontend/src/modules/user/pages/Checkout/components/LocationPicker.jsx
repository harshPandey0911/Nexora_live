import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { FiCrosshair } from 'react-icons/fi';
import flutterBridge from '../../../../../utils/flutterBridge';
import { toast } from 'react-hot-toast';

const libraries = ['places', 'geometry'];

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 28.6139,
  lng: 77.2090
};

const LocationPicker = ({ onLocationSelect, initialPosition = null }) => {
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(initialPosition || defaultCenter);
  const [autocomplete, setAutocomplete] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = React.useRef(false);
  const [mapError, setMapError] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoaded) {
        setMapError(true);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  // Update marker when initialPosition changes (from external selection)
  useEffect(() => {
    if (initialPosition) {
      setMarker(initialPosition);
      if (map) {
        map.panTo(initialPosition);
        map.setZoom(15);
      }
    }
  }, [initialPosition, map]);

  // Get user's current location on mount
  useEffect(() => {
    if (!initialPosition && isLoaded) {
      handleCurrentLocation();
    }
  }, [isLoaded]);

  // Reverse geocode to get address from coordinates with Nominatim fallback
  const reverseGeocode = async (position) => {
    setLoading(true);

    // 1. Try Google Maps first if initialized
    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      try {
        const result = await new Promise((resolve, reject) => {
          geocoder.geocode({ location: position }, (results, status) => {
            if (status === 'OK' && results[0]) resolve(results[0]);
            else reject(status);
          });
        });

        if (result && onLocationSelect) {
          setLoading(false);
          onLocationSelect({
            lat: position.lat,
            lng: position.lng,
            address: result.formatted_address,
            components: result.address_components
          });
          return;
        }
      } catch (err) {
        console.warn("Google Geocoding failed, falling back to Nominatim:", err);
      }
    }

    // 2. Fallback to Nominatim (OpenStreetMap)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await response.json();

      if (data && data.display_name && onLocationSelect) {
        // Map Nominatim address components to a format similar to Google
        const components = [];
        if (data.address.city || data.address.town || data.address.village) 
          components.push({ long_name: data.address.city || data.address.town || data.address.village, types: ['locality'] });
        if (data.address.state) 
          components.push({ long_name: data.address.state, types: ['administrative_area_level_1'] });
        if (data.address.postcode) 
          components.push({ long_name: data.address.postcode, types: ['postal_code'] });
        if (data.address.suburb || data.address.neighbourhood) 
          components.push({ long_name: data.address.suburb || data.address.neighbourhood, types: ['sublocality'] });

        onLocationSelect({
          lat: position.lat,
          lng: position.lng,
          address: data.display_name,
          components: components
        });
      }
    } catch (err) {
      console.error("Nominatim Geocoding failed:", err);
      toast.error("Could not fetch address. Please enter manually.");
    } finally {
      setLoading(false);
    }
  };

  // Handle map click
  const onMapClick = useCallback((e) => {
    const newPos = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };
    setMarker(newPos);
    reverseGeocode(newPos);
  }, []);

  // Handle autocomplete place selection
  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const newPos = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        setMarker(newPos);
        if (map) {
          map.panTo(newPos);
          map.setZoom(15);
        }
        if (onLocationSelect) {
          onLocationSelect({
            lat: newPos.lat,
            lng: newPos.lng,
            address: place.formatted_address
          });
        }
      }
    }
  };

  // Handle current location button
  const handleCurrentLocation = async () => {
    setLoading(true);
    loadingRef.current = true;
    
    // Safety timer: If it takes more than 5 seconds, prompt user to check GPS
    const slowLocationTimer = setTimeout(() => {
      if (loadingRef.current) {
        window.dispatchEvent(new CustomEvent('requestLocationPrompt'));
        toast('Location taking too long. Please ensure GPS is ON.', { icon: '📍' });
      }
    }, 5000);

    try {
      const pos = await flutterBridge.getCurrentLocation();
      clearTimeout(slowLocationTimer);
      setLoading(false);
      loadingRef.current = false;
      
      const newPos = {
        lat: pos.latitude,
        lng: pos.longitude
      };
      
      setMarker(newPos);
      if (map) {
        map.panTo(newPos);
        map.setZoom(17);
      }
      reverseGeocode(newPos);
    } catch (error) {
      clearTimeout(slowLocationTimer);
      setLoading(false);
      loadingRef.current = false;
      console.error("Geolocation error:", error);
      
      // Trigger the specialized "Allow GPS" popup
      window.dispatchEvent(new CustomEvent('requestLocationPrompt'));
      
      let errorMessage = 'Unable to get location.';
      if (error.code === 1) errorMessage = 'Location permission denied.';
      else if (error.code === 2) errorMessage = 'GPS is turned off.';
      else if (error.code === 3) errorMessage = 'Location request timed out.';

      toast.error(`${errorMessage} Please select manually on the map.`);
    }
  };

  if (loadError || mapError) {
    return (
      <div className="h-[190px] bg-gray-50 flex flex-col items-center justify-center p-4 border border-dashed border-gray-200 text-center">
        <FiMapPin className="w-8 h-8 text-gray-300 mb-2" />
        <p className="text-xs font-semibold text-gray-500">Interactive Map Unavailable</p>
        <p className="text-[10px] text-gray-400 mt-1 leading-normal">
          Please enter your location details manually in the fields below.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-[190px] bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative h-[280px] bg-gray-200">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={marker}
          zoom={15}
          onClick={onMapClick}
          onLoad={setMap}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
            rotateControl: true,
            tiltControl: true,
            zoomControl: false
          }}
        >
          {marker && <Marker position={marker} />}
        </GoogleMap>



        {/* Locate Me Button */}
        <button
          onClick={handleCurrentLocation}
          className="absolute bottom-3 right-3 p-2 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all z-10"
        >
          <FiCrosshair className="w-5 h-5 text-gray-700" />
        </button>
      </div>
    </div>
  );
};

export default LocationPicker;
