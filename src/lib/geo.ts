import type { LatLng, Street, UrbanEvent } from '@/types';

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distanța în metri între două puncte (haversine). */
export function distance(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Proiecție locală în metri (suficient de precisă la scara unui oraș). */
function toXY(p: LatLng, ref: LatLng) {
  return { x: rad(p.lng - ref.lng) * R * Math.cos(rad(ref.lat)), y: rad(p.lat - ref.lat) * R };
}

export function distanceToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const A = toXY(a, p);
  const B = toXY(b, p);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const L2 = dx * dx + dy * dy;
  let t = L2 ? (-A.x * dx - A.y * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(A.x + t * dx, A.y + t * dy);
}

export function distanceToPath(p: LatLng, path: LatLng[]): number {
  if (path.length === 1) return distance(p, path[0]);
  let d = Infinity;
  for (let i = 0; i < path.length - 1; i++) d = Math.min(d, distanceToSegment(p, path[i], path[i + 1]));
  return d;
}

/** Distanța de la un punct la zona afectată a evenimentului (traseu sau punct). */
export function distanceToEvent(p: LatLng, e: Pick<UrbanEvent, 'location' | 'path'>): number {
  const d = distance(p, e.location);
  return e.path ? Math.min(d, distanceToPath(p, e.path)) : d;
}

export function nearestStreet(p: LatLng, streets: Street[]): { street: Street; distanceM: number } | null {
  let best: Street | null = null;
  let bd = Infinity;
  for (const s of streets) {
    const d = distanceToPath(p, s.path);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best ? { street: best, distanceM: bd } : null;
}

export function midpoint(path: LatLng[]): LatLng {
  if (path.length === 2) return { lat: (path[0].lat + path[1].lat) / 2, lng: (path[0].lng + path[1].lng) / 2 };
  return path[Math.floor((path.length - 1) / 2)];
}

/** Un segment scurt de-a lungul străzii celei mai apropiate (pentru evenimentele fără traseu). */
export function segmentAround(p: LatLng, streets: Street[], halfM = 280): LatLng[] {
  let best: [LatLng, LatLng] | null = null;
  let bd = Infinity;
  for (const s of streets) {
    for (let i = 0; i < s.path.length - 1; i++) {
      const d = distanceToSegment(p, s.path[i], s.path[i + 1]);
      if (d < bd) {
        bd = d;
        best = [s.path[i], s.path[i + 1]];
      }
    }
  }
  if (!best || bd > 400) return [p];
  const [a, b] = best;
  const A = toXY(a, p);
  const B = toXY(b, p);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const L = Math.hypot(dx, dy) || 1;
  let t = (-A.x * dx - A.y * dy) / (L * L);
  t = Math.max(0, Math.min(1, t));
  const t1 = Math.max(0, t * L - halfM) / L;
  const t2 = Math.min(L, t * L + halfM) / L;
  const lerp = (k: number): LatLng => ({ lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k });
  return [lerp(t1), lerp(t2)];
}
