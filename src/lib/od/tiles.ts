// Web Mercator helpers + a tiny XYZ raster tile loader/cache for the canvas basemap.
// Free, no-key CARTO "dark, no labels" tiles — matches the app's dark theme and keeps
// place-name clutter off the map (district labels are drawn separately and toggleable).

const SUBDOMAINS = ["a", "b", "c", "d"];

export const TILE_ATTRIBUTION = "© OpenStreetMap contributors";

/** Mercator y, expressed in "degrees" so it's directly comparable to longitude degrees. */
export function mercYDeg(lat: number): number {
  const clamped = Math.max(-85.05, Math.min(85.05, lat));
  return (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 180 / 2));
}

export function invMercYDeg(y: number): number {
  return ((2 * Math.atan(Math.exp((y * Math.PI) / 180)) - Math.PI / 2) * 180) / Math.PI;
}

/** Fractional slippy-map tile coordinates for a lng/lat at zoom z. */
export function lngLatToTile(lng: number, lat: number, z: number): [number, number] {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const latRad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return [x, y];
}

export function tileToLngLat(x: number, y: number, z: number): [number, number] {
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return [lng, (latRad * 180) / Math.PI];
}

type TileEntry = { img: HTMLImageElement; loaded: boolean };

/** Small in-memory tile cache. Tiles load async and call `onTile` once ready to trigger a redraw. */
export class TileCache {
  private tiles = new Map<string, TileEntry>();
  private onTile: () => void;

  constructor(onTile: () => void) {
    this.onTile = onTile;
  }

  get(z: number, x: number, y: number): HTMLImageElement | null {
    const n = 2 ** z;
    const xw = ((x % n) + n) % n;
    if (y < 0 || y >= n) return null;
    const key = `${z}/${xw}/${y}`;
    let entry = this.tiles.get(key);
    if (!entry) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      entry = { img, loaded: false };
      this.tiles.set(key, entry);
      const s = SUBDOMAINS[(xw + y) % SUBDOMAINS.length];
      const q = CARTO_KEY ? `?key=${CARTO_KEY}` : "cb1_3qtw_1_529d56f3386ffc5bc0d6b9b3";
      img.src = `https://${s}.basemaps.cartocdn.com/dark_nolabels/${z}/${xw}/${y}.png${q}`;
      img.onload = () => {
        entry!.loaded = true;
        this.onTile();
      };
    }
    return entry.loaded ? entry.img : null;
  }
}
