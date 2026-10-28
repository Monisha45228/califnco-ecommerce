import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Check, X, Loader2 } from 'lucide-react';
import L from 'leaflet';

interface MapAddressPickerProps {
  initialAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
  };
  onSave: (address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  }) => void;
  onClose: () => void;
}

export const MapAddressPicker: React.FC<MapAddressPickerProps> = ({
  initialAddress,
  onSave,
  onClose
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: initialAddress?.latitude || 20.5937,
    lng: initialAddress?.longitude || 78.9629
  });

  const [street, setStreet] = useState(initialAddress?.street || '');
  const [city, setCity] = useState(initialAddress?.city || '');
  const [state, setState] = useState(initialAddress?.state || '');
  const [postalCode, setPostalCode] = useState(initialAddress?.postalCode || '');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Custom Blue Leaflet Pin
    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="background-color: #0284c7; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 3px solid white;">
               <div style="background-color: white; width: 10px; height: 10px; border-radius: 50%; transform: rotate(45deg);"></div>
             </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const map = L.map(mapContainerRef.current).setView([coords.lat, coords.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([coords.lat, coords.lng], {
      icon: customIcon,
      draggable: true
    }).addTo(map);

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      setCoords({ lat: position.lat, lng: position.lng });
      reverseGeocode(position.lat, position.lng);
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const reverseGeocode = async (lat: number, lng: number) => {
    setIsLoadingAddress(true);
    setAddressError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      if (!res.ok) throw new Error(`Address lookup failed (HTTP ${res.status}). Enter the address manually.`);
      const data = await res.json();
      const addr = data.address || {};
      if (addr.road || addr.suburb) {
        setStreet([addr.building, addr.road, addr.suburb].filter(Boolean).join(', '));
      }
      if (addr.city || addr.town || addr.village) {
        setCity(addr.city || addr.town || addr.village);
      }
      if (addr.state) {
        setState(addr.state);
      }
      if (addr.postcode) {
        setPostalCode(addr.postcode);
      }
    } catch (error) {
      setAddressError(error instanceof Error
        ? `${error.message} You can still enter the address manually.`
        : 'Address lookup failed. You can still enter the address manually.');
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setAddressError('Location is not available in this browser. Enter the address manually.');
      return;
    }
    setAddressError('');
    setIsLoadingAddress(true);
    navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          if (mapInstanceRef.current && markerRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 15);
            markerRef.current.setLatLng([lat, lng]);
          }
          reverseGeocode(lat, lng);
        },
        (err) => {
          setIsLoadingAddress(false);
          setAddressError(err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Enter the address manually or allow location access in your browser.'
            : 'Unable to get your location. Enter the address manually and try again.');
        }
      );
  };

  const handleSave = () => {
    if (!street.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      setAddressError('Enter a street, city, state, and postal code before saving.');
      return;
    }
    onSave({
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
      latitude: coords.lat,
      longitude: coords.lng
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Select Delivery Location</h3>
              <p className="text-[10px] text-slate-500">OpenStreetMap Interactive Address Pin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map Container */}
        <div className="relative h-56 w-full bg-slate-200">
          <div ref={mapContainerRef} className="h-full w-full z-0" />
          
          {/* Current Location GPS Button */}
          <button
            onClick={handleUseCurrentLocation}
            className="absolute bottom-3 right-3 z-10 px-3 py-1.5 bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center space-x-1 hover:bg-slate-50"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Locate Me</span>
          </button>

          {isLoadingAddress && (
            <div className="absolute top-3 left-3 z-10 px-2.5 py-1 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow text-[10px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 backdrop-blur-sm">
              <Loader2 className="w-3 h-3 animate-spin text-sky-600" />
              <span>Fetching street address...</span>
            </div>
          )}
        </div>

        {/* Address Inputs Form */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {addressError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">{addressError}</p>}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Street / Flat / Landmark</label>
            <input
              type="text"
              value={street}
              onChange={e => setStreet(e.target.value)}
              className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">State</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Pincode</label>
              <input
                type="text"
                value={postalCode}
                onChange={e => setPostalCode(e.target.value)}
                className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer Confirm */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-md shadow-sky-600/30"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirm Delivery Address</span>
          </button>
        </div>
      </div>
    </div>
  );
};
