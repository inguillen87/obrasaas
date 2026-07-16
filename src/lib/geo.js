export const MAX_REPORTED_LOCATION_ACCURACY_METERS = 100;

export function validateProjectGeofence({ latitude, longitude, geofenceMeters }) {
  const coordinatesPresent = latitude !== null
    && latitude !== undefined
    && longitude !== null
    && longitude !== undefined;
  const normalized = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    geofenceMeters: Number(geofenceMeters),
  };
  const valid = coordinatesPresent
    && Number.isFinite(normalized.latitude)
    && normalized.latitude >= -90
    && normalized.latitude <= 90
    && Number.isFinite(normalized.longitude)
    && normalized.longitude >= -180
    && normalized.longitude <= 180
    && Number.isFinite(normalized.geofenceMeters)
    && normalized.geofenceMeters > 0;
  return valid ? { valid: true, ...normalized } : { valid: false };
}

export function validateReportedLocation({ latitude, longitude, accuracy }) {
  const coordinateInputsPresent = [latitude, longitude].every((value) => (
    (typeof value === 'number' || typeof value === 'string')
    && String(value).trim() !== ''
  ));
  const normalized = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    accuracy: Number(accuracy),
  };
  const coordinatesValid = (
    coordinateInputsPresent
    && Number.isFinite(normalized.latitude)
    && Number.isFinite(normalized.longitude)
    && normalized.latitude >= -90
    && normalized.latitude <= 90
    && normalized.longitude >= -180
    && normalized.longitude <= 180
  );
  if (!coordinatesValid) return { valid: false, reason: 'INVALID_COORDINATES' };
  const accuracyInputPresent = (
    (typeof accuracy === 'number' || typeof accuracy === 'string')
    && String(accuracy).trim() !== ''
  );
  if (
    !accuracyInputPresent
    || !Number.isFinite(normalized.accuracy)
    || normalized.accuracy <= 0
    || normalized.accuracy > MAX_REPORTED_LOCATION_ACCURACY_METERS
  ) {
    return { valid: false, reason: 'INSUFFICIENT_ACCURACY' };
  }
  return { valid: true, ...normalized };
}

export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;

  const [startLat, startLon, endLat, endLon] = values;
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const phi1 = toRadians(startLat);
  const phi2 = toRadians(endLat);
  const deltaPhi = toRadians(endLat - startLat);
  const deltaLambda = toRadians(endLon - startLon);
  const haversine =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
