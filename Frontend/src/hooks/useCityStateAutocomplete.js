import { useState, useEffect } from 'react';

export const INDIAN_STATES_CITIES = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Tirupati", "Kurnool", "Rajahmundry", "Kakinada"],
  "Assam": ["Guwahati", "Dibrugarh", "Silchar", "Jorhat", "Nagaon", "Tinsukia"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Arrah", "Begusarai"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon"],
  "Delhi": ["New Delhi", "Noida", "Gurugram", "Dwarka", "Faridabad"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Jamnagar", "Junagadh"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Karnal", "Sonipat", "Rohtak", "Hisar"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi", "Hamirpur", "Bilaspur"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi", "Davangere", "Ballari", "Tumakuru"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Alappuzha", "Palakkad", "Kannur"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Navi Mumbai", "Solapur", "Kolhapur", "Amravati"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Sambalpur", "Puri", "Balasore", "Bhadrak"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Pathankot"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Alwar", "Bharatpur", "Sikar"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Vellore", "Erode", "Thoothukudi"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Khammam", "Karimnagar", "Ramagundam"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Noida", "Ghaziabad", "Agra", "Varanasi", "Prayagraj", "Meerut", "Bareilly", "Aligarh", "Moradabad"],
  "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "Siliguri", "Asansol", "Durgapur", "Kharagpur", "Bardhaman", "Malda"]
};

export const POPULAR_CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Surat", 
  "Pune", "Jaipur", "Lucknow", "Kanpur", "Indore", "Thane", "Bhopal", "Visakhapatnam", 
  "Patna", "Vadodara", "Ghaziabad", "Ludhiana", "Coimbatore", "Agra", "Madurai", "Nashik"
];

export const useCityStateAutocomplete = (cityValue, stateValue, setCityAndState) => {
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showStateSuggestions, setShowStateSuggestions] = useState(false);
  const [citiesData, setCitiesData] = useState([]);

  useEffect(() => {
    const loadCitiesData = async () => {
      try {
        const cached = localStorage.getItem('indian_cities_data');
        if (cached) {
          setCitiesData(JSON.parse(cached));
          return;
        }
        const response = await fetch('https://raw.githubusercontent.com/nshntarora/Indian-Cities-JSON/master/cities.json');
        if (response.ok) {
          const data = await response.json();
          setCitiesData(data);
          localStorage.setItem('indian_cities_data', JSON.stringify(data));
        }
      } catch (err) {
        console.error('Failed to fetch cities data', err);
      }
    };
    loadCitiesData();
  }, []);

  const getFilteredData = () => {
    if (citiesData && citiesData.length > 0) {
      const uniqueStates = Array.from(new Set(citiesData.map(item => item.state))).sort();
      const filteredStates = uniqueStates.filter(st => 
        st.toLowerCase().includes((stateValue || '').toLowerCase())
      );
      
      let filteredCities = [];
      if (stateValue) {
        filteredCities = citiesData
          .filter(item => item.state.toLowerCase() === stateValue.toLowerCase())
          .map(item => item.name)
          .filter(name => name.toLowerCase().includes((cityValue || '').toLowerCase()));
      } else {
        filteredCities = citiesData
          .map(item => item.name)
          .filter(name => name.toLowerCase().includes((cityValue || '').toLowerCase()))
          .slice(0, 30);
      }
      return { filteredStates, filteredCities, isDynamic: true };
    } else {
      const filteredStates = Object.keys(INDIAN_STATES_CITIES).filter(st => 
        st.toLowerCase().includes((stateValue || '').toLowerCase())
      );
      let filteredCities = [];
      if (stateValue) {
        const stateCities = INDIAN_STATES_CITIES[stateValue];
        if (stateCities) {
          filteredCities = stateCities.filter(ct => 
            ct.toLowerCase().includes((cityValue || '').toLowerCase())
          );
        }
      } else {
        filteredCities = POPULAR_CITIES.filter(ct => 
          ct.toLowerCase().includes((cityValue || '').toLowerCase())
        );
      }
      return { filteredStates, filteredCities, isDynamic: false };
    }
  };

  const { filteredStates, filteredCities, isDynamic } = getFilteredData();

  const handleCityChange = (val) => {
    let updatedState = stateValue;
    if (updatedState) {
      let hasMatchInState = false;
      if (citiesData && citiesData.length > 0) {
        hasMatchInState = citiesData.some(item => 
          item.state.toLowerCase() === updatedState.toLowerCase() &&
          item.name.toLowerCase().startsWith(val.toLowerCase())
        );
      } else {
        const stateCities = INDIAN_STATES_CITIES[updatedState];
        if (stateCities) {
          hasMatchInState = stateCities.some(c => 
            c.toLowerCase().startsWith(val.toLowerCase())
          );
        }
      }
      if (!hasMatchInState) {
        updatedState = '';
      }
    }
    setCityAndState(val, updatedState);
    setShowCitySuggestions(true);
  };

  const handleStateChange = (val) => {
    setCityAndState(cityValue, val);
    setShowStateSuggestions(true);
  };

  const handleSelectCity = (city) => {
    let stateName = stateValue;
    if (isDynamic) {
      const matched = citiesData.find(item => item.name.toLowerCase() === city.toLowerCase());
      if (matched) stateName = matched.state;
    } else {
      for (const [st, list] of Object.entries(INDIAN_STATES_CITIES)) {
        if (list.some(c => c.toLowerCase() === city.toLowerCase())) {
          stateName = st;
          break;
        }
      }
    }
    setCityAndState(city, stateName);
    setShowCitySuggestions(false);
  };

  const handleSelectState = (stateName) => {
    setCityAndState(cityValue, stateName);
    setShowStateSuggestions(false);
  };

  const handleCityBlur = () => {
    setTimeout(() => {
      setShowCitySuggestions(false);
      const cityName = (cityValue || '').trim();
      if (!cityName) return;

      let resolvedState = '';
      if (isDynamic && citiesData && citiesData.length > 0) {
        const matched = citiesData.find(item => item.name.toLowerCase() === cityName.toLowerCase());
        if (matched) resolvedState = matched.state;
      } else {
        for (const [st, list] of Object.entries(INDIAN_STATES_CITIES)) {
          if (list.some(c => c.toLowerCase() === cityName.toLowerCase())) {
            resolvedState = st;
            break;
          }
        }
      }

      if (resolvedState && resolvedState.toLowerCase() !== (stateValue || '').trim().toLowerCase()) {
        setCityAndState(cityName, resolvedState);
      }
    }, 200);
  };

  const validateCity = (cityName) => {
    let isValidCity = false;
    let resolvedState = '';

    if (citiesData && citiesData.length > 0) {
      const matched = citiesData.find(item => item.name.toLowerCase() === cityName.trim().toLowerCase());
      if (matched) {
        isValidCity = true;
        resolvedState = matched.state;
      }
    } else {
      for (const [st, list] of Object.entries(INDIAN_STATES_CITIES)) {
        if (list.some(c => c.toLowerCase() === cityName.trim().toLowerCase())) {
          isValidCity = true;
          resolvedState = st;
          break;
        }
      }
    }

    return { isValidCity, resolvedState };
  };

  return {
    showCitySuggestions,
    setShowCitySuggestions,
    showStateSuggestions,
    setShowStateSuggestions,
    filteredCities,
    filteredStates,
    handleCityChange,
    handleStateChange,
    handleSelectCity,
    handleSelectState,
    handleCityBlur,
    validateCity
  };
};
