import React, { useState, useRef, useEffect } from 'react';
import { Search, Clock, Navigation, ArrowLeft, Zap } from 'lucide-react';
// NEW: Imported useMap to control the camera
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'; 
import L from 'leaflet';

// NEW: This invisible component grabs the Leaflet map and flies the camera
const MapCameraFlyer = ({ selectedId, results }) => {
  const map = useMap();

  useEffect(() => {
    if (selectedId) {
      const target = results.find(carpark => carpark.id === selectedId);
      if (target) {
        // 1. Convert the target GPS coordinates to screen pixels at our target zoom level (16)
        const targetPoint = map.project([target.lat, target.lng], 16);
        
        // 2. Shift the target camera position UP by 180 pixels 
        // (This forces the pin to sit lower on your screen, making room for the popup)
        targetPoint.y -= 180; 
        
        // 3. Convert those shifted screen pixels back into GPS coordinates
        const offsetLatLng = map.unproject(targetPoint, 16);

        // 4. Fly to the new offset location!
        map.flyTo(offsetLatLng, 16, {
          duration: 1.5, 
          easeLinearity: 0.25
        });
      }
    }
  }, [selectedId, results, map]);

  return null;
};

const GoParkApp = () => {
  const [currentView, setCurrentView] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('price');
  const [selectedCarparkId, setSelectedCarparkId] = useState(null);

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

  if (currentView === 'search') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-neutral-900 p-4">
        <div className="max-w-md w-full text-center mb-8">
          <h1 className="text-6xl font-black text-white italic tracking-tight flex items-center justify-center gap-2 mb-2 uppercase drop-shadow-lg">
            Go<span className="text-red-600">Park</span> <Zap className="text-yellow-400 fill-yellow-400 h-10 w-10" />
          </h1>
          <p className="text-yellow-400 font-bold tracking-widest uppercase text-sm">Smart parking. Fast.</p>
        </div>

        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6 border-b-8 border-red-600 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] opacity-10"></div>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-black text-gray-800 uppercase tracking-widest mb-2">Destination</label>
              <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-red-500 transition border border-gray-200">
                <div className="pl-4 text-red-600"><Search size={20} /></div>
                <input 
                  type="text" 
                  placeholder="e.g. Orchard Gateway" 
                  className="w-full p-4 outline-none text-lg bg-transparent font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-black text-gray-800 uppercase tracking-widest mb-2">Arrival</label>
                 <div className="flex items-center bg-gray-100 border border-gray-200 rounded-xl p-3 focus-within:ring-2 focus-within:ring-red-500 transition">
                   <Clock size={18} className="text-red-600 mr-2" />
                   <input type="time" className="w-full outline-none bg-transparent font-medium" defaultValue="14:00" />
                 </div>
              </div>
              <div>
                 <label className="block text-xs font-black text-gray-800 uppercase tracking-widest mb-2">Duration</label>
                 <select className="w-full bg-gray-100 border border-gray-200 rounded-xl p-3 outline-none focus-within:ring-2 focus-within:ring-red-500 transition font-medium">
                   <option>1 Hour</option>
                   <option>2 Hours</option>
                   <option>3 Hours</option>
                   <option>Whole Day</option>
                 </select>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setCurrentView('results')}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-wider text-lg py-4 rounded-xl transition duration-200 shadow-[0_4px_0_rgb(180,140,0)] active:shadow-none active:translate-y-1"
          >
            Find Parking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      
      {/* Left Sidebar (Results) */}
      <div className="w-full md:w-[420px] bg-white shadow-2xl flex flex-col z-20 border-r border-gray-200">
        <div className="p-5 bg-red-600 border-b-4 border-yellow-400 flex flex-col justify-between sticky top-0 shadow-md">
          <button 
            onClick={() => setCurrentView('search')}
            className="flex items-center text-xs font-bold text-white/80 hover:text-white transition uppercase tracking-wider mb-3 w-fit"
          >
            <ArrowLeft size={16} className="mr-1" /> Back
          </button>
          <h2 className="font-black text-white text-xl flex items-center gap-2 uppercase tracking-wide">
             {searchQuery || "Nearby Parking"} <Zap size={20} className="text-yellow-400 fill-yellow-400"/>
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="flex justify-between items-center mb-5 px-1 border-b-2 border-dashed border-gray-200 pb-3">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">{mockResults.length} options</span>
            <div className="flex bg-gray-200 rounded-lg p-1 shadow-inner">
              <button onClick={() => setSortBy('price')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition ${sortBy === 'price' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>Cheapest</button>
              <button onClick={() => setSortBy('distance')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition ${sortBy === 'distance' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>Closest</button>
            </div>
          </div>

          <div className="space-y-4">
            {mockResults.map((carpark) => (
              <div 
                key={carpark.id} 
                onClick={() => setSelectedCarparkId(carpark.id)}
                className={`bg-white border-2 rounded-xl p-5 cursor-pointer group relative transition-all duration-200 ${
                  selectedCarparkId === carpark.id 
                    ? 'border-red-600 shadow-lg ring-4 ring-red-100 scale-[1.02]' 
                    : 'border-gray-100 hover:border-red-400 hover:shadow-md'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-black text-gray-800 text-lg leading-tight w-3/4">{carpark.name}</h3>
                  <div className="bg-yellow-400 text-gray-900 text-xs font-black px-2 py-1 rounded shadow-sm">
                    {carpark.lots} LOTS
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-4">
                  <div>
                    <p className="text-4xl font-black text-gray-900 tracking-tighter">${carpark.price.toFixed(2)}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{carpark.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-600 flex items-center justify-end gap-1 mb-2">
                       <Clock size={14} className="text-red-500"/> {carpark.walkTime} min walk
                    </p>
                    <button className="text-xs font-black uppercase tracking-wider text-gray-900 bg-yellow-400 hover:bg-yellow-500 px-4 py-2 rounded-lg transition flex items-center gap-1 shadow-[0_3px_0_rgb(180,140,0)] active:shadow-none active:translate-y-1">
                      <Navigation size={14} /> Route
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Main Area (Leaflet Map) */}
      <div className="hidden md:block flex-1 bg-gray-200 relative z-0">
        <MapContainer 
          center={[1.3521, 103.8198]} 
          zoom={11} 
          className="h-full w-full"
          zoomSnap={0} 
          zoomDelta={0.5} 
          wheelPxPerZoomLevel={60} 
          zoomAnimation={true}
        >
          {/* NEW: Here is the invisible camera flyer! */}
          <MapCameraFlyer selectedId={selectedCarparkId} results={mockResults} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          {mockResults.map(carpark => (
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
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Est. Total (3 Hours)</p>
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