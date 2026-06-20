import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Mail, Lock, User, ArrowRight, Heart, LogOut, Navigation, Search, Clock, Menu, X, ChevronLeft, Car, Bike, MapPin, Eye, EyeOff, Map, Moon, Sun, Truck } from 'lucide-react';
import { MapView } from './components/Map';
import { CircularProgress } from './components/CircularProgress';
import { AvailabilityBar } from './components/AvailabilityBar';
import { geocodeLocation, autocompleteLocation, reverseGeocode } from './providers/geoapify';
import { fetchAll, fetchNearby, fetchDetail, fetchAvailability } from './providers/carparks';
import type { CarparkSummary, CarparkDetail, DestinationPoint, AppState, PlaceSuggestion } from './types';
import { getWeatherByIP, getWeatherForCoords, getIconForWeather } from './providers/govsg';
import { loginUser, sendVerificationCode, verifyAndRegister, requestPasswordReset, resetPassword } from './providers/auth';
import { getRoute, type RouteResult } from './providers/google/routing';
import { getWalkRoute } from './providers/onemap/routing';
import { decodePolyline } from './utils/decodePolyline';
import { estimateCost } from './utils/estimateCost';
import { fetchFavorites, addFavorite, removeFavorite } from './providers/favorites';

const LOT_LABELS: Record<string, string> = { C: 'Car', Y: 'Motorcycle', H: 'Heavy Vehicle', S: 'Season' };
const LOT_ICONS: Record<string, typeof Car> = { C: Car, Y: Bike };
const DAY_LABELS: Record<string, string> = { weekday: 'Weekday', weekday_eve: 'Weekday Eve', saturday: 'Saturday', sunday: 'Sun / PH', all: 'All Days' };
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PASSWORD_ERROR = 'Password must be at least 8 characters and include both letters and numbers.';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function totals(avail: Record<string, { available: number | null; total: number | null }>) {
  const entries = Object.values(avail);
  const available = entries.reduce((sum, e) => sum + (e.available ?? 0), 0);
  const total = entries.reduce((sum, e) => sum + (e.total ?? 0), 0);
  const pct = total > 0 ? (available / total) * 100 : 0;
  return { available, total, pct };
}

function formatDuration(seconds: number) {
  if (seconds < 60) return '<1 min';
  return `${Math.round(seconds / 60)} min`;
}

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

function formatParkDuration(hours: number) {
  if (hours < 1) {
    return `${Math.round(hours * 60)} mins`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return m > 0 ? `${h}h ${m} mins` : `${h}h`;
}

export default function GoParkApp() {
  const [appState, setAppState] = useState<AppState>('login');
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
    return Math.max(0.5, (until.getTime() - now.getTime()) / 3600000);
  })();
  const [vehicleType, setVehicleType] = useState<string>('C');
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
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationShared, setLocationShared] = useState(false);
  const [showLocationTooltip, setShowLocationTooltip] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [weather, setWeather] = useState('Loading...');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [username, setUsername] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [showOtpView, setShowOtpView] = useState(false);
  const [otp, setOtp] = useState('');
  const [isResetView, setIsResetView] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isLinkSent, setIsLinkSent] = useState(false);

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('gopark_dark') === 'true');

  const [driveRoute, setDriveRoute] = useState<RouteResult | null>(null);
  const [drivePolyline, setDrivePolyline] = useState<[number, number][] | null>(null);
  const [walkRoute, setWalkRoute] = useState<RouteResult | null>(null);
  const [walkPolyline, setWalkPolyline] = useState<[number, number][] | null>(null);

  const destinationRef = useRef<DestinationPoint | null>(null);

  const enterApp = (data: { token: string; user: any }) => {
    localStorage.setItem('gopark_token', data.token);
    localStorage.setItem('gopark_user', JSON.stringify(data.user));
    setAppState('user');
    setHasSearched(false);
    fetchFavorites()
      .then(ids => setFavorites(new Set(ids)))
      .catch(() => {});
  };

  useEffect(() => {
    const token = localStorage.getItem('gopark_token');
    const savedUser = localStorage.getItem('gopark_user');
    if (token && savedUser) {
      setAppState('user');
      fetchFavorites()
        .then(ids => setFavorites(new Set(ids)))
        .catch(() => {});
    }
  }, []);
  useEffect(() => {
    getWeatherByIP().then(({ forecast }) => setWeather(forecast));
  }, []);

  useEffect(() => {
    fetchAll().then(setAllCarparks).catch(() => {});
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) setShowLocationTooltip(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (appState === 'login') return;
    const interval = setInterval(() => {
      fetchAvailability().then(({ carparks: avMap }) => {
        setAllCarparks(prev => prev.map(cp => avMap[cp.id] ? { ...cp, availability: avMap[cp.id] } : cp));
        setSearchResults(prev => prev.map(cp => avMap[cp.id] ? { ...cp, availability: avMap[cp.id] } : cp));
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [appState]);

  useEffect(() => {
    localStorage.setItem('gopark_dark', String(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const clearRoutes = useCallback(() => {
    setDriveRoute(null);
    setDrivePolyline(null);
    setWalkRoute(null);
    setWalkPolyline(null);
  }, []);

  const rankResults = useCallback((nearby: CarparkSummary[]) => {
    let filtered = nearby.filter(cp => {
      const avail = cp.availability[vehicleType];
      if (avail) return true;
      if (Object.keys(cp.availability).length === 0) return true;
      return false;
    });

    if (filtered.length === 0 && (vehicleType === 'C' || vehicleType === 'Y')) {
      filtered = nearby.filter(cp => {
        return cp.agency === 'HDB' || Object.keys(cp.availability).length === 0;
      });
    }

    let results = filtered.map(cp => {
      const cost = cp.rates ? estimateCost(cp.rates, durationHours, vehicleType) : null;
      return { ...cp, estimatedCost: cost };
    });

    if (maxPrice !== null) {
      results = results.filter(cp => {
        return cp.estimatedCost === null || cp.estimatedCost <= maxPrice;
      });
    }

    results.sort((a, b) => {
      const distA = a.distance ?? Infinity;
      const distB = b.distance ?? Infinity;
      if (distA !== distB) return distA - distB;
      const costA = a.estimatedCost ?? Infinity;
      const costB = b.estimatedCost ?? Infinity;
      return costA - costB;
    });

    return results.slice(0, 10);
  }, [vehicleType, durationHours, maxPrice]);

  useEffect(() => {
    if (!hasSearched || nearbyRaw.length === 0) return;
    setSearchResults(rankResults(nearbyRaw));
  }, [vehicleType, maxPrice, durationHours, nearbyRaw, hasSearched, rankResults]);

  const resetHome = () => {
    setHasSearched(false);
    setDestinationPoint(null);
    destinationRef.current = null;
    setDetail(null);
    setSelectedId(null);
    setNearbyRaw([]);
    clearRoutes();
  };

  const fetchRoutes = useCallback(async (carpark: CarparkSummary, dest: DestinationPoint) => {
    const cpCoord = { lat: carpark.lat, lng: carpark.lng };
    const destCoord = { lat: dest.lat, lng: dest.lng };
    const origin = startCoords || userLocation;

    const drivePromise = origin
      ? getRoute({ lat: origin[0], lng: origin[1] }, cpCoord, 'DRIVE')
          .then(r => { setDriveRoute(r); setDrivePolyline(decodePolyline(r.polyline)); })
          .catch(() => { setDriveRoute(null); setDrivePolyline(null); })
      : Promise.resolve((() => { setDriveRoute(null); setDrivePolyline(null); })());

    const walkPromise = getWalkRoute(cpCoord, destCoord)
      .then(r => { setWalkRoute(r); setWalkPolyline(decodePolyline(r.polyline)); })
      .catch(() => { setWalkRoute(null); setWalkPolyline(null); });

    await Promise.all([drivePromise, walkPromise]);
  }, [userLocation, startCoords]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);

    if (!isLoginView && !PASSWORD_REGEX.test(password)) {
      setAuthError(PASSWORD_ERROR);
      setIsLoggingIn(false);
      return;
    }

    try {
      if (isLoginView) {
        enterApp(await loginUser(email, password));
      } else {
        await sendVerificationCode(username, email, password);
        setShowOtpView(true);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);

    try {
      enterApp(await verifyAndRegister(email, otp));
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gopark_token');
    localStorage.removeItem('gopark_user');
    setAppState('login');
    setIsLoginView(true);
    setShowOtpView(false);
    setFavorites(new Set());
    resetHome();
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      await requestPasswordReset(email);
      setIsLinkSent(true);
    } catch (err: any) {
      setAuthError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!PASSWORD_REGEX.test(newPassword)) {
      setAuthError(PASSWORD_ERROR);
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, otp, newPassword);
      alert('Password updated successfully!');
      setIsResetView(false);
      setIsLinkSent(false);
      setIsLoginView(true);
      setOtp('');
      setNewPassword('');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        setLocationShared(true);
        setShowLocationTooltip(false);
        getWeatherForCoords(coords[0], coords[1]).then(setWeather);
      },
      () => setShowLocationTooltip(false)
    );
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

      const dest: DestinationPoint = { name: placeName, formatted: formattedAddress, lat, lng };
      setDestinationPoint(dest);
      destinationRef.current = dest;
      setDestination(formattedAddress || placeName);

      const nearby = await fetchNearby(lat, lng, 2000);
      setNearbyRaw(nearby);
      const ranked = rankResults(nearby);

      setSearchResults(ranked);
      setHasSearched(true);
      setDetail(null);

      if (ranked.length > 0) {
        const best = ranked[0];
        setSelectedId(best.id);
        fetchDetail(best.id).then(setDetail).catch(() => setDetail(null));
        fetchRoutes(best, dest);
      } else {
        setSelectedId(null);
        clearRoutes();
      }
    } catch { alert('Could not find destination'); }
    finally { setLoading(false); }
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

  const selectSuggestion = (sugg: PlaceSuggestion) => {
    const placeName = sugg.formatted || sugg.name || destination;
    setDestination(placeName);
    setIsDropdownOpen(false);
    executeSearch(placeName);
  };

  const selectCarpark = async (id: string) => {
    setSelectedId(id);
    fetchDetail(id).then(setDetail).catch(() => setDetail(null));

    const cp = searchResults.find(c => c.id === id) || allCarparks.find(c => c.id === id);
    if (!cp) return;

    const dest = destinationRef.current;
    if (dest) {
      fetchRoutes(cp, dest);
    } else {
      const origin = startCoords || userLocation;
      if (origin) {
        const cpCoord = { lat: cp.lat, lng: cp.lng };
        getRoute({ lat: origin[0], lng: origin[1] }, cpCoord, 'DRIVE')
          .then(r => { setDriveRoute(r); setDrivePolyline(decodePolyline(r.polyline)); })
          .catch(() => { setDriveRoute(null); setDrivePolyline(null); });
      }
      setWalkRoute(null);
      setWalkPolyline(null);
      setDestinationPoint({ lat: cp.lat, lng: cp.lng, name: cp.name, formatted: cp.address || cp.name });
      setHasSearched(true);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setSelectedId(null);
  };

  const toggleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (appState !== 'user') {
      alert('Log in to save favorites');
      return;
    }
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        removeFavorite(id).catch(() => {});
      } else {
        next.add(id);
        addFavorite(id).catch(() => {});
      }
      return next;
    });
  };

  const handleMapClick = async (latlng: { lat: number; lng: number }) => {
    setLoading(true);

    const place = await reverseGeocode(latlng.lat, latlng.lng);
    const placeName = place.name || `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
    const dest: DestinationPoint = {
      name: placeName,
      formatted: place.formatted || placeName,
      lat: latlng.lat,
      lng: latlng.lng,
    };

    setDestinationPoint(dest);
    destinationRef.current = dest;
    setDestination(placeName);

    try {
      const nearby = await fetchNearby(latlng.lat, latlng.lng, 2000);
      setNearbyRaw(nearby);
      const ranked = rankResults(nearby);
      setSearchResults(ranked);
      setHasSearched(true);
      setDetail(null);

      if (ranked.length > 0) {
        setSelectedId(ranked[0].id);
        fetchDetail(ranked[0].id)
          .then(setDetail)
          .catch(() => setDetail(null));
        fetchRoutes(ranked[0], dest);
      } else {
        setSelectedId(null);
        clearRoutes();
      }
    } catch {
    } finally {
      setLoading(false);
    }
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
          {isResetView ? (
            <div className="p-6 flex flex-col gap-3">
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-2 border-b-2 border-gray-100 pb-2">
                Reset Password
              </h2>

              {authError && <div className="text-red-600 bg-red-50 p-2 rounded text-sm font-bold border border-red-200">{authError}</div>}

              {!isLinkSent ? (
                <form onSubmit={handleRequestResetCode} className="flex flex-col gap-3">
                  <p className="text-xs font-bold text-gray-500">Enter your email and we'll send you a 6-digit reset code.</p>
                  <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
                    <Mail className="text-gray-400 mr-3 shrink-0" size={18} />
                    <input type="email" placeholder="Email Address" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" required />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition disabled:opacity-50">
                    {loading ? 'Sending...' : 'Send Reset Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
                  <p className="text-xs font-bold text-gray-500">
                    Enter the 6-digit code sent to <span className="text-gray-900">{email}</span> and choose a new password.
                  </p>
                  <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
                    <input type="text" inputMode="numeric" placeholder="000000" value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      maxLength={6} required
                      className="bg-transparent w-full outline-none text-center text-2xl font-black text-gray-800 tracking-[0.4em]" />
                  </div>
                  <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
                    <Lock className="text-gray-400 mr-3 shrink-0" size={18} />
                    <input type={showPassword ? "text" : "password"} placeholder="New Password" value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)} required
                      className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600 focus:outline-none ml-2 shrink-0 transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition disabled:opacity-50">
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              )}

              <button type="button"
                onClick={() => { setIsResetView(false); setIsLinkSent(false); setOtp(''); setNewPassword(''); setAuthError(''); }}
                className="text-[11px] text-gray-500 font-bold hover:text-red-600 transition text-center py-2">
                Back to Login
              </button>
            </div>
          ) : showOtpView ? (
            <div className="p-6 flex flex-col gap-3">
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-2 border-b-2 border-gray-100 pb-2">
                Verify Email
              </h2>
              <p className="text-xs font-bold text-gray-500 mb-2">
                We sent a 6-digit code to <span className="text-gray-900">{email}</span>.
              </p>

              <form onSubmit={handleVerify} className="flex flex-col gap-3">
                {authError && <div className="text-red-600 bg-red-50 p-2 rounded text-sm font-bold border border-red-200">{authError}</div>}
                <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
                  <input type="text" placeholder="000000" value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    maxLength={6} required
                    className="bg-transparent w-full outline-none text-center text-3xl font-black text-gray-800 tracking-[0.5em]" />
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                  <button type="submit" disabled={isLoggingIn}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition flex justify-center items-center gap-2 disabled:opacity-50">
                    {isLoggingIn ? 'Verifying...' : 'Verify & Enter'} <ArrowRight size={18} />
                  </button>
                  <button type="button" onClick={() => { setShowOtpView(false); setAuthError(''); setOtp(''); }}
                    className="text-[11px] text-gray-500 font-bold hover:text-red-600 transition text-center py-2">
                    Go back
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-6 flex flex-col gap-3">
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-2 border-b-2 border-gray-100 pb-2">
                {isLoginView ? 'Driver Login' : 'Create Account'}
              </h2>

              <form onSubmit={handleAuth} className="flex flex-col gap-3">
                {authError && <div className="text-red-600 bg-red-50 p-2 rounded text-sm font-bold border border-red-200">{authError}</div>}

                {!isLoginView && (
                  <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
                    <User className="text-gray-400 mr-3 shrink-0" size={18} />
                    <input type="text" placeholder="Username" value={username}
                      onChange={(e) => setUsername(e.target.value)} required
                      className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
                  </div>
                )}

                <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
                  <Mail className="text-gray-400 mr-3 shrink-0" size={18} />
                  <input type="email" placeholder="Email Address" value={email}
                    onChange={(e) => setEmail(e.target.value)} required
                    className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
                </div>

                <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
                  <Lock className="text-gray-400 mr-3 shrink-0" size={18} />
                  <input type={showPassword ? "text" : "password"} placeholder="Password" value={password}
                    onChange={(e) => setPassword(e.target.value)} required
                    className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none ml-2 shrink-0 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  <button type="submit" disabled={isLoggingIn}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition flex justify-center items-center gap-2 disabled:opacity-50">
                    {isLoggingIn ? 'Processing...' : (isLoginView ? 'Log In' : 'Sign Up')} <ArrowRight size={18} />
                  </button>

                  <button type="button" onClick={() => { setIsLoginView(!isLoginView); setAuthError(''); }}
                    className="text-[11px] text-gray-500 font-bold hover:text-red-600 transition text-center py-2">
                    {isLoginView ? "Don't have an account? Sign up" : "Already have an account? Log in"}
                  </button>

                  {isLoginView && (
                    <button type="button" onClick={() => setIsResetView(true)}
                      className="text-[11px] text-red-600 font-bold hover:text-red-800 transition text-center">
                      Forgot Password?
                    </button>
                  )}
                </div>
              </form>

              <button onClick={() => { setAppState('guest'); setHasSearched(false); }}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-widest py-3 rounded shadow-sm transition flex justify-center items-center gap-2 mt-1">
                Continue as Guest <User size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const dt = detail ? totals(detail.availability) : null;
  const driveSecs = driveRoute ? parseInt(driveRoute.duration.replace('s', '')) : 0;
  const walkSecs = walkRoute ? parseInt(walkRoute.duration.replace('s', '')) : 0;

  return (
    <div className={`flex h-[100dvh] font-sans overflow-hidden ${darkMode ? 'dark' : ''}`}>

      {sidebarOpen && (
        <div className={`w-[400px] min-w-[360px] max-w-[440px] flex flex-col z-20 shrink-0 ${darkMode ? 'bg-neutral-900 border-r border-neutral-700' : 'bg-white border-r border-gray-200'}`}>
          <div className="bg-neutral-900 p-3 flex items-center gap-2 border-b-4 border-yellow-400 shrink-0">
            <h1 className="text-lg font-black italic text-white flex items-center uppercase cursor-pointer shrink-0" onClick={resetHome}>
              GoPark <Zap className="text-yellow-400 fill-yellow-400 h-4 w-4 ml-1" />
            </h1>
            <div className="relative flex items-center min-w-0 flex-1" ref={tooltipRef}>
              <button onClick={() => { if (!locationShared) setShowLocationTooltip(v => !v); }}
                className={`text-[10px] font-black px-2 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 transition cursor-pointer max-w-full ${locationShared ? 'bg-green-600/20 text-green-400 border border-green-600/40' : 'bg-gray-800 text-yellow-400 border border-gray-700 hover:border-yellow-400/50'}`}>
                <WeatherIcon size={14} className="shrink-0" /><span className="truncate">{weather}</span>
              </button>
              {showLocationTooltip && (
                <div className="animate-pop-in absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-64 z-50">
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-100 rotate-45" />
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <span className="absolute inset-0 rounded-full bg-red-400 location-ping" />
                      <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white">
                        <Navigation size={15} className="fill-white" />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-800 leading-tight">Use your location?</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Weather and carparks for exactly where you are.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={shareLocation} className="flex-1 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[11px] font-black uppercase tracking-wide py-2 rounded-xl shadow-sm hover:shadow-md hover:brightness-110 active:scale-95 transition">Allow</button>
                    <button onClick={() => setShowLocationTooltip(false)} className="px-3 bg-gray-100 text-gray-500 text-[11px] font-black uppercase tracking-wide py-2 rounded-xl hover:bg-gray-200 active:scale-95 transition">Not now</button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setDarkMode(v => !v)} className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition" title="Toggle Dark Mode">
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button onClick={handleLogout} className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition" title="Log Out">
                <LogOut size={16} />
              </button>
              <button onClick={() => setSidebarOpen(false)} className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition"><X size={16} /></button>
            </div>
          </div>

          <div className={`p-4 border-b shrink-0 ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-gray-200'}`}>
            <form onSubmit={(e) => { e.preventDefault(); executeSearch(destination); }} className="space-y-3">
              <div className="relative">
                <label className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Start Point</label>
                <div className={`flex items-center rounded-lg p-2.5 transition ${darkMode ? 'bg-neutral-800 border border-neutral-600' : 'bg-gray-50 border border-gray-200'} ${startCoords ? 'border-green-500' : 'focus-within:border-blue-500'}`}>
                  <Navigation className={`mr-2 shrink-0 ${startCoords ? 'text-green-500' : 'text-blue-500'}`} size={16} />
                  <input type="text" value={startPoint}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setStartPoint(val);
                      if (!val) { setStartCoords(null); setStartSuggestions([]); setStartDropdownOpen(false); return; }
                      if (val.length > 2) {
                        const suggs = await autocompleteLocation(val);
                        setStartSuggestions(suggs);
                        setStartDropdownOpen(true);
                      }
                    }}
                    onFocus={() => startPoint.length > 2 && setStartDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setStartDropdownOpen(false), 200)}
                    placeholder={locationShared ? 'Using your location' : 'Optional — set a start point'}
                    className={`bg-transparent w-full outline-none text-sm font-bold placeholder-gray-400 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`} />
                  {startCoords && (
                    <button type="button" onClick={() => { setStartPoint(''); setStartCoords(null); }}
                      className="text-gray-400 hover:text-red-500 ml-1 shrink-0"><X size={14} /></button>
                  )}
                </div>
                {startDropdownOpen && startSuggestions.length > 0 && (
                  <ul className={`absolute top-full left-0 w-full mt-1 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto ${darkMode ? 'bg-neutral-800 border border-neutral-600' : 'bg-white border border-gray-200'}`}>
                    {startSuggestions.map((sugg, idx) => (
                      <li key={idx} onClick={() => {
                        setStartPoint(sugg.formatted || sugg.name || '');
                        setStartCoords([sugg.lat, sugg.lon]);
                        setStartDropdownOpen(false);
                      }}
                        className={`px-4 py-3 cursor-pointer last:border-0 text-sm font-bold flex items-center gap-2 ${darkMode ? 'hover:bg-neutral-700 border-b border-neutral-700 text-gray-200' : 'hover:bg-blue-50 border-b border-gray-100 text-gray-700'}`}>
                        <MapPin size={14} className="text-blue-400 flex-shrink-0" />
                        <span className="truncate">{sugg.formatted || sugg.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="relative">
                <label className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Destination</label>
                <div className={`flex items-center rounded-lg p-2.5 focus-within:border-red-500 transition ${darkMode ? 'bg-neutral-800 border border-neutral-600' : 'bg-gray-50 border border-gray-200'}`}>
                  <Search className="text-red-500 mr-2 shrink-0" size={18} />
                  <input required type="text" value={destination}
                    onChange={handleDestinationChange}
                    onFocus={() => destination.length > 2 && setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    placeholder="e.g. Orchard Gateway" className={`bg-transparent w-full outline-none text-sm font-bold placeholder-gray-400 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`} />
                </div>
                {isDropdownOpen && suggestions.length > 0 && (
                  <ul className={`absolute top-full left-0 w-full mt-1 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto ${darkMode ? 'bg-neutral-800 border border-neutral-600' : 'bg-white border border-gray-200'}`}>
                    {suggestions.map((sugg, idx) => (
                      <li key={idx} onClick={() => selectSuggestion(sugg)}
                        className={`px-4 py-3 cursor-pointer last:border-0 text-sm font-bold flex items-center gap-2 ${darkMode ? 'hover:bg-neutral-700 border-b border-neutral-700 text-gray-200' : 'hover:bg-red-50 border-b border-gray-100 text-gray-700'}`}>
                        <MapPin size={14} className="text-red-400 flex-shrink-0" />
                        <span className="truncate">{sugg.formatted || sugg.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Park Until</label>
                <div className="flex gap-2 items-center">
                  <div className={`flex-1 flex items-center rounded-lg p-2.5 focus-within:border-red-500 transition ${darkMode ? 'bg-neutral-800 border border-neutral-600' : 'bg-gray-50 border border-gray-200'}`}>
                    <Clock className="text-red-500 mr-2 shrink-0" size={16} />
                    <input type="time" value={parkUntil} onChange={(e) => setParkUntil(e.target.value)}
                      className={`bg-transparent w-full outline-none text-sm font-bold cursor-pointer ${darkMode ? 'text-gray-100' : 'text-gray-800'}`} />
                  </div>
                  <div className={`shrink-0 text-center rounded-lg px-3 py-2 ${darkMode ? 'bg-neutral-800 border border-neutral-600' : 'bg-blue-50 border border-blue-200'}`}>
                    <p className={`text-sm font-black ${darkMode ? 'text-gray-100' : 'text-blue-700'}`}>
                      {formatParkDuration(durationHours)}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Vehicle</label>
                <div className="flex gap-1.5">
                  {([['C', Car, 'Car'], ['Y', Bike, 'Motorcycle'], ['H', Truck, 'Heavy']] as const).map(([code, Icon, label]) => (
                    <button key={code} type="button" onClick={() => setVehicleType(code)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-[10px] font-black uppercase tracking-wider transition ${
                        vehicleType === code
                          ? 'bg-red-600 border-red-600 text-white'
                          : darkMode ? 'bg-neutral-800 border-neutral-600 text-gray-300 hover:border-red-400' : 'bg-white border-gray-200 text-gray-500 hover:border-red-400'
                      }`}>
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Max Budget {maxPrice !== null ? `— $${maxPrice}` : '— Any'}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[null, 3, 5, 10, 20].map(price => (
                    <button key={String(price)} type="button" onClick={() => setMaxPrice(price)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-[10px] font-black transition ${
                        maxPrice === price
                          ? 'bg-green-600 border-green-600 text-white'
                          : darkMode ? 'bg-neutral-800 border-neutral-600 text-gray-300 hover:border-green-400' : 'bg-white border-gray-200 text-gray-500 hover:border-green-400'
                      }`}>
                      {price === null ? 'Any' : `≤$${price}`}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-widest py-3 rounded-lg shadow-[0_4px_0_rgb(180,140,0)] active:shadow-none active:translate-y-1 transition text-sm disabled:opacity-50">
                {loading ? 'Searching...' : 'Find Parking'}
              </button>
            </form>
          </div>

          <div className={`flex-1 overflow-y-auto ${darkMode ? 'bg-neutral-800' : 'bg-gray-50'}`}>
            {appState === 'user' && (
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

            {sidebarTab === 'favorites' && appState === 'user' ? (
              <div className="p-3 space-y-2">
                {(() => {
                  const favCarparks = allCarparks.filter(cp => favorites.has(cp.id));
                  if (favCarparks.length === 0) return (
                    <p className={`text-sm font-bold italic text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No favorites yet. Tap the heart on any carpark to save it.</p>
                  );
                  return favCarparks.map(cp => {
                    const t = totals(cp.availability);
                    return (
                      <div key={cp.id} onClick={() => selectCarpark(cp.id)}
                        className={`border-2 rounded-xl p-3 cursor-pointer transition-all duration-200 ${
                          selectedId === cp.id
                            ? darkMode ? 'bg-neutral-700 border-blue-500 shadow-lg ring-4 ring-blue-500/20' : 'bg-white border-red-600 shadow-lg ring-4 ring-red-100'
                            : darkMode ? 'bg-neutral-800 border-neutral-700 hover:border-blue-400' : 'bg-white border-gray-100 hover:border-red-400'
                        }`}>
                        <div className="flex justify-between items-start mb-1.5">
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-black text-sm leading-tight truncate ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{cp.name}</h3>
                            <p className={`text-[10px] truncate ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{cp.address || cp.id}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <button onClick={e => toggleFav(e, cp.id)} className="text-red-500 transition hover:scale-110">
                              <Heart size={16} fill="currentColor" strokeWidth={2.5} />
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
                          <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                            {cp.estimatedCost != null && (
                              <span className="text-xs font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                ~${cp.estimatedCost.toFixed(2)}
                              </span>
                            )}
                            {cp.distance != null && (
                              <p className={`text-xs font-bold flex items-center justify-end gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                <Navigation size={10} className="text-red-500" />
                                {formatDistance(cp.distance)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (<>
            {(driveRoute || walkRoute) && (
              <div className={`flex gap-2 p-3 border-b ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-gray-200'}`}>
                {driveRoute && (
                  <div className={`flex-1 rounded-lg p-2 text-center ${darkMode ? 'bg-neutral-800 border border-neutral-600' : 'bg-gray-50 border border-gray-200'}`}>
                    <p className={`text-sm font-black ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{formatDuration(driveSecs)}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Drive</p>
                    <p className="text-[9px] text-gray-400">{formatDistance(driveRoute.distanceMeters)}</p>
                  </div>
                )}
                {walkRoute && (
                  <div className={`flex-1 rounded-lg p-2 text-center ${darkMode ? 'bg-blue-950 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
                    <p className={`text-sm font-black ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{formatDuration(walkSecs)}</p>
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${darkMode ? 'text-blue-400' : 'text-blue-400'}`}>Walk</p>
                    <p className={`text-[9px] ${darkMode ? 'text-blue-400' : 'text-blue-400'}`}>{formatDistance(walkRoute.distanceMeters)}</p>
                  </div>
                )}
                {driveRoute && (
                  <div className={`flex-1 border rounded-lg p-2 text-center ${
                    driveRoute.trafficCondition === 'HEAVY' ? 'bg-red-50 border-red-200' :
                    driveRoute.trafficCondition === 'MODERATE' ? 'bg-amber-50 border-amber-200' :
                    'bg-green-50 border-green-200'
                  }`}>
                    <p className={`text-[10px] font-black ${
                      driveRoute.trafficCondition === 'HEAVY' ? 'text-red-600' :
                      driveRoute.trafficCondition === 'MODERATE' ? 'text-amber-600' :
                      'text-green-600'
                    }`}>{driveRoute.trafficCondition}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Traffic</p>
                  </div>
                )}
              </div>
            )}
            {!hasSearched ? (
              <p className={`text-sm font-bold italic text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Search for a destination to find nearby parking.</p>
            ) : (() => {
              const withAvail = searchResults.filter(cp => Object.keys(cp.availability).length > 0);
              const noAvail = searchResults.filter(cp => Object.keys(cp.availability).length === 0);
              const showing = resultTab === 'avail' ? withAvail : noAvail;
              return (
              <div className="p-3 space-y-2">
                <div className={`flex items-center gap-1 pb-2 mb-1 border-b-2 border-dashed ${darkMode ? 'border-neutral-600' : 'border-gray-200'}`}>
                  <button onClick={() => setResultTab('avail')}
                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition ${
                      resultTab === 'avail'
                        ? 'bg-green-600 text-white'
                        : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-700'
                    }`}>
                    Available ({withAvail.length})
                  </button>
                  <button onClick={() => setResultTab('other')}
                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition ${
                      resultTab === 'other'
                        ? 'bg-gray-500 text-white'
                        : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-700'
                    }`}>
                    No Data ({noAvail.length})
                  </button>
                  <span className={`text-[9px] font-bold ml-auto ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {formatParkDuration(durationHours)} &middot; {LOT_LABELS[vehicleType] || vehicleType}
                  </span>
                </div>
                {showing.map(cp => {
                  const vAvail = cp.availability[vehicleType];
                  const t = vAvail ? { available: vAvail.available ?? 0, total: vAvail.total ?? 0, pct: (vAvail.total ?? 0) > 0 ? ((vAvail.available ?? 0) / (vAvail.total ?? 1)) * 100 : 0 } : totals(cp.availability);
                  const isFav = favorites.has(cp.id);
                  return (
                    <div key={cp.id} onClick={() => selectCarpark(cp.id)}
                      className={`border-2 rounded-xl p-3 cursor-pointer transition-all duration-200 ${
                        selectedId === cp.id
                          ? darkMode ? 'bg-neutral-700 border-blue-500 shadow-lg ring-4 ring-blue-500/20' : 'bg-white border-red-600 shadow-lg ring-4 ring-red-100'
                          : darkMode ? 'bg-neutral-800 border-neutral-700 hover:border-blue-400' : 'bg-white border-gray-100 hover:border-red-400'
                      }`}>
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-black text-sm leading-tight truncate ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{cp.name}</h3>
                          <p className={`text-[10px] truncate ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{cp.address || cp.id}</p>
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
                        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                          {cp.estimatedCost != null && (
                            <span className="text-xs font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                              ~${cp.estimatedCost.toFixed(2)}
                            </span>
                          )}
                          {cp.distance != null && (
                            <p className={`text-xs font-bold flex items-center justify-end gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              <Navigation size={10} className="text-red-500" />
                              {formatDistance(cp.distance)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
            </>)}
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
          hasSearched={hasSearched} onSelectCarpark={selectCarpark} userLocation={userLocation}
          drivePolyline={drivePolyline} driveRoute={driveRoute}
          walkPolyline={walkPolyline} walkRoute={walkRoute} startCoords={startCoords} sidebarOpen={sidebarOpen}
          eventHandlers={{ onMapClick: handleMapClick }} />
      </div>

      {detail && (
        <div className={`w-[360px] min-w-[320px] max-w-[400px] backdrop-blur-sm flex flex-col z-20 shrink-0 overflow-y-auto ${darkMode ? 'bg-neutral-900/95 border-l border-neutral-700' : 'bg-white/95 border-l border-gray-200'}`}>
          <div className={`sticky top-0 backdrop-blur-sm p-3 flex items-center justify-between z-10 ${darkMode ? 'bg-neutral-900/95 border-b border-neutral-700' : 'bg-white/95 border-b border-gray-200'}`}>
            <button onClick={closeDetail} className={`flex items-center gap-1 text-xs font-black uppercase tracking-wider transition ${darkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-600'}`}>
              <ChevronLeft size={14} /> Back
            </button>
            <button onClick={closeDetail} className={darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}><X size={16} /></button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <h2 className={`text-lg font-black leading-tight ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{detail.name}</h2>
              <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{detail.address || detail.id} &middot; {detail.agency}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {detail.sources.map(s => (
                  <span key={s} className="text-[9px] font-black uppercase tracking-wider bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(detail.address || detail.name + ' Singapore')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-black text-[10px] uppercase tracking-widest py-2 rounded-lg flex items-center justify-center gap-1.5 transition">
                  <Map size={14} /> Google Maps
                </a>
                <a href={`https://waze.com/ul?q=${encodeURIComponent(detail.address || detail.name + ' Singapore')}&navigate=yes`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 border border-cyan-200 font-black text-[10px] uppercase tracking-widest py-2 rounded-lg flex items-center justify-center gap-1.5 transition">
                  <Navigation size={14} /> Waze
                </a>
              </div>
            </div>

            {dt && dt.total > 0 && (
              <div className={`flex items-center gap-4 p-4 rounded-xl border shadow-sm ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'}`}>
                <div className="relative">
                  <CircularProgress percentage={dt.pct} size={90} stroke={10} />
                </div>
                <div>
                  <p className={`text-2xl font-black ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{dt.available} <span className={`text-sm font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>/ {dt.total}</span></p>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Available</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>By Lot Type</h3>
              {Object.entries(detail.availability).map(([lt, e]) => {
                const Icon = LOT_ICONS[lt];
                return (
                  <div key={lt} className={`rounded-lg border p-3 ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {Icon && <Icon size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />}
                      <span className={`text-xs font-black ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{LOT_LABELS[lt] ?? lt}</span>
                      {e.updatedAt && <span className={`text-[9px] ml-auto ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{timeAgo(e.updatedAt)}</span>}
                    </div>
                    <AvailabilityBar available={e.available} total={e.total} />
                  </div>
                );
              })}
            </div>

            {detail.rates.length > 0 && (
              <div className="space-y-2">
                <h3 className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Parking Rates</h3>
                {Object.entries(
                  detail.rates.reduce((g, r) => { (g[r.dayType] ??= []).push(r); return g; }, {} as Record<string, typeof detail.rates>)
                ).map(([day, rates]) => (
                  <div key={day} className={`rounded-lg border p-3 ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'}`}>
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">{DAY_LABELS[day] ?? day}</p>
                    {rates.map((r, i) => (
                      <div key={i} className="flex justify-between items-baseline py-0.5">
                        <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {r.isFirst ? 'First ' : ''}
                          {r.durationMins === 1440 ? 'per day' : r.durationMins === 60 ? 'per hr' : r.durationMins ? `per ${r.durationMins}min` : r.unit.replace(/_/g, ' ')}
                          {r.periodStart && <span className={darkMode ? 'text-gray-500 ml-1' : 'text-gray-400 ml-1'}> {r.periodStart} – {r.periodEnd}</span>}
                        </span>
                        <span className={`text-sm font-black ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>${r.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    {rates[0]?.confirmedBy > 1 && <p className="text-[9px] text-green-600 font-bold mt-1">Confirmed by {rates[0].confirmedBy} sources</p>}
                  </div>
                ))}
              </div>
            )}

            <div className={`text-[10px] space-y-0.5 pb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              <p>Details: {timeAgo(detail.detailsUpdatedAt)}</p>
              <p>Availability: {timeAgo(detail.availabilityUpdatedAt)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
