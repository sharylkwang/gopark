export interface BuildingFeature {
  type: 'Feature';
  properties: {
    id: number;
    name: string;
    height: number;
    minHeight: number;
    color: string;
    roofColor: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
}

export interface BuildingCollection {
  type: 'FeatureCollection';
  features: BuildingFeature[];
}
