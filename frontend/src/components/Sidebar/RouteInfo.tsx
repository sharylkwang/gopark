import { MapPin } from 'lucide-react';
import { formatDuration, formatDistance, parseDurationSecs } from '../../utils/format';
import type { RouteResult } from '../../providers/google/routing';
import type { DestinationPoint } from '../../types';

interface Props {
  darkMode: boolean;
  driveRoute: RouteResult | null;
  walkRoute: RouteResult | null;
  destinationPoint: DestinationPoint | null;
  hasSearched: boolean;
}

export function RouteInfo({ darkMode, driveRoute, walkRoute, destinationPoint, hasSearched }: Props) {
  const dm = darkMode;
  const driveSecs = driveRoute ? parseDurationSecs(driveRoute.duration) : 0;
  const walkSecs = walkRoute ? parseDurationSecs(walkRoute.duration) : 0;
<<<<<<< HEAD

  return (
    <>
      {(driveRoute || walkRoute) && (
        <div className={`flex gap-2 p-3 border-b ${dm ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-gray-200'}`}>
          {driveRoute && (
            <div className={`flex-1 rounded-lg p-2 text-center ${dm ? 'bg-neutral-800 border border-neutral-600' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-sm font-black ${dm ? 'text-gray-100' : 'text-gray-900'}`}>{formatDuration(driveSecs)}</p>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Drive</p>
              <p className="text-[9px] text-gray-400">{formatDistance(driveRoute.distanceMeters)}</p>
            </div>
          )}
          {walkRoute && (
            <div className={`flex-1 rounded-lg p-2 text-center ${dm ? 'bg-blue-950 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
              <p className={`text-sm font-black ${dm ? 'text-blue-300' : 'text-blue-700'}`}>{formatDuration(walkSecs)}</p>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${dm ? 'text-blue-400' : 'text-blue-400'}`}>Walk</p>
              <p className={`text-[9px] ${dm ? 'text-blue-400' : 'text-blue-400'}`}>{formatDistance(walkRoute.distanceMeters)}</p>
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
                driveRoute.trafficCondition === 'MODERATE' ? 'text-amber-600' : 'text-green-600'
              }`}>{driveRoute.trafficCondition}</p>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Traffic</p>
=======
  const hasRoutes = driveRoute || walkRoute;
  const hasClassification = hasSearched && destinationPoint?.classification?.type;

  if (!hasRoutes && !hasClassification) return null;

  return (
    <div className={`shrink-0 px-3 py-2 border-b ${dm ? 'border-neutral-700/40' : 'border-gray-200/30'}`}>
      {hasRoutes && (
        <div className="flex gap-1.5">
          {driveRoute && (
            <div className={`flex-1 rounded-xl px-2 py-1.5 text-center ${dm ? 'bg-neutral-800/50 border border-neutral-600/40' : 'bg-white/40 border border-gray-200/40'}`}>
              <p className={`text-xs font-black ${dm ? 'text-gray-100' : 'text-gray-900'}`}>{formatDuration(driveSecs)}</p>
              <p className={`text-[8px] font-bold uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Drive · {formatDistance(driveRoute.distanceMeters)}</p>
            </div>
          )}
          {walkRoute && (
            <div className={`flex-1 rounded-xl px-2 py-1.5 text-center ${dm ? 'bg-blue-950/40 border border-blue-800/40' : 'bg-blue-50/50 border border-blue-200/40'}`}>
              <p className={`text-xs font-black ${dm ? 'text-blue-300' : 'text-blue-700'}`}>{formatDuration(walkSecs)}</p>
              <p className={`text-[8px] font-bold uppercase tracking-widest ${dm ? 'text-blue-400' : 'text-blue-400'}`}>Walk · {formatDistance(walkRoute.distanceMeters)}</p>
            </div>
          )}
          {driveRoute && (
            <div className={`shrink-0 rounded-xl px-2 py-1.5 text-center border ${
              driveRoute.trafficCondition === 'HEAVY' ? dm ? 'bg-red-950/40 border-red-800/40' : 'bg-red-50/50 border-red-200/40' :
              driveRoute.trafficCondition === 'MODERATE' ? dm ? 'bg-amber-950/40 border-amber-800/40' : 'bg-amber-50/50 border-amber-200/40' :
              dm ? 'bg-green-950/40 border-green-800/40' : 'bg-green-50/50 border-green-200/40'
            }`}>
              <p className={`text-[9px] font-black ${
                driveRoute.trafficCondition === 'HEAVY' ? 'text-red-500' :
                driveRoute.trafficCondition === 'MODERATE' ? 'text-amber-500' : 'text-green-500'
              }`}>{driveRoute.trafficCondition === 'NORMAL' ? 'CLEAR' : driveRoute.trafficCondition}</p>
              <p className={`text-[8px] font-bold uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Traffic</p>
>>>>>>> d022c4adbd0c79d8d8ffcc3282ee36f0e8c2d7a1
            </div>
          )}
        </div>
      )}

<<<<<<< HEAD
      {hasSearched && destinationPoint?.classification?.type && (
        <div className={`flex items-center gap-2 px-3 py-2 border-b ${dm ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-gray-200'}`}>
          <MapPin size={14} className={destinationPoint.classification.hasParking ? 'text-green-500' : 'text-amber-500'} />
          <span className={`text-[10px] font-black uppercase tracking-wider ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
            {destinationPoint.classification.type}
          </span>
          {destinationPoint.classification.parkingHint && (
            <span className={`text-[10px] font-bold ml-auto ${destinationPoint.classification.hasParking ? 'text-green-600' : 'text-amber-600'}`}>
              {destinationPoint.classification.parkingHint}
=======
      {hasClassification && (
        <div className={`flex items-center gap-1.5 ${hasRoutes ? 'mt-1.5' : ''}`}>
          <MapPin size={11} className={destinationPoint!.classification!.hasParking ? 'text-green-500' : 'text-amber-500'} />
          <span className={`text-[9px] font-black uppercase tracking-wider ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
            {destinationPoint!.classification!.type}
          </span>
          {destinationPoint!.classification!.parkingHint && (
            <span className={`text-[9px] font-bold ml-auto ${destinationPoint!.classification!.hasParking ? 'text-green-500' : 'text-amber-500'}`}>
              {destinationPoint!.classification!.parkingHint}
>>>>>>> d022c4adbd0c79d8d8ffcc3282ee36f0e8c2d7a1
            </span>
          )}
        </div>
      )}
<<<<<<< HEAD
    </>
=======
    </div>
>>>>>>> d022c4adbd0c79d8d8ffcc3282ee36f0e8c2d7a1
  );
}
