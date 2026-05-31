import { useState, useEffect, useRef } from 'react';
import { Zap, Mail, Lock, User, ArrowRight, Heart, LogOut, Clock, Navigation, Search, Calendar, Menu, X, ChevronLeft, Car, Bike, MapPin } from 'lucide-react';
import { MapView } from './components/Map';
import { CircularProgress } from './components/CircularProgress';
import { AvailabilityBar } from './components/AvailabilityBar';
import { geocodeLocation, autocompleteLocation } from './providers/geoapify/geocode';
import { fetchAll, fetchNearby, fetchDetail } from './providers/carparks';
import type { CarparkSummary, CarparkDetail, DestinationPoint, AppState } from './types';
import { getWeatherByIP, getWeatherForCoords, getIconForWeather } from './providers/govsg';

const LOT_LABELS: Record<string, string> = { C: 'Car', Y: 'Motorcycle', H: 'Heavy Vehicle', S: 'Season' };
const LOT_ICONS: Record<string, typeof Car> = { C: Car, Y: Bike };
const DAY_LABELS: Record<string, string> = { weekday: 'Weekday', weekday_eve: 'Weekday Eve', saturday: 'Saturday', sunday: 'Sun / PH', all: 'All Days' };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function totals(avail: Record<string, { available: number | null; total: number | null }>) {
  const a = Object.values(avail).reduce((s, e) => s + (e.available ?? 0), 0);
  const t = Object.values(avail).reduce((s, e) => s + (e.total ?? 0), 0);
  return { available: a, total: t, pct: t > 0 ? (a / t) * 100 : 0 };
}

export default function GoParkApp() {
  const [appState, setAppState] = useState<AppState>('login');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [destinationPoint, setDestinationPoint] = useState<DestinationPoint | null>(null);
  const [allCarparks, setAllCarparks] = useState<CarparkSummary[]>([]);
  const [searchResults, setSearchResults] = useState<CarparkSummary[]>([]);
  const [detail, setDetail] = useState<CarparkDetail | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationShared, setLocationShared] = useState(false);
  const [showLocationTooltip, setShowLocationTooltip] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [weather, setWeather] = useState('Loading...');
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getWeatherByIP().then(({ forecast }) => setWeather(forecast)); }, []);
  useEffect(() => { fetchAll().then(setAllCarparks).catch(() => {}); }, []);
  useEffect(() => {
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]), () => {});
  }, []);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) setShowLocationTooltip(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const shareLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setUserLocation(c); setLocationShared(true); setShowLocationTooltip(false);
      getWeatherForCoords(c[0], c[1]).then(setWeather);
    }, () => setShowLocationTooltip(false));
  };

  const executeSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      let lat = 0, lng = 0, placeName = searchQuery, formattedAddress = searchQuery;
      const postalMatch = searchQuery.match(/\b\d{6}\b/);

      if (postalMatch) {
        const onemapRes = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postalMatch[0]}&returnGeom=Y&getAddrDetails=Y`);
        const onemapData = await onemapRes.json();
        if (onemapData.found > 0) {
          lat = parseFloat(onemapData.results[0].LATITUDE);
          lng = parseFloat(onemapData.results[0].LONGITUDE);
          placeName = `${onemapData.results[0].BLK_NO} ${onemapData.results[0].ROAD_NAME}`;
          formattedAddress = `Singapore ${postalMatch[0]}`;
        }
      }

      if (lat === 0 || lng === 0) {
        const place = await geocodeLocation(searchQuery);
        lat = place.lat; lng = place.lon;
        placeName = place.name || searchQuery; formattedAddress = place.formatted;
      }

      setDestinationPoint({ name: placeName, formatted: formattedAddress, lat, lng });
      setSearchResults(await fetchNearby(lat, lng, 2000));
      setHasSearched(true); setSelectedId(null); setDetail(null);
    } catch { alert('Could not find destination'); }
    finally { setLoading(false); }
  };

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await executeSearch(destination);
  };

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

  const selectSuggestion = (sugg: any) => {
    const placeName = sugg.formatted || sugg.name || destination;
    setDestination(placeName);
    setIsDropdownOpen(false);
    executeSearch(placeName); 
  };

  const selectCarpark = async (id: string) => {
    setSelectedId(id);
    try { setDetail(await fetchDetail(id)); } catch { setDetail(null); }
  };

  const closeDetail = () => { setDetail(null); setSelectedId(null); };

  const toggleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (appState === 'guest') { alert('Log in to save favorites'); return; }
    setFavorites(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const WeatherIcon = getIconForWeather(weather);

  if (appState === 'login') {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 font-sans">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-black text-white italic tracking-tight flex items-center justify-center gap-1 uppercase drop-shadow-lg">
            GoPark <Zap className="text-yellow-400 fill-yellow-400 h-10 w-10" />
          </h1>
          <p className="text-yellow-400 font-bold tracking-widest uppercase text-xs mt-2">Smart parking. Fast.</p>
        </div>
        <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-red-600">
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-4 border-b-2 border-gray-100 pb-2">Driver Login</h2>
            <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3"><Mail className="text-gray-400 mr-3" size={18} /><input type="email" placeholder="Email Address" className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" /></div>
            <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3"><Lock className="text-gray-400 mr-3" size={18} /><input type="password" placeholder="Password" className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" /></div>
            <button onClick={() => { setAppState('user'); setHasSearched(false); }} className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition flex justify-center items-center gap-2 mt-2">Log In <ArrowRight size={18} /></button>
            <button onClick={() => { setAppState('guest'); setHasSearched(false); }} className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-widest py-3 rounded shadow-sm transition flex justify-center items-center gap-2">Continue as Guest <User size={18} /></button>
          </div>
        </div>
      </div>
    );
  }

  const dt = detail ? totals(detail.availability) : null;

  return (
    <div className="flex h-[100dvh] font-sans overflow-hidden">

      {sidebarOpen && (
        <div className="w-[340px] min-w-[300px] max-w-[380px] bg-white flex flex-col border-r border-gray-200 z-20 shrink-0">
          <div className="bg-neutral-900 p-3 flex justify-between items-center border-b-4 border-yellow-400 shrink-0">
            <h1 className="text-lg font-black italic text-white flex items-center uppercase cursor-pointer"
              onClick={() => { setHasSearched(false); setDestinationPoint(null); setDetail(null); }}>
              GoPark <Zap className="text-yellow-400 fill-yellow-400 h-4 w-4 ml-1" />
            </h1>
            <div className="relative flex items-center gap-2" ref={tooltipRef}>
              <button onClick={() => { if (!locationShared) setShowLocationTooltip(v => !v); }}
                className={`text-[10px] font-black px-2 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 transition cursor-pointer ${locationShared ? 'bg-green-600/20 text-green-400 border border-green-600/40' : 'bg-gray-800 text-yellow-400 border border-gray-700 hover:border-yellow-400/50'}`}>
                <WeatherIcon size={14} /><span>{weather}</span>
              </button>
              {showLocationTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-lg shadow-xl border p-3 w-56 z-50">
                  <p className="text-xs font-bold text-gray-700 mb-2">Share location for better weather?</p>
                  <div className="flex gap-2">
                    <button onClick={shareLocation} className="flex-1 bg-red-600 text-white text-[10px] font-black uppercase py-1.5 rounded">Share</button>
                    <button onClick={() => setShowLocationTooltip(false)} className="flex-1 bg-gray-100 text-gray-600 text-[10px] font-black uppercase py-1.5 rounded">No</button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setAppState('login')} className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition"><LogOut size={16} /></button>
              <button onClick={() => setSidebarOpen(false)} className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition"><X size={16} /></button>
            </div>
          </div>

          <div className="p-4 bg-white border-b border-gray-200 shrink-0">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Destination</label>
                <div className="bg-gray-50 flex items-center border border-gray-200 rounded-lg p-2.5 focus-within:border-red-500 transition">
                  <Search className="text-red-500 mr-2 shrink-0" size={18} />
                  <input required type="text" value={destination} 
                    onChange={handleDestinationChange}
                    onFocus={() => destination.length > 2 && setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    placeholder="e.g. Orchard Gateway" className="bg-transparent w-full outline-none text-sm font-bold text-gray-800 placeholder-gray-400" />
                </div>
                {isDropdownOpen && suggestions.length > 0 && (
                  <ul className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto">
                    {suggestions.map((sugg, idx) => (
                      <li key={idx} onClick={() => selectSuggestion(sugg)}
                        className="px-4 py-3 hover:bg-red-50 cursor-pointer border-b border-gray-100 last:border-0 text-sm font-bold text-gray-700 flex items-center gap-2">
                        <MapPin size={14} className="text-red-400 flex-shrink-0" />
                        <span className="truncate">{sugg.formatted || sugg.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Duration</label>
                  <div className="bg-gray-50 flex items-center border border-gray-200 rounded-lg p-2.5">
                    <Calendar className="text-red-500 mr-2" size={16} />
                    <select className="bg-transparent w-full outline-none text-sm font-bold text-gray-800 appearance-none">
                      <option>1 Hour</option><option>2 Hours</option><option>3 Hours</option><option>4+ Hours</option>
                    </select>
                  </div>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-widest py-3 rounded-lg shadow-[0_4px_0_rgb(180,140,0)] active:shadow-none active:translate-y-1 transition text-sm disabled:opacity-50">
                {loading ? 'Searching...' : 'Find Parking'}
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50">
            {!hasSearched ? (
              <p className="text-sm text-gray-500 font-bold italic text-center py-8">Search for a destination to find nearby parking.</p>
            ) : (
              <div className="p-3 space-y-2">
                <div className="flex justify-between items-center px-1 border-b-2 border-dashed border-gray-200 pb-2 mb-1">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">{searchResults.length} nearby</span>
                </div>
                {searchResults.map(cp => {
                  const t = totals(cp.availability);
                  const isFav = favorites.has(cp.id);
                  return (
                    <div key={cp.id} onClick={() => selectCarpark(cp.id)}
                      className={`bg-white border-2 rounded-xl p-3 cursor-pointer transition-all duration-200 ${selectedId === cp.id ? 'border-red-600 shadow-lg ring-4 ring-red-100' : 'border-gray-100 hover:border-red-400'}`}>
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-gray-800 text-sm leading-tight truncate">{cp.name}</h3>
                          <p className="text-[10px] text-gray-400 truncate">{cp.address || cp.id}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <button onClick={e => toggleFav(e, cp.id)} className={`transition hover:scale-110 ${isFav ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}>
                            <Heart size={16} fill={isFav ? 'currentColor' : 'none'} strokeWidth={2.5} />
                          </button>
                          {t.total > 0 && (
                            <div className={`text-[10px] font-black px-1.5 py-0.5 rounded ${t.pct > 30 ? 'bg-green-100 text-green-700' : t.pct > 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {t.available}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-end mt-2">
                        <div className="flex-1 mr-3">
                          <AvailabilityBar available={t.total > 0 ? t.available : null} total={t.total || null} compact />
                        </div>
                        <div className="text-right shrink-0">
                          {cp.distance != null && (
                            <p className="text-xs font-bold text-gray-600 flex items-center justify-end gap-1">
                              <Navigation size={10} className="text-red-500" />
                              {cp.distance >= 1000 ? `${(cp.distance / 1000).toFixed(1)}km` : `${cp.distance}m`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)}
          className="absolute top-4 left-4 z-30 bg-neutral-900 text-white p-3 rounded-lg shadow-xl border-2 border-yellow-400 hover:bg-neutral-800 transition">
          <Menu size={20} />
        </button>
      )}

      <div className="flex-1 relative">
        <MapView carparks={allCarparks} selectedId={selectedId} destinationPoint={destinationPoint}
          hasSearched={hasSearched} onSelectCarpark={selectCarpark} userLocation={userLocation} />
      </div>

      {detail && (
        <div className="w-[360px] min-w-[320px] max-w-[400px] bg-white/95 backdrop-blur-sm border-l border-gray-200 flex flex-col z-20 shrink-0 overflow-y-auto">
          <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-3 flex items-center justify-between z-10">
            <button onClick={closeDetail} className="flex items-center gap-1 text-xs font-black text-gray-500 uppercase tracking-wider hover:text-red-600 transition">
              <ChevronLeft size={14} /> Back
            </button>
            <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-lg font-black text-gray-900 leading-tight">{detail.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{detail.address || detail.id} &middot; {detail.agency}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {detail.sources.map(s => (
                  <span key={s} className="text-[9px] font-black uppercase tracking-wider bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>

            {dt && dt.total > 0 && (
              <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="relative">
                  <CircularProgress percentage={dt.pct} size={90} stroke={10} />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{dt.available} <span className="text-sm font-bold text-gray-400">/ {dt.total}</span></p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Available</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">By Lot Type</h3>
              {Object.entries(detail.availability).map(([lt, e]) => {
                const Icon = LOT_ICONS[lt];
                return (
                  <div key={lt} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      {Icon && <Icon size={14} className="text-gray-500" />}
                      <span className="text-xs font-black text-gray-700">{LOT_LABELS[lt] ?? lt}</span>
                      {e.updatedAt && <span className="text-[9px] text-gray-400 ml-auto">{timeAgo(e.updatedAt)}</span>}
                    </div>
                    <AvailabilityBar available={e.available} total={e.total} />
                  </div>
                );
              })}
            </div>

            {detail.rates.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Parking Rates</h3>
                {Object.entries(
                  detail.rates.reduce((g, r) => { (g[r.dayType] ??= []).push(r); return g; }, {} as Record<string, typeof detail.rates>)
                ).map(([day, rates]) => (
                  <div key={day} className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">{DAY_LABELS[day] ?? day}</p>
                    {rates.map((r, i) => (
                      <div key={i} className="flex justify-between items-baseline py-0.5">
                        <span className="text-xs text-gray-700">
                          {r.isFirst ? 'First ' : ''}
                          {r.durationMins === 1440 ? 'per day' : r.durationMins === 60 ? 'per hr' : r.durationMins ? `per ${r.durationMins}min` : r.unit.replace(/_/g, ' ')}
                          {r.periodStart && <span className="text-gray-400 ml-1"> {r.periodStart} – {r.periodEnd}</span>}
                        </span>
                        <span className="text-sm font-black text-gray-900">${r.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    {rates[0]?.confirmedBy > 1 && <p className="text-[9px] text-green-600 font-bold mt-1">Confirmed by {rates[0].confirmedBy} sources</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="text-[10px] text-gray-400 space-y-0.5 pb-4">
              <p>Details: {timeAgo(detail.detailsUpdatedAt)}</p>
              <p>Availability: {timeAgo(detail.availabilityUpdatedAt)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
