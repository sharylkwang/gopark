const semiMajorAxis = 6378137;
const flattening = 1 / 298.257223563;
const originLatDeg = 1.366666;
const originLonDeg = 103.833333;
const falseNorthing = 38744.572;
const falseEasting = 28001.642;
const scaleFactor = 1;

const semiMinorAxis = semiMajorAxis * (1 - flattening);
const e2 = 2 * flattening - flattening * flattening;
const e4 = e2 * e2;
const e6 = e4 * e2;
const A0 = 1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256;
const A2 = (3 / 8) * (e2 + e4 / 4 + (15 * e6) / 128);
const A4 = (15 / 256) * (e4 + (3 * e6) / 4);
const A6 = (35 * e6) / 3072;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

function meridianArc(latRad: number): number {
  return (
    semiMajorAxis *
    (A0 * latRad -
      A2 * Math.sin(2 * latRad) +
      A4 * Math.sin(4 * latRad) -
      A6 * Math.sin(6 * latRad))
  );
}

function meridianRadius(sin2Lat: number): number {
  return (semiMajorAxis * (1 - e2)) / Math.pow(1 - e2 * sin2Lat, 1.5);
}

function primeVerticalRadius(sin2Lat: number): number {
  return semiMajorAxis / Math.sqrt(1 - e2 * sin2Lat);
}

export function svy21ToWgs84(easting: number, northing: number): { lat: number; lng: number } {
  const northingOffset = northing - falseNorthing;
  const originArc = meridianArc(toRadians(originLatDeg));
  const arc = originArc + northingOffset / scaleFactor;

  const n = (semiMajorAxis - semiMinorAxis) / (semiMajorAxis + semiMinorAxis);
  const n2 = n * n;
  const n3 = n2 * n;
  const n4 = n2 * n2;
  const G =
    (semiMajorAxis *
      (1 - n) *
      (1 - n2) *
      (1 + (9 * n2) / 4 + (225 * n4) / 64) *
      Math.PI) /
    180;
  const sigma = (arc * Math.PI) / (180 * G);

  const footpointLat =
    sigma +
    ((3 * n) / 2 - (27 * n3) / 32) * Math.sin(2 * sigma) +
    ((21 * n2) / 16 - (55 * n4) / 32) * Math.sin(4 * sigma) +
    ((151 * n3) / 96) * Math.sin(6 * sigma) +
    ((1097 * n4) / 512) * Math.sin(8 * sigma);

  const sinLat = Math.sin(footpointLat);
  const sin2Lat = sinLat * sinLat;
  const rho = meridianRadius(sin2Lat);
  const v = primeVerticalRadius(sin2Lat);
  const psi = v / rho;
  const psi2 = psi * psi;
  const psi3 = psi2 * psi;
  const psi4 = psi2 * psi2;
  const t = Math.tan(footpointLat);
  const t2 = t * t;
  const t4 = t2 * t2;
  const t6 = t4 * t2;

  const eastingOffset = easting - falseEasting;
  const x = eastingOffset / (scaleFactor * v);
  const x2 = x * x;
  const x3 = x2 * x;
  const x5 = x3 * x2;
  const x7 = x5 * x2;

  const latFactor = t / (scaleFactor * rho);
  const latTerm1 = latFactor * ((eastingOffset * x) / 2);
  const latTerm2 =
    latFactor *
    ((eastingOffset * x3) / 24) *
    (-4 * psi2 + 9 * psi * (1 - t2) + 12 * t2);
  const latTerm3 =
    latFactor *
    ((eastingOffset * x5) / 720) *
    (8 * psi4 * (11 - 24 * t2) -
      12 * psi3 * (21 - 71 * t2) +
      15 * psi2 * (15 - 98 * t2 + 15 * t4) +
      180 * psi * (5 * t2 - 3 * t4) +
      360 * t4);
  const latTerm4 =
    latFactor *
    ((eastingOffset * x7) / 40320) *
    (1385 - 3633 * t2 + 4095 * t4 + 1575 * t6);
  const latRad = footpointLat - latTerm1 + latTerm2 - latTerm3 + latTerm4;

  const secLat = 1 / Math.cos(footpointLat);
  const lonTerm1 = x * secLat;
  const lonTerm2 = ((x3 * secLat) / 6) * (psi + 2 * t2);
  const lonTerm3 =
    ((x5 * secLat) / 120) *
    (-4 * psi3 * (1 - 6 * t2) + psi2 * (9 - 68 * t2) + 72 * psi * t2 + 24 * t4);
  const lonTerm4 =
    ((x7 * secLat) / 5040) * (61 + 662 * t2 + 1320 * t4 + 720 * t6);
  const lonRad = toRadians(originLonDeg) + lonTerm1 - lonTerm2 + lonTerm3 - lonTerm4;

  return { lat: toDegrees(latRad), lng: toDegrees(lonRad) };
}
