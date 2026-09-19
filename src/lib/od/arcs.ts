import type { Region } from "./types";

export function flowArc(
  a: Region,
  b: Region,
  steps = 24,
): GeoJSON.Feature<GeoJSON.LineString> {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const dist = Math.hypot(dx, dy) || 1;
  const mx = (a.lng + b.lng) / 2;
  const my = (a.lat + b.lat) / 2;
  const nx = -dy / dist;
  const ny = dx / dist;
  const bulge = dist * 0.22;
  const cx = mx + nx * bulge;
  const cy = my + ny * bulge;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    coords.push([
      u * u * a.lng + 2 * u * t * cx + t * t * b.lng,
      u * u * a.lat + 2 * u * t * cy + t * t * b.lat,
    ]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}
