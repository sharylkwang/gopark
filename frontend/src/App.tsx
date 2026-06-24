import { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import { MapView } from './components/Map';
import { LoginPage } from './components/Auth/LoginPage';
import { DetailPanel } from './components/DetailPanel';
import { SidebarHeader } from './components/Sidebar/Header';
import { SearchForm } from './components/Sidebar/SearchForm';
import { RouteInfo } from './components/Sidebar/RouteInfo';
import { ResultsList } from './components/Sidebar/ResultsList';
import { FavoritesList } from './components/Sidebar/FavoritesList';
import { useAuth } from './hooks/useAuth';
import { useWeather } from './hooks/useWeather';
import { useDarkMode } from './hooks/useDarkMode';
import { useFavorites } from './hooks/useFavorites';
import { useRoutes } from './hooks/useRoutes';
import { useLocation } from './hooks/useLocation';
import { geocodeLocation, autocompleteLocation, reverseGeocode, classifyLocation } from './providers/geoapify';
import { fetchAll, fetchNearby, fetchDetail, fetchAvailability } from './providers/carparks';
import { estimateCost } from './utils/estimateCost';
import type { CarparkSummary, CarparkDetail, DestinationPoint, PlaceSuggestion } from './types';

export default function GoParkApp() {
  const auth = useAuth();
  const { weather, WeatherIcon, updateForCoords } = useWeather();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { favorites, loadFavorites, toggleFav, clearFavorites } = useFavorites(auth.appState);
  const loc = useLocation();

  const [hasSearched, setHasSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [destinationPoint, setDestinationPoint] = useState<DestinationPoint | null>(null);
  const [parkUntil, setParkUntil] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const durationHours = (() => {
    const [h, m] = parkUntil.split(':').map(Number);
    const now = new Date();
    const until = new Date();
    until.setHours(h, m, 0, 0);
    if (until <= now) until.setDate(until.getDate() + 1);
    return Math.max(0.5, Math.round((until.getTime() - now.getTime()) / 60000) / 60);
  })();
  const [vehicleType, setVehicleType] = useState('C');
  const [startPoint, setStartPoint] = useState('');
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [startSuggestions, setStartSuggestions] = useState<PlaceSuggestion[]>([]);
  const [startDropdownOpen, setStartDropdownOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [resultTab, setResultTab] = useState<'avail' | 'other'>('avail');
  const [sidebarTab, setSidebarTab] = useState<'search' | 'favorites'>('search');
  const [allCarparks, setAllCarparks] = useState<CarparkSummary[]>([]);
  const [nearbyRaw, setNearbyRaw] = useState<CarparkSummary[]>([]);
  const [searchResults, setSearchResults] = useState<CarparkSummary[]>([]);
  const [detail, setDetail] = useState<CarparkDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const routes = useRoutes(startCoords, loc.userLocation);
  const destinationRef = useRef<DestinationPoint | null>(null);

  auth.onLogin.current = (ids: string[]) => loadFavorites(ids);

  useEffect(() => { fetchAll().then(setAllCarparks).catch(() => {}); }, []);

  useEffect(() => {
    if (auth.appState === 'login') return;
    const interval = setInterval(() => {
      fetchAvailability().then(({ carparks: avMap }) => {
        setAllCarparks(prev => prev.map(cp => avMap[cp.id] ? { ...cp, availability: avMap[cp.id] } : cp));
        setSearchResults(prev => prev.map(cp => avMap[cp.id] ? { ...cp, availability: avMap[cp.id] } : cp));
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [auth.appState]);

  const rankResults = (nearby: CarparkSummary[]) => {
    let filtered = nearby.filter(cp => cp.availability[vehicleType] || Object.keys(cp.availability).length === 0);
    if (filtered.length === 0 && (vehicleType === 'C' || vehicleType === 'Y'))
      filtered = nearby.filter(cp => cp.agency === 'HDB' || Object.keys(cp.availability).length === 0);

    let results = filtered.map(cp => ({
      ...cp,
      estimatedCost: cp.rates ? estimateCost(cp.rates, durationHours, vehicleType) : null,
    }));

    if (maxPrice !== null)
      results = results.filter(cp => cp.estimatedCost === null || cp.estimatedCost <= maxPrice);

    results.sort((a, b) => {
      const dd = (a.distance ?? Infinity) - (b.distance ?? Infinity);
      return dd !== 0 ? dd : (a.estimatedCost ?? Infinity) - (b.estimatedCost ?? Infinity);
    });
    return results.slice(0, 10);
  };

  useEffect(() => {
    if (!hasSearched || nearbyRaw.length === 0) return;
    setSearchResults(rankResults(nearbyRaw));
  }, [vehicleType, maxPrice, durationHours, nearbyRaw, hasSearched]);

  const resetHome = () => {
    setHasSearched(false);
    setDestinationPoint(null);
    destinationRef.current = null;
    setDetail(null);
    setSelectedId(null);
    setNearbyRaw([]);
    routes.clearRoutes();
  };

  const handleLogout = () => {
    auth.handleLogout();
    clearFavorites();
    resetHome();
  };

  const executeSearch = async (query: string) => {
    setLoading(true);
    try {
      let lat = 0, lng = 0, placeName = query, formatted = query;
      const postalMatch = query.match(/\b\d{6}\b/);

      if (postalMatch) {
        const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postalMatch[0]}&returnGeom=Y&getAddrDetails=Y`);
        const data = await res.json();
        if (data.found > 0) {
          lat = parseFloat(data.results[0].LATITUDE);
          lng = parseFloat(data.results[0].LONGITUDE);
          placeName = `${data.results[0].BLK_NO} ${data.results[0].ROAD_NAME}`;
          formatted = `Singapore ${postalMatch[0]}`;
        }
      }

      if (lat === 0 || lng === 0) {
        const place = await geocodeLocation(query);
        lat = place.lat; lng = place.lon;
        placeName = place.name || query; formatted = place.formatted;
      }

      const dest: DestinationPoint = { name: placeName, formatted, lat, lng };
      setDestinationPoint(dest);
      destinationRef.current = dest;
      setDestination(formatted || placeName);

      classifyLocation(lat, lng).then(c => {
        if (c) {
          const updated = { ...dest, classification: c };
          setDestinationPoint(updated);
          destinationRef.current = updated;
        }
      });

      const nearby = await fetchNearby(lat, lng, 2000);
      setNearbyRaw(nearby);
      const ranked = rankResults(nearby);
      setSearchResults(ranked);
      setHasSearched(true);
      setDetail(null);

      if (ranked.length > 0) {
        setSelectedId(ranked[0].id);
        fetchDetail(ranked[0].id).then(setDetail).catch(() => setDetail(null));
        routes.fetchRoutes(ranked[0], dest);
      } else {
        setSelectedId(null);
        routes.clearRoutes();
      }
    } catch { alert('Could not find destination'); }
    finally { setLoading(false); }
  };

  const handleDestinationChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);
    if (val.length > 2) {
      setSuggestions(await autocompleteLocation(val));
      setIsDropdownOpen(true);
    } else setIsDropdownOpen(false);
  };

  const selectSuggestion = (s: PlaceSuggestion) => {
    const name = s.formatted || s.name || destination;
    setDestination(name);
    setIsDropdownOpen(false);
    executeSearch(name);
  };

  const handleStartChange = async (val: string) => {
    setStartPoint(val);
    if (!val) { setStartCoords(null); setStartSuggestions([]); setStartDropdownOpen(false); return; }
    if (val.length > 2) {
      setStartSuggestions(await autocompleteLocation(val));
      setStartDropdownOpen(true);
    }
  };

  const selectStart = (s: PlaceSuggestion) => {
    setStartPoint(s.formatted || s.name || '');
    setStartCoords([s.lat, s.lon]);
    setStartDropdownOpen(false);
  };

  const selectCarpark = async (id: string) => {
    setSelectedId(id);
    fetchDetail(id).then(setDetail).catch(() => setDetail(null));

    const cp = searchResults.find(c => c.id === id) || allCarparks.find(c => c.id === id);
    if (!cp) return;

    const dest = destinationRef.current;
    if (dest) {
      routes.fetchRoutes(cp, dest);
    } else {
      const origin = startCoords || loc.userLocation;
      if (origin) routes.fetchDriveOnly(origin, cp);
      setDestinationPoint({ lat: cp.lat, lng: cp.lng, name: cp.name, formatted: cp.address || cp.name });
      setHasSearched(true);
    }
  };

  const handleDestinationDrag = async (lat: number, lng: number) => {
    setDestinationPoint({ name: destinationRef.current?.name || '', formatted: destinationRef.current?.formatted || '', lat, lng });
    setLoading(true);

    const place = await reverseGeocode(lat, lng);
    const placeName = place.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const dest: DestinationPoint = { name: placeName, formatted: place.formatted || placeName, lat, lng };
    setDestinationPoint(dest);
    destinationRef.current = dest;
    setDestination(placeName);

    classifyLocation(lat, lng).then(c => {
      if (c) {
        const updated = { ...dest, classification: c };
        setDestinationPoint(updated);
        destinationRef.current = updated;
      }
    });

    try {
      const nearby = await fetchNearby(lat, lng, 2000);
      setNearbyRaw(nearby);
      const ranked = rankResults(nearby);
      setSearchResults(ranked);
      setHasSearched(true);
      setDetail(null);

      if (ranked.length > 0) {
        setSelectedId(ranked[0].id);
        fetchDetail(ranked[0].id).then(setDetail).catch(() => setDetail(null));
        routes.fetchRoutes(ranked[0], dest);
      } else {
        setSelectedId(null);
        routes.clearRoutes();
      }
    } catch {} finally { setLoading(false); }
  };

  if (auth.appState === 'login') {
    return (
      <LoginPage
        email={auth.email} setEmail={auth.setEmail}
        password={auth.password} setPassword={auth.setPassword}
        showPassword={auth.showPassword} setShowPassword={auth.setShowPassword}
        authError={auth.authError} setAuthError={auth.setAuthError}
        isLoggingIn={auth.isLoggingIn}
        username={auth.username} setUsername={auth.setUsername}
        isLoginView={auth.isLoginView} setIsLoginView={auth.setIsLoginView}
        showOtpView={auth.showOtpView} setShowOtpView={auth.setShowOtpView}
        otp={auth.otp} setOtp={auth.setOtp}
        isResetView={auth.isResetView} setIsResetView={auth.setIsResetView}
        newPassword={auth.newPassword} setNewPassword={auth.setNewPassword}
        isLinkSent={auth.isLinkSent} setIsLinkSent={auth.setIsLinkSent}
        resetLoading={auth.resetLoading}
        showCaptcha={auth.showCaptcha} setShowCaptcha={auth.setShowCaptcha}
        onCaptchaToken={auth.handleCaptchaToken}
        onAuth={auth.handleAuth} onVerify={auth.handleVerify}
        onRequestReset={auth.handleRequestResetCode} onResetPassword={auth.handleResetPassword}
        onGuest={auth.enterGuest}
      />
    );
  }

  return (
    <div className={`flex h-[100dvh] font-sans overflow-hidden ${darkMode ? 'dark' : ''}`}>
      {sidebarOpen && (
        <div className={`w-[400px] min-w-[360px] max-w-[440px] flex flex-col z-20 shrink-0 ${darkMode ? 'bg-neutral-900 border-r border-neutral-700' : 'bg-white border-r border-gray-200'}`}>
          <SidebarHeader
            darkMode={darkMode} toggleDarkMode={toggleDarkMode}
            onLogout={handleLogout} onClose={() => setSidebarOpen(false)} onReset={resetHome}
            weather={weather} WeatherIcon={WeatherIcon}
            locationShared={loc.locationShared}
            showTooltip={loc.showTooltip} setShowTooltip={loc.setShowTooltip} tooltipRef={loc.tooltipRef}
            onShareLocation={() => loc.shareLocation((lat, lng) => updateForCoords(lat, lng))}
          />

          <SearchForm
            darkMode={darkMode}
            destination={destination} onDestinationChange={handleDestinationChange}
            suggestions={suggestions} isDropdownOpen={isDropdownOpen}
            setIsDropdownOpen={setIsDropdownOpen} onSelectSuggestion={selectSuggestion}
            startPoint={startPoint} onStartChange={handleStartChange}
            startCoords={startCoords} clearStart={() => { setStartPoint(''); setStartCoords(null); }}
            startSuggestions={startSuggestions} startDropdownOpen={startDropdownOpen}
            setStartDropdownOpen={setStartDropdownOpen} onSelectStart={selectStart}
            locationShared={loc.locationShared}
            parkUntil={parkUntil} setParkUntil={setParkUntil} durationHours={durationHours}
            vehicleType={vehicleType} setVehicleType={setVehicleType}
            maxPrice={maxPrice} setMaxPrice={setMaxPrice}
            loading={loading} onSubmit={executeSearch}
          />

          <div className={`flex-1 overflow-y-auto ${darkMode ? 'bg-neutral-800' : 'bg-gray-50'}`}>
            {auth.appState === 'user' && (
              <div className={`flex border-b shrink-0 ${darkMode ? 'border-neutral-700' : 'border-gray-200'}`}>
                {(['search', 'favorites'] as const).map(tab => (
                  <button key={tab} onClick={() => setSidebarTab(tab)}
                    className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition ${
                      sidebarTab === tab
                        ? darkMode ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-red-600 border-b-2 border-red-600'
                        : darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                    }`}>
                    {tab === 'search' ? 'Search' : `Favorites (${favorites.size})`}
                  </button>
                ))}
              </div>
            )}

            {sidebarTab === 'favorites' && auth.appState === 'user' ? (
              <FavoritesList darkMode={darkMode} allCarparks={allCarparks} favorites={favorites}
                selectedId={selectedId} onSelectCarpark={selectCarpark} onToggleFav={toggleFav} />
            ) : (
              <>
                <RouteInfo darkMode={darkMode} driveRoute={routes.driveRoute} walkRoute={routes.walkRoute}
                  destinationPoint={destinationPoint} hasSearched={hasSearched} />
                <ResultsList darkMode={darkMode} hasSearched={hasSearched} searchResults={searchResults}
                  selectedId={selectedId} favorites={favorites} vehicleType={vehicleType}
                  durationHours={durationHours} resultTab={resultTab} setResultTab={setResultTab}
                  onSelectCarpark={selectCarpark} onToggleFav={toggleFav} />
              </>
            )}
          </div>

          <div className={`px-4 py-3 text-center border-t shrink-0 ${darkMode ? 'border-neutral-700' : 'border-gray-100'}`}>
            <p className={`text-[9px] font-bold tracking-wide ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>
              Yong Man Ting · Kwang Le Ping Sharyl
            </p>
            <p className={`text-[8px] font-bold tracking-widest uppercase mt-0.5 ${darkMode ? 'text-gray-700' : 'text-gray-200'}`}>
              NUS Orbital 2026 🚀🌏
            </p>
          </div>
        </div>
      )}

      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)}
          className="absolute top-4 left-4 z-30 bg-neutral-900 text-white p-3 rounded-lg shadow-xl border-2 border-yellow-400 hover:bg-neutral-800 transition">
          <Menu size={20} />
        </button>
      )}

      <div className="flex-1 min-w-0 relative">
        <MapView carparks={hasSearched ? searchResults : []} selectedId={selectedId} destinationPoint={destinationPoint}
          hasSearched={hasSearched} onSelectCarpark={selectCarpark} onDestinationDrag={handleDestinationDrag}
          userLocation={loc.userLocation} drivePolyline={routes.drivePolyline} driveRoute={routes.driveRoute}
          walkPolyline={routes.walkPolyline} walkRoute={routes.walkRoute} startCoords={startCoords} sidebarOpen={sidebarOpen} />
      </div>

      {detail && <DetailPanel detail={detail} darkMode={darkMode} onClose={() => { setDetail(null); setSelectedId(null); }} />}
    </div>
  );
}
