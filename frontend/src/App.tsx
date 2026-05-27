import { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Mail,
  Lock,
  User,
  ArrowRight,
  Heart,
  LogOut,
  Clock,
  Navigation,
  Search,
  Calendar,
  Menu,
  X,
  MapPin,
} from 'lucide-react';
import L from 'leaflet';
import { MapView } from './components/Map';
import { geocodeLocation, autocompleteLocation } from './providers/geoapify/geocode';
import type { Carpark, DestinationPoint, AppState } from './types';
import { getWeatherByIP, getWeatherForCoords, getIconForWeather } from './providers/govsg';

const MOCK_RESULTS: Carpark[] = [
  {
    id: 1,
    name: 'Century Square',
    price: 3.95,
    walkTime: 3,
    lots: 298,
    type: 'Flat Rate',
    lat: 1.352,
    lng: 103.944,
    weekday: '$3.95 / entry',
    weekend: '$3.95 / entry',
  },
  {
    id: 2,
    name: 'Tampines Plaza 1 & 2',
    price: 4.0,
    walkTime: 3,
    lots: 166,
    type: 'Hourly',
    lat: 1.353,
    lng: 103.945,
    weekday: '$2.00 / 1st hr, $1.00 sub. 30min',
    weekend: '$2.50 / hr',
  },
  {
    id: 3,
    name: 'NTUC Income Tampines',
    price: 4.0,
    walkTime: 4,
    lots: 86,
    type: 'Hourly',
    lat: 1.351,
    lng: 103.943,
    weekday: '$2.00 / hr',
    weekend: '$2.00 / hr',
  },
];

export default function GoParkApp() {
  const [appState, setAppState] = useState<AppState>('login');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCarparkId, setSelectedCarparkId] = useState<number | null>(null);
  const [destination, setDestination] = useState('');
  const [results, setResults] = useState<Carpark[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [destinationPoint, setDestinationPoint] = useState<DestinationPoint | null>(null);
  const [favorites, setFavorites] = useState<Carpark[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationShared, setLocationShared] = useState(false);
  const [showLocationTooltip, setShowLocationTooltip] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const markerRefs = useRef<Record<number, L.Marker>>({});
  const [weather, setWeather] = useState<string>('Loading...');
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getWeatherByIP().then(({ forecast }) => setWeather(forecast));
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowLocationTooltip(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const shareLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        setLocationShared(true);
        setShowLocationTooltip(false);
        getWeatherForCoords(coords[0], coords[1]).then(setWeather);
      },
      () => setShowLocationTooltip(false)
    );
  };

  const WeatherIcon = getIconForWeather(weather);

  useEffect(() => {
    if (selectedCarparkId && markerRefs.current[selectedCarparkId]) {
      markerRefs.current[selectedCarparkId].openPopup();
    }
  }, [selectedCarparkId]);

  const handleDestinationChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);
    
    if (val.length > 2) {
      const suggs = await autocompleteLocation(val);
      setSuggestions(suggs);
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  };

  const executeSearch = async (searchQuery: string) => {
    try {
      const place = await geocodeLocation(searchQuery);
      setDestinationPoint({
        name: place.name || searchQuery,
        formatted: place.formatted,
        lat: place.lat,
        lng: place.lon,
      });
      
      const res = await fetch(`/api/govsg/carparks?lat=${place.lat}&lng=${place.lon}`);
      
      if (res.ok) {
        const liveCarparks = await res.json();
        setResults(liveCarparks.slice(0, 10)); 
      } else {
        setResults(MOCK_RESULTS);
      }

      setHasSearched(true);
      setSelectedCarparkId(null);
      setIsDropdownOpen(false);
    } catch {
      alert('Could not find destination');
    }
  };

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await executeSearch(destination);
  };

  const selectSuggestion = (sugg: any) => {
    const placeName = sugg.formatted || sugg.name || destination;
    setDestination(placeName);
    setIsDropdownOpen(false);
    executeSearch(placeName); 
  };

  const toggleFavorite = (e: React.MouseEvent, carpark: Carpark) => {
    e.stopPropagation();
    if (appState === 'guest') {
      alert('Please log in to save your favorite parking spots!');
      return;
    }
    const isAlreadyFav = favorites.some((fav) => fav.id === carpark.id);
    if (isAlreadyFav) {
      setFavorites(favorites.filter((fav) => fav.id !== carpark.id));
    } else {
      setFavorites([...favorites, carpark]);
    }
  };

  if (appState === 'login') {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 font-sans">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-black text-white italic tracking-tight flex items-center justify-center gap-1 uppercase drop-shadow-lg leading-none">
            GoPark <Zap className="text-yellow-400 fill-yellow-400 h-10 w-10" />
          </h1>
          <p className="text-yellow-400 font-bold tracking-widest uppercase text-xs mt-2">
            Smart parking. Fast.
          </p>
        </div>

        <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-red-600">
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-4 border-b-2 border-gray-100 pb-2">
              Driver Login
            </h2>

            <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
              <Mail className="text-gray-400 mr-3" size={18} />
              <input
                type="email"
                placeholder="Email Address"
                className="bg-transparent w-full outline-none text-sm font-bold text-gray-700"
              />
            </div>

            <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
              <Lock className="text-gray-400 mr-3" size={18} />
              <input
                type="password"
                placeholder="Password"
                className="bg-transparent w-full outline-none text-sm font-bold text-gray-700"
              />
            </div>

            <button
              onClick={() => {
                setAppState('user');
                setHasSearched(false);
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition flex justify-center items-center gap-2 mt-2"
            >
              Log In <ArrowRight size={18} />
            </button>

            <button
              onClick={() => {
                setAppState('guest');
                setHasSearched(false);
              }}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-widest py-3 rounded shadow-sm transition flex justify-center items-center gap-2"
            >
              Continue as Guest <User size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] bg-gray-100 font-sans overflow-hidden">
      <div className="absolute inset-0 z-0">
        <MapView
          carparks={results.length > 0 ? results : MOCK_RESULTS} 
          selectedId={selectedCarparkId}
          destinationPoint={destinationPoint}
          hasSearched={hasSearched}
          onSelectCarpark={setSelectedCarparkId}
          markerRefs={markerRefs}
          userLocation={userLocation}
          sidebarOpen={sidebarOpen}
        />
      </div>

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute top-4 left-4 z-30 bg-neutral-900 text-white p-3 rounded-lg shadow-xl border-2 border-yellow-400 hover:bg-neutral-800 transition"
        >
          <Menu size={20} />
        </button>
      )}

      <div
        className={`absolute top-0 left-0 h-full z-20 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="w-[85vw] max-w-[420px] bg-white shadow-2xl flex flex-col border-r border-gray-200 h-full overflow-y-auto">
          <div className="bg-neutral-900 p-3 sm:p-4 flex justify-between items-center border-b-4 border-yellow-400 sticky top-0 z-30">
            <h1
              className="text-lg sm:text-xl font-black italic text-white flex items-center uppercase cursor-pointer shrink-0"
              onClick={() => {
                setHasSearched(false);
                setDestinationPoint(null);
              }}
            >
              GoPark <Zap className="text-yellow-400 fill-yellow-400 h-4 w-4 ml-1" />
            </h1>

            <div className="relative flex items-center gap-2" ref={tooltipRef}>
              <button
                onClick={() => {
                  if (!locationShared) setShowLocationTooltip((v) => !v);
                }}
                className={`text-[10px] font-black px-2 sm:px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 transition cursor-pointer ${
                  locationShared
                    ? 'bg-green-600/20 text-green-400 border border-green-600/40'
                    : 'bg-gray-800 text-yellow-400 border border-gray-700 hover:border-yellow-400/50'
                }`}
              >
                <WeatherIcon size={14} />
                <span className="hidden sm:inline">{weather}</span>
                <span className="sm:hidden">{weather.length > 12 ? weather.slice(0, 10) + '..' : weather}</span>
              </button>
              {showLocationTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-56 z-50">
                  <p className="text-xs font-bold text-gray-700 mb-2">
                    Share precise location for better weather accuracy?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={shareLocation}
                      className="flex-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider py-1.5 rounded hover:bg-red-700 transition"
                    >
                      Share
                    </button>
                    <button
                      onClick={() => setShowLocationTooltip(false)}
                      className="flex-1 bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-wider py-1.5 rounded hover:bg-gray-200 transition"
                    >
                      No thanks
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setAppState('login')}
                className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition"
              >
                <LogOut size={16} />
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white border-b border-gray-200 shadow-sm relative z-10">
            <form onSubmit={handleSearch} className="space-y-3 sm:space-y-4">
              <div className="relative">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">
                  Destination
                </label>
                <div className="bg-gray-50 flex items-center border border-gray-200 rounded-lg p-2.5 sm:p-3 focus-within:border-red-500 transition">
                  <Search className="text-red-500 mr-2 shrink-0" size={18} />
                  <input
                    required
                    type="text"
                    value={destination}
                    onChange={handleDestinationChange}
                    onFocus={() => destination.length > 2 && setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)} // Delay so click registers
                    placeholder="e.g. Orchard Gateway"
                    className="bg-transparent w-full outline-none text-sm font-bold text-gray-800 placeholder-gray-400"
                  />
                </div>

                {isDropdownOpen && suggestions.length > 0 && (
                  <ul className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto">
                    {suggestions.map((sugg, idx) => (
                      <li 
                        key={idx} 
                        onClick={() => selectSuggestion(sugg)}
                        className="px-4 py-3 hover:bg-red-50 cursor-pointer border-b border-gray-100 last:border-0 text-sm font-bold text-gray-700 flex items-center gap-2"
                      >
                        <MapPin size={14} className="text-red-400 flex-shrink-0" />
                        <span className="truncate">{sugg.formatted || sugg.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-2 sm:gap-3">
              </div>

              <div className="flex gap-2 sm:gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">
                    Arrival Time
                  </label>
                  <div className="bg-gray-50 flex items-center border border-gray-200 rounded-lg p-2.5 sm:p-3">
                    <Clock className="text-red-500 mr-2 shrink-0" size={16} />
                    <input
                      required
                      type="time"
                      defaultValue="14:00"
                      className="bg-transparent w-full outline-none text-sm font-bold text-gray-800"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">
                    Duration
                  </label>
                  <div className="bg-gray-50 flex items-center border border-gray-200 rounded-lg p-2.5 sm:p-3">
                    <Calendar className="text-red-500 mr-2 shrink-0" size={16} />
                    <select className="bg-transparent w-full outline-none text-sm font-bold text-gray-800 appearance-none">
                      <option>1 Hour</option>
                      <option>2 Hours</option>
                      <option>3 Hours</option>
                      <option>4+ Hours</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-widest py-3 sm:py-3.5 rounded-lg shadow-[0_4px_0_rgb(180,140,0)] active:shadow-none active:translate-y-1 transition text-sm"
              >
                Find Parking
              </button>
            </form>
          </div>

          {!hasSearched ? (
            <div className="p-5 flex-1 bg-gray-50">
              <p className="text-sm text-gray-500 font-bold italic text-center py-4">
                Search for a destination to find nearby parking.
              </p>
            </div>
          ) : (
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 flex-1">
              <div className="flex justify-between items-center mb-2 px-1 border-b-2 border-dashed border-gray-200 pb-2">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                  {results.length} options found
                </span>
              </div>

              {results.map((carpark) => {
                const isFav = favorites.some((fav) => fav.id === carpark.id);
                return (
                  <div
                    key={carpark.id}
                    onClick={() => setSelectedCarparkId(carpark.id)}
                    className={`bg-white border-2 rounded-xl p-3 sm:p-4 cursor-pointer transition-all duration-200 ${
                      selectedCarparkId === carpark.id
                        ? 'border-red-600 shadow-lg ring-4 ring-red-100 scale-[1.02]'
                        : 'border-gray-100 hover:border-red-400'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-gray-800 text-sm sm:text-md leading-tight w-3/4">
                        {carpark.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => toggleFavorite(e, carpark)}
                          className={`transition hover:scale-110 ${
                            isFav ? 'text-red-500' : 'text-gray-300 hover:text-red-400'
                          }`}
                        >
                          <Heart size={18} fill={isFav ? 'currentColor' : 'none'} strokeWidth={2.5} />
                        </button>
                        <div className="bg-yellow-400 text-gray-900 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">
                          {carpark.lots} LOTS
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-end mt-3">
                      <div>
                        <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter">
                          ${carpark.price.toFixed(2)}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {carpark.type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-600 flex items-center justify-end gap-1 mb-1.5">
                          <Clock size={12} className="text-red-500" /> {carpark.walkTime} min walk
                        </p>
                        <button className="text-[10px] font-black uppercase tracking-wider text-gray-900 bg-yellow-400 hover:bg-yellow-500 px-3 py-1.5 rounded-lg transition flex items-center gap-1">
                          <Navigation size={12} /> Route
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
