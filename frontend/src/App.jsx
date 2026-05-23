import React, { useState, useEffect, useRef } from 'react';
import { Zap, Mail, Lock, User, ArrowRight, Heart, MapPin, LogOut, Clock, Navigation, Search, Calendar } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const MapCameraFlyer = ({ selectedId, results, hasSearched }) => {
  const map = useMap();

  useEffect(() => {
    if (hasSearched && selectedId) {
      const target = results.find(carpark => carpark.id === selectedId);
      if (target) {
        const targetPoint = map.project([target.lat, target.lng], 16);
        targetPoint.y -= 180; 
        const offsetLatLng = map.unproject(targetPoint, 16);

        map.flyTo(offsetLatLng, 16, {
          duration: 1.5,
          easeLinearity: 0.25
        });
      }
    } else if (hasSearched && !selectedId && results.length > 0) {
      map.flyTo([results[0].lat, results[0].lng], 14, { duration: 1.5 });
    }
  }, [selectedId, results, map, hasSearched]);

  return null;
};

const GoParkApp = () => {
  const [appState, setAppState] = useState('login'); 
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCarparkId, setSelectedCarparkId] = useState(null);
  
  const [favorites, setFavorites] = useState([]); 
  
  const markerRefs = useRef({});

  const mockResults = [
    { id: 1, name: "Century Square", price: 3.95, walkTime: 3, lots: 298, type: "Flat Rate", lat: 1.352, lng: 103.944, weekday: "$3.95 / entry", weekend: "$3.95 / entry" },
    { id: 2, name: "Tampines Plaza 1 & 2", price: 4.00, walkTime: 3, lots: 166, type: "Hourly", lat: 1.353, lng: 103.945, weekday: "$2.00 / 1st hr, $1.00 sub. 30min", weekend: "$2.50 / hr" },
    { id: 3, name: "NTUC Income Tampines", price: 4.00, walkTime: 4, lots: 86, type: "Hourly", lat: 1.351, lng: 103.943, weekday: "$2.00 / hr", weekend: "$2.00 / hr" }
  ];

  useEffect(() => {
    if (selectedCarparkId && markerRefs.current[selectedCarparkId]) {
      markerRefs.current[selectedCarparkId].openPopup();
    }
  }, [selectedCarparkId]);

  const getCustomPin = (isSelected) => {
    return L.divIcon({
      className: 'bg-transparent',
      html: `<div style="
        background-color: ${isSelected ? '#dc2626' : '#3b82f6'};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.4);
        transition: all 0.2s ease;
      "></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -32]
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setHasSearched(true);
    setSelectedCarparkId(mockResults[0].id);
  };

  const toggleFavorite = (e, carpark) => {
    e.stopPropagation(); 
    
    if (appState === 'guest') {
      alert("Please log in to save your favorite parking spots!");
      return;
    }

    const isAlreadyFav = favorites.find(fav => fav.id === carpark.id);
    
    if (isAlreadyFav) {
      setFavorites(favorites.filter(fav => fav.id !== carpark.id)); 
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
          <p className="text-yellow-400 font-bold tracking-widest uppercase text-xs mt-2">Smart parking. Fast.</p>
        </div>

        <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-red-600">
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-4 border-b-2 border-gray-100 pb-2">
              Driver Login
            </h2>
            <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3 focus-within:border-red-500 transition">
              <Mail className="text-gray-400 mr-3" size={18} />
              <input type="email" placeholder="Email Address" className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
            </div>
            <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3 focus-within:border-red-500 transition">
              <Lock className="text-gray-400 mr-3" size={18} />
              <input type="password" placeholder="Password" className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
            </div>
            <button 
              onClick={() => { setAppState('user'); setHasSearched(false); }}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition flex justify-center items-center gap-2 mt-2"
            >
              Log In <ArrowRight size={18} />
            </button>
            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-gray-200 flex-1"></div>
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">OR</span>
              <div className="h-px bg-gray-200 flex-1"></div>
            </div>
            <button 
              onClick={() => { setAppState('guest'); setHasSearched(false); }}
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
    <div className="flex h-[100dvh] bg-gray-100 font-sans overflow-hidden">
      
      {/* Left Sidebar */}
      <div className="w-full md:w-[420px] bg-white shadow-2xl flex flex-col z-20 border-r border-gray-200 h-full overflow-y-auto">
        
        {/* Navbar */}
        <div className="bg-neutral-900 p-4 flex justify-between items-center border-b-4 border-yellow-400 sticky top-0 z-30">
          <h1 className="text-xl font-black italic text-white flex items-center uppercase cursor-pointer" onClick={() => setHasSearched(false)}>
            GoPark <Zap className="text-yellow-400 fill-yellow-400 h-4 w-4 ml-1" />
          </h1>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</p>
              <p className={`text-xs font-bold ${appState === 'user' ? 'text-green-400' : 'text-yellow-400'}`}>
                {appState === 'user' ? 'User (Pro)' : 'Guest Driver'}
              </p>
            </div>
            <button onClick={() => setAppState('login')} className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Search Input Form */}
        <div className="p-5 bg-white border-b border-gray-200 shadow-sm relative z-10">
          <form onSubmit={handleSearch} className="space-y-4">
            
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Destination</label>
              <div className="bg-gray-50 flex items-center border border-gray-200 rounded-lg p-3 focus-within:border-red-500 transition">
                <Search className="text-red-500 mr-2" size={18} />
                <input required type="text" placeholder="e.g. Orchard Gateway" className="bg-transparent w-full outline-none text-sm font-bold text-gray-800 placeholder-gray-400" />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Arrival Time</label>
                <div className="bg-gray-50 flex items-center border border-gray-200 rounded-lg p-3 focus-within:border-red-500 transition">
                  <Clock className="text-red-500 mr-2" size={18} />
                  <input required type="time" defaultValue="14:00" className="bg-transparent w-full outline-none text-sm font-bold text-gray-800" />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Duration</label>
                <div className="bg-gray-50 flex items-center border border-gray-200 rounded-lg p-3 focus-within:border-red-500 transition">
                  <Calendar className="text-red-500 mr-2" size={18} />
                  <select className="bg-transparent w-full outline-none text-sm font-bold text-gray-800 appearance-none">
                    <option>1 Hour</option>
                    <option>2 Hours</option>
                    <option defaultValue>3 Hours</option>
                    <option>4+ Hours</option>
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-widest py-3.5 rounded-lg shadow-[0_4px_0_rgb(180,140,0)] active:shadow-none active:translate-y-1 transition text-sm">
              Find Parking
            </button>
          </form>
        </div>

        {/* Dynamic Area: Favorites OR Results */}
        {!hasSearched ? (
          <div className="p-5 flex-1 bg-gray-50">
            {appState === 'guest' ? (
              <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mt-4">
                <Heart className="text-gray-300 mx-auto mb-3" size={32} />
                <p className="text-sm font-bold text-gray-600 mb-4">Guests cannot save favorite spots.</p>
                <button onClick={() => setAppState('login')} className="bg-red-600 text-white text-xs font-black uppercase px-4 py-2 rounded shadow transition hover:bg-red-700">
                  Create Account
                </button>
              </div>
            ) : (
              <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm mt-4">
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Heart className="text-red-600 fill-red-600" size={16} /> Saved Lots
                </h2>
                
                {/* NEW: Dynamically render the favorites array */}
                {favorites.length === 0 ? (
                  <p className="text-sm text-gray-500 font-bold italic text-center py-4">No saved lots yet. Search for parking to add some!</p>
                ) : (
                  <div className="space-y-3">
                    {favorites.map((lot) => (
                      <div key={lot.id} className="border border-gray-200 rounded-lg p-3 flex justify-between items-center hover:border-red-400 cursor-pointer transition">
                        <div>
                          <h3 className="font-black text-gray-800 text-sm">{lot.name}</h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{lot.type}</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <button onClick={(e) => toggleFavorite(e, lot)} className="text-red-500 hover:scale-110 transition">
                             <Heart size={18} fill="currentColor" />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
 
          <div className="p-4 space-y-4 bg-gray-50 flex-1">
            <div className="flex justify-between items-center mb-2 px-1 border-b-2 border-dashed border-gray-200 pb-2">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">{mockResults.length} options found</span>
            </div>

            {mockResults.map((carpark) => {
        
              const isFav = favorites.some(fav => fav.id === carpark.id);
              
              return (
                <div 
                  key={carpark.id} 
                  onClick={() => setSelectedCarparkId(carpark.id)}
                  className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${
                    selectedCarparkId === carpark.id 
                      ? 'border-red-600 shadow-lg ring-4 ring-red-100 scale-[1.02]' 
                      : 'border-gray-100 hover:border-red-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black text-gray-800 text-md leading-tight w-3/4">{carpark.name}</h3>
                    
                    {/* NEW: Heart Fav Button inside the result card */}
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => toggleFavorite(e, carpark)} 
                        className={`transition hover:scale-110 ${isFav ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                        title={appState === 'guest' ? 'Login to save' : 'Toggle Favorite'}
                      >
                        <Heart size={20} fill={isFav ? "currentColor" : "none"} strokeWidth={2.5}/>
                      </button>
                      <div className="bg-yellow-400 text-gray-900 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">
                        {carpark.lots} LOTS
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end mt-3">
                    <div>
                      <p className="text-3xl font-black text-gray-900 tracking-tighter">${carpark.price.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{carpark.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-600 flex items-center justify-end gap-1 mb-1.5">
                         <Clock size={12} className="text-red-500"/> {carpark.walkTime} min walk
                      </p>
                      <button className="text-[10px] font-black uppercase tracking-wider text-gray-900 bg-yellow-400 hover:bg-yellow-500 px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-[0_3px_0_rgb(180,140,0)] active:shadow-none active:translate-y-1">
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

      {/* Right Map Area (Leaflet) */}
      <div className="hidden md:block flex-1 bg-gray-200 relative z-0">
        <MapContainer 
          center={[1.3521, 103.8198]} 
          zoom={11} 
          className="h-full w-full z-0"
          zoomSnap={0} 
          zoomDelta={0.5} 
          wheelPxPerZoomLevel={60} 
          zoomAnimation={true}
        >
          <MapCameraFlyer selectedId={selectedCarparkId} results={mockResults} hasSearched={hasSearched} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          {hasSearched && mockResults.map(carpark => (
            <Marker 
              key={carpark.id} 
              position={[carpark.lat, carpark.lng]}
              icon={getCustomPin(selectedCarparkId === carpark.id)}
              ref={(ref) => {
                if (ref) {
                  markerRefs.current[carpark.id] = ref;
                }
              }}
              eventHandlers={{
                click: () => setSelectedCarparkId(carpark.id),
              }}
            >
              <Popup>
                <div className="w-56 font-sans">
                  <h3 className="font-black text-lg text-gray-900 border-b-2 border-red-600 pb-1 mb-2">{carpark.name}</h3>
                  
                  <div className="space-y-1 text-sm text-gray-700 mb-3">
                    <p><span className="font-bold text-gray-900">Weekday:</span> {carpark.weekday}</p>
                    <p><span className="font-bold text-gray-900">Weekend:</span> {carpark.weekend}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-2 rounded-md border border-gray-200 mb-3">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Est. Total</p>
                    <p className="text-2xl font-black text-red-600">${carpark.price.toFixed(2)}</p>
                  </div>
                  
                  <button className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-wider py-2 rounded shadow-sm transition">
                    Route Me
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

    </div>
  );
};

export default GoParkApp;