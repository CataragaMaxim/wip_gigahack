import type { LatLng } from '@/types';

/**
 * Geocodare prin Nominatim (OpenStreetMap), limitată la Chișinău.
 * Politica Nominatim: max. 1 cerere/secundă — apelantul face debounce.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org';
/** lng_min, lat_max, lng_max, lat_min — municipiul Chișinău, cu o margine. */
const CHISINAU_VIEWBOX = '28.68,47.12,29.02,46.90';

export interface GeoResult {
  id: string;
  /** Rândul principal (stradă + număr). */
  label: string;
  /** Rândul secundar (sector, localitate). */
  detail: string;
  location: LatLng;
}

interface NominatimItem {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string | undefined>;
}

function toResult(it: NominatimItem): GeoResult {
  const a = it.address ?? {};
  const street = a.road ?? a.pedestrian ?? a.street ?? it.name ?? it.display_name.split(',')[0];
  const label = [street, a.house_number].filter(Boolean).join(' ');
  const detail = [a.suburb ?? a.city_district ?? a.quarter, a.city ?? a.town ?? a.village].filter(Boolean).join(', ');
  return { id: String(it.place_id), label, detail, location: { lat: Number(it.lat), lng: Number(it.lon) } };
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    q, format: 'jsonv2', addressdetails: '1', limit: '6', countrycodes: 'md',
    viewbox: CHISINAU_VIEWBOX, bounded: '1', 'accept-language': 'ro',
  });
  const res = await fetch(`${NOMINATIM}/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Geocodare eșuată (${res.status})`);
  return ((await res.json()) as NominatimItem[]).map(toResult);
}

export async function reverseGeocode(p: LatLng, signal?: AbortSignal): Promise<GeoResult | null> {
  const params = new URLSearchParams({
    lat: String(p.lat), lon: String(p.lng), format: 'jsonv2', addressdetails: '1', zoom: '18', 'accept-language': 'ro',
  });
  const res = await fetch(`${NOMINATIM}/reverse?${params}`, { signal });
  if (!res.ok) return null;
  const it = (await res.json()) as NominatimItem & { error?: string };
  return it.error ? null : { ...toResult(it), location: p };
}
