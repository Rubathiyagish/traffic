/// <reference types="vite/client" />

declare namespace GeoJSON {
  type Position = number[];
  interface Feature<G = Geometry, P = Record<string, unknown>> {
    type: "Feature";
    id?: string | number;
    properties: P;
    geometry: G;
  }
  interface FeatureCollection<G = Geometry, P = Record<string, unknown>> {
    type: "FeatureCollection";
    features: Feature<G, P>[];
  }
  type Geometry = Point | LineString | Polygon;
  interface Point {
    type: "Point";
    coordinates: Position;
  }
  interface LineString {
    type: "LineString";
    coordinates: Position[];
  }
  interface Polygon {
    type: "Polygon";
    coordinates: Position[][];
  }
}
