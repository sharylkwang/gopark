import { useState, useEffect, useRef, useMemo } from 'react';
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
import { geocodeLocation, autocompleteLocation, reverseGeocode, classifyLocation, fetchNearbyParking } from './providers/geoapify';
import { fetchAll, fetchNearby, fetchDetail, fetchAvailability } from './providers/carparks';
import { estimateCost } from './utils/estimateCost';
import { totals, parseDurationSecs, formatClockTime } from './utils/format';
import type { CarparkSummary, CarparkDetail, DestinationPoint, PlaceSuggestion, NearbyParking } from './types';
import { TrafficTicker } from './components/TrafficTicker';
import type { TrafficIncident } from './providers/traffic';

export default function GoParkApp() {
  const auth = useAuth();
  const { weather, temp, emoji: weatherEmoji, updateForCoords } = useWeather();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { favorites, loadFavorites, toggleFav, clearFavorites } = useFavorites(auth.appState);
  const loc = useLocation();

  const [hasSearched, setHasSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [destinationPoint, setDestinationPoint] = useState<DestinationPoint | null>(null);

  useEffect(() => {
    if (destinationPoint) {
      updateForCoords(destinationPoint.lat, destinationPoint.lng);
    } else if (loc.userLocation) {
      updateForCoords(loc.userLocation[0], loc.userLocation[1]);
    }
  }, [loc.userLocation, destinationPoint?.lat, destinationPoint?.lng]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const [parkUntil, setParkUntil] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return formatClockTime(d);
  });
  const [vehicleType, setVehicleType] = useState('C');
  const [startPoint, setStartPoint] = useState('');
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [startSuggestions, setStartSuggestions] = useState<PlaceSuggestion[]>([]);
  const [startDropdownOpen, setStartDropdownOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'search' | 'favorites'>('search');
  const [allCarparks, setAllCarparks] = useState<CarparkSummary[]>([]);
  const [nearbyRaw, setNearbyRaw] = useState<CarparkSummary[]>([]);
  const [searchResults, setSearchResults] = useState<CarparkSummary[]>([]);
  const [detail, setDetail] = useState<CarparkDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pickMode, setPickMode] = useState<'start' | 'destination' | null>(null);
  const [nearbyParking, setNearbyParking] = useState<NearbyParking[]>([]);
  const [activeIncident, setActiveIncident] = useState<TrafficIncident | null>(null);
  const prefetchedParkingRef = useRef<NearbyParking[] | null>(null);

  const routes = useRoutes(startCoords, loc.userLocation);
  const travelMins = routes.driveRoute ? Math.ceil(parseDurationSecs(routes.driveRoute.duration) / 60) : 0;
  const arrivalTime = new Date(now.getTime() + travelMins * 60000);

  useEffect(() => {
    const [h, m] = parkUntil.split(':').map(Number);
    const until = new Date(arrivalTime);
    until.setHours(h, m, 0, 0);
    if (until <= arrivalTime) {
      const bumped = new Date(arrivalTime);
      bumped.setHours(bumped.getHours() + 1, 0, 0, 0);
      setParkUntil(formatClockTime(bumped));
    }
  }, [now, travelMins]);

  const durationHours = (() => {
    const [h, m] = parkUntil.split(':').map(Number);
    const until = new Date(arrivalTime);
    until.setHours(h, m, 0, 0);
    if (until <= arrivalTime) until.setDate(until.getDate() + 1);
    return Math.max(0.5, Math.round((until.getTime() - arrivalTime.getTime()) / 60000) / 60);
  })();

  const destinationRef = useRef<DestinationPoint | null>(null);
  const destQuerySeq = useRef(0);
  const startQuerySeq = useRef(0);

  auth.onLogin.current = (ids: string[]) => loadFavorites(ids);

  useEffect(() => { fetchAll().then(setAllCarparks).catch(() => {}); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detail) { setDetail(null); setSelectedId(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [detail]);

  useEffect(() => {
    if (auth.appState === 'login') return;
    const interval = setInterval(() => {
      fetchAvailability().then(({ carparks: avMap }) => {
        const applyAvailability = <T extends CarparkSummary>(list: T[]) =>
          list.map(cp => avMap[cp.id] ? { ...cp, availability: avMap[cp.id] } : cp);
        setAllCarparks(applyAvailability);
        setNearbyRaw(applyAvailability);
        setSearchResults(applyAvailability);
        setDetail(prev => prev && avMap[prev.id] ? { ...prev, availability: { ...prev.availability, ...avMap[prev.id] } } : prev);
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [auth.appState]);

  const rankResults = (nearby: CarparkSummary[]) => {
    let results = nearby.map(cp => ({
      ...cp,
      estimatedCost: cp.rates ? estimateCost(cp.rates, durationHours, vehicleType, arrivalTime) : null,
    }));

    if (maxPrice !== null)
      results = results.filter(cp => cp.estimatedCost === null || cp.estimatedCost <= maxPrice);

    const maxDist = Math.max(...results.map(r => r.distance ?? 0), 1);
    const maxCost = Math.max(...results.map(r => r.estimatedCost ?? 0), 1);

    const score = (cp: typeof results[0]) => {
      const vAvail = cp.availability[vehicleType];
      const t = totals(cp.availability);
      const avail = vAvail ? vAvail.available : t.available;
      const full = vAvail ? (vAvail.total ?? 0) > 0 && avail === 0 : t.total > 0 && avail === 0;
      if (full) return Infinity;

      const hasVehicleData = vAvail ? 0 : 0.5;
      const hasData = (t.total > 0 ? 0 : 1) + (cp.estimatedCost != null ? 0 : 1);
      const distNorm = (cp.distance ?? maxDist) / maxDist;
      const costNorm = (cp.estimatedCost ?? maxCost) / maxCost;
      const availBonus = avail == null || avail > 0 ? 0 : 0.3;

      return hasVehicleData + hasData + distNorm * 0.35 + costNorm * 0.45 + availBonus;
    };

    results.sort((a, b) => score(a) - score(b));
    return results.slice(0, 20);
  };

  const costRange = useMemo(() => {
    if (!nearbyRaw.length) return { min: 1, max: 50 };
    const costs = nearbyRaw
      .map(cp => cp.rates ? estimateCost(cp.rates, durationHours, vehicleType, arrivalTime) : null)
      .filter((c): c is number => c !== null && c > 0);
    if (!costs.length) return { min: 1, max: 50 };
    return { min: Math.floor(Math.min(...costs)), max: Math.ceil(Math.max(...costs)) };
  }, [nearbyRaw, durationHours, vehicleType]);

  useEffect(() => {
    if (!hasSearched || nearbyRaw.length === 0) return;
    setSearchResults(rankResults(nearbyRaw));
  }, [vehicleType, maxPrice, durationHours, nearbyRaw, hasSearched]);

  const resetHome = () => {
    setHasSearched(false);
    setDestinationPoint(null);
    setNearbyParking([]);
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

  const updateDestinationClassification = (dest: DestinationPoint) => {
    prefetchedParkingRef.current = null;
    classifyLocation(dest.lat, dest.lng).then(c => {
      if (c) {
        const updated = { ...dest, classification: c };
        setDestinationPoint(updated);
        destinationRef.current = updated;
        if (c.hasParking && !/HDB|Residential/i.test(c.type || '')) {
          fetchNearbyParking(dest.lat, dest.lng).then(spots => { prefetchedParkingRef.current = spots; });
        }
      }
    });
  };

  const loadNearbyForDestination = async (dest: DestinationPoint) => {
    const nearby = await fetchNearby(dest.lat, dest.lng, 2000);
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
  };

  const executeSearch = async (query: string) => {
    setActiveIncident(null);
    destQuerySeq.current++;
    startQuerySeq.current++;
    setSuggestions([]);
    setStartSuggestions([]);
    setIsDropdownOpen(false);
    setStartDropdownOpen(false);
    setLoading(true);
    try {
      let lat = 0, lng = 0, placeName = query, formatted = query;

      const picked = destinationRef.current;
      const pickedMatchesQuery = picked && picked.lat && picked.lng
        && (query === picked.name || query === picked.formatted);
      if (pickedMatchesQuery) {
        lat = picked.lat;
        lng = picked.lng;
        placeName = picked.name || query;
        formatted = picked.formatted || query;
      } else {
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
      }

      const dest: DestinationPoint = { name: placeName, formatted, lat, lng };
      setDestinationPoint(dest);
      setNearbyParking([]);
      destinationRef.current = dest;
      setDestination(formatted || placeName);

      updateDestinationClassification(dest);
      await loadNearbyForDestination(dest);
    } catch { alert('Could not find destination'); }
    finally { setLoading(false); }
  };

  const handleDestinationChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);
    const seq = ++destQuerySeq.current;
    if (val.length > 2) {
      const results = await autocompleteLocation(val);
      if (seq !== destQuerySeq.current) return;
      setSuggestions(results);
      setIsDropdownOpen(true);
    } else {
      setSuggestions([]);
      setIsDropdownOpen(false);
    }
  };

  const selectSuggestion = (s: PlaceSuggestion) => {
    const name = s.formatted || s.name || destination;
    setDestination(name);
    setIsDropdownOpen(false);
    searchAndClose(name);
  };

  const handleStartChange = async (val: string) => {
    setStartPoint(val);
    const seq = ++startQuerySeq.current;
    if (!val) { setStartCoords(null); setStartSuggestions([]); setStartDropdownOpen(false); return; }
    if (val.length > 2) {
      const results = await autocompleteLocation(val);
      if (seq !== startQuerySeq.current) return;
      setStartSuggestions(results);
      setStartDropdownOpen(true);
    }
  };

  const selectStart = (s: PlaceSuggestion) => {
    startQuerySeq.current++;
    setStartPoint(s.formatted || s.name || '');
    setStartCoords([s.lat, s.lon]);
    setStartSuggestions([]);
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

  const handleMapPick = async (pos: { lat: number; lng: number }) => {
    if (!pickMode) return;
    const place = await reverseGeocode(pos.lat, pos.lng);
    const name = place.name || `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
    if (pickMode === 'start') {
      setStartPoint(name);
      setStartCoords([pos.lat, pos.lng]);
    } else {
      setDestination(name);
      setDestinationPoint({ name, formatted: place.formatted || name, lat: pos.lat, lng: pos.lng });
      setNearbyParking([]);
      destinationRef.current = { name, formatted: place.formatted || name, lat: pos.lat, lng: pos.lng };
    }
    setPickMode(null);
  };

  const handleDestinationDrag = async (lat: number, lng: number) => {
    setDestinationPoint({ name: destinationRef.current?.name || '', formatted: destinationRef.current?.formatted || '', lat, lng });
    setLoading(true);

    const place = await reverseGeocode(lat, lng);
    const placeName = place.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const dest: DestinationPoint = { name: placeName, formatted: place.formatted || placeName, lat, lng };
    setDestinationPoint(dest);
    setNearbyParking([]);
    destinationRef.current = dest;
    setDestination(placeName);

    updateDestinationClassification(dest);

    try {
      await loadNearbyForDestination(dest);
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
        onRequestReset={auth.handleRequestResetCode} onResetCaptchaToken={auth.handleResetCaptchaToken}
        onGuest={auth.enterGuest} darkMode={darkMode} toggleDarkMode={toggleDarkMode}
      />
    );
  }

  const closeSidebarOnMobile = () => {
    if (window.matchMedia('(max-width: 767px)').matches) setSidebarOpen(false);
  };

  const searchAndClose = async (query: string) => {
    setSuggestions([]);
    setStartSuggestions([]);
    setIsDropdownOpen(false);
    setStartDropdownOpen(false);
    await executeSearch(query);
    closeSidebarOnMobile();
  };

  const selectAndClose = async (id: string) => {
    await selectCarpark(id);
    closeSidebarOnMobile();
  };

  return (
    <div className={`relative h-[100dvh] font-sans overflow-hidden ${darkMode ? 'dark' : ''}`}>
      {sidebarOpen && (
        <div className={`fixed inset-0 md:absolute md:inset-auto md:top-3 md:left-3 md:bottom-3 w-full md:w-[340px] md:rounded-2xl flex flex-col z-20 shadow-2xl ${darkMode ? 'bg-neutral-900 border border-neutral-700/50' : 'bg-white border border-gray-200/60'}`}>
          <SidebarHeader
            darkMode={darkMode} toggleDarkMode={toggleDarkMode}
            onLogout={handleLogout} onClose={() => setSidebarOpen(false)} onReset={resetHome}
            locationShared={loc.locationShared}
            onShareLocation={() => loc.shareLocation((lat, lng) => updateForCoords(lat, lng))}
          />

          {detail ? (
            <div className={`flex-1 overflow-y-auto sidebar-scroll ${darkMode ? 'bg-neutral-900' : 'bg-white'}`}>
              <DetailPanel detail={detail} darkMode={darkMode} onClose={() => { setDetail(null); setSelectedId(null); }}
                arrivalTime={arrivalTime} parkUntil={parkUntil} setParkUntil={setParkUntil} durationHours={durationHours} vehicleType={vehicleType} />
            </div>
          ) : (
            <>
              <SearchForm
                darkMode={darkMode}
                destination={destination} onDestinationChange={handleDestinationChange}
                suggestions={suggestions} isDropdownOpen={isDropdownOpen}
                closeDropdown={() => setIsDropdownOpen(false)} onSelectSuggestion={selectSuggestion}
                startPoint={startPoint} onStartChange={handleStartChange}
                startCoords={startCoords} clearStart={() => { setStartPoint(''); setStartCoords(null); }}
                startSuggestions={startSuggestions} startDropdownOpen={startDropdownOpen}
                closeStartDropdown={() => setStartDropdownOpen(false)} onSelectStart={selectStart}
                locationShared={loc.locationShared}
                arrivalTime={arrivalTime} parkUntil={parkUntil} setParkUntil={setParkUntil}
                vehicleType={vehicleType} setVehicleType={setVehicleType}
                maxPrice={maxPrice} setMaxPrice={setMaxPrice} costRange={costRange}
                loading={loading} onSubmit={searchAndClose}
                onPickStart={() => setPickMode('start')} onPickDestination={() => setPickMode('destination')}
              />

              <RouteInfo darkMode={darkMode} driveRoute={routes.driveRoute} walkRoute={routes.walkRoute}
                destinationPoint={destinationPoint} hasSearched={hasSearched} />

              {auth.appState === 'user' && (
                <div className={`flex border-b shrink-0 ${darkMode ? 'border-neutral-700/50' : 'border-gray-200/40'}`}>
                  {(['search', 'favorites'] as const).map(tab => (
                    <button key={tab} onClick={() => setSidebarTab(tab)}
                      className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition ${
                        sidebarTab === tab
                          ? darkMode ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-900 border-b-2 border-gray-900'
                          : darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                      }`}>
                      {tab === 'search' ? 'Search' : `Favorites (${favorites.size})`}
                    </button>
                  ))}
                </div>
              )}

              <div className={`flex-1 overflow-y-auto sidebar-scroll ${darkMode ? 'bg-neutral-800/30' : 'bg-white'}`}>
                {sidebarTab === 'favorites' && auth.appState === 'user' ? (
                  <FavoritesList darkMode={darkMode} allCarparks={allCarparks} favorites={favorites}
                    selectedId={selectedId} onSelectCarpark={selectAndClose} onToggleFav={toggleFav} />
                ) : (
                  <ResultsList darkMode={darkMode} hasSearched={hasSearched} searchResults={searchResults}
                    selectedId={selectedId} favorites={favorites} vehicleType={vehicleType}
                    durationHours={durationHours} recommendedId={searchResults[0]?.id ?? null}
                    onSelectCarpark={selectAndClose} onToggleFav={toggleFav} />
                )}
              </div>
            </>
          )}

          <div className={`px-3 py-2 text-center border-t shrink-0 ${darkMode ? 'border-neutral-700/50' : 'border-gray-200/40'}`}>
            <p className={`text-[8px] font-bold tracking-wide ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              Yong Man Ting · Kwang Le Ping Sharyl · Orbital 2026
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

      <div className="absolute inset-0">
        <MapView carparks={hasSearched ? searchResults : []} backgroundCarparks={hasSearched ? nearbyRaw : []} selectedId={selectedId} destinationPoint={destinationPoint}
          hasSearched={hasSearched} onSelectCarpark={selectAndClose} onDestinationDrag={handleDestinationDrag}
          eventHandlers={pickMode ? { onMapClick: handleMapPick } : undefined}
          userLocation={loc.userLocation} drivePolyline={routes.drivePolyline} driveRoute={routes.driveRoute}
          walkPolyline={routes.walkPolyline} walkRoute={routes.walkRoute} startCoords={startCoords} sidebarOpen={sidebarOpen} nearbyParking={nearbyParking} darkMode={darkMode}
          incident={activeIncident} />
      </div>

      <div className="absolute bottom-3 z-20 w-[min(640px,55vw)] -translate-x-1/2 [&>div]:rounded-full [&>div]:shadow-xl"
        style={{ left: sidebarOpen ? 'calc(358px + (100% - 358px) / 2)' : '50%' }}>
        <TrafficTicker userLocation={loc.userLocation} darkMode={darkMode}
          destination={destinationPoint ? { lat: destinationPoint.lat, lng: destinationPoint.lng } : null}
          onSelect={setActiveIncident} />
      </div>

      <div className="absolute top-3 z-40 -translate-x-1/2 max-md:left-1/2 flex flex-col items-center gap-2" style={{ left: sidebarOpen ? 'calc(358px + (100% - 358px) / 2)' : '50%' }}>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-lg border ${darkMode ? 'bg-neutral-800/80 text-gray-200 border-neutral-700/50' : 'bg-white/80 text-gray-700 border-gray-200/60'}`}>
          <span className="text-base leading-none">{weatherEmoji}</span>
          <span className="text-[11px] font-bold whitespace-nowrap">{weather}{temp != null ? ` · ${temp}°C` : ''}</span>
        </div>
        {pickMode && (
          <div className="tap-hint flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-lg border bg-gray-900/90 text-white border-white/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span className="text-[11px] font-bold whitespace-nowrap">Tap the map to set {pickMode === 'start' ? 'start point' : 'destination'}</span>
            <button onClick={() => setPickMode(null)} className="text-gray-400 hover:text-white text-[11px] font-black ml-1">Cancel</button>
          </div>
        )}
        {destinationPoint && !pickMode && (
          <div className="flex flex-col items-center gap-1.5">
            {destinationPoint.classification?.parkingHint && !/HDB|Residential/i.test(destinationPoint.classification.type || '') && (
              <button onClick={async () => {
                if (nearbyParking.length) { setNearbyParking([]); return; }
                const spots = prefetchedParkingRef.current ?? await fetchNearbyParking(destinationPoint.lat, destinationPoint.lng);
                const plotted = hasSearched ? [...searchResults, ...nearbyRaw] : allCarparks;
                const filtered = spots.filter(p =>
                  !plotted.some(cp => Math.abs(cp.lat - p.lat) < 0.0005 && Math.abs(cp.lng - p.lng) < 0.0005)
                );
                setNearbyParking(filtered);
              }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-lg border cursor-pointer transition ${nearbyParking.length ? 'bg-green-600/80 border-green-400/30' : 'bg-blue-600/80 border-blue-400/30'} text-white`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <span className="text-[11px] font-bold whitespace-nowrap">{destinationPoint.classification.type} — {nearbyParking.length ? `${nearbyParking.length} parking locations nearby` : destinationPoint.classification.parkingHint}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5 opacity-60"><path d={nearbyParking.length ? 'M18 6L6 18M6 6l12 12' : 'M9 18l6-6-6-6'}/></svg>
              </button>
            )}
            {!hasSearched && (
              <div className="tap-hint flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-lg border bg-gray-900/70 text-white border-white/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l4 4L19 3"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span className="text-[11px] font-bold whitespace-nowrap">Drag the pin to adjust destination</span>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
