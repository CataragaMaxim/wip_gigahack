import type { Map as LeafletMap } from 'leaflet';
import type { DerivedEvent, SubtypeKey } from '@/types';

/** Markerele mai apropiate de atât (pixeli pe ecran) se suprapun și se unesc într-un grup. */
export const CLUSTER_PX = 44;
/** De la acest zoom în sus nu mai grupăm: adresele se văd separat. */
export const CLUSTER_MAX_ZOOM = 17;
/** Sub atâția pixeli (la zoom maxim) markerele sunt în același loc și rămân grupate. */
export const SAME_SPOT_PX = 6;

/** Diametrul iconiței (px): un marker = 44; un grup crește cu numărul de evenimente. */
export const clusterSize = (n: number) => (n <= 1 ? CLUSTER_PX : Math.round(46 + Math.min(18, Math.log2(n) * 4)));

export interface MarkerCluster {
  id: string;
  members: DerivedEvent[];
  lat: number;
  lng: number;
  /** Câte evenimente de fiecare tip (pentru culoarea și inelul grupului). */
  byType: Partial<Record<SubtypeKey, number>>;
  /** Tipul cel mai frecvent (culoarea și iconița grupului). */
  main: SubtypeKey;
}

/**
 * Grupează markerele care se suprapun la zoomul curent (grilă de CLUSTER_PX în coordonate de ecran).
 * Evenimentul selectat nu intră niciodată într-un grup. Întoarce doar grupurile cu cel puțin 2 evenimente.
 */
export function clusterMarkers(map: LeafletMap, events: DerivedEvent[], zoom: number, keepId?: string): MarkerCluster[] {
  // Aproape de stradă nu mai grupăm, cu excepția evenimentelor practic în același punct (nu se pot separa prin zoom).
  const reach = zoom >= CLUSTER_MAX_ZOOM ? SAME_SPOT_PX : CLUSTER_PX;
  const pts = events
    .filter((e) => e.id !== keepId)
    .map((e) => ({ e, p: map.project([e.location.lat, e.location.lng], zoom) }));
  const cell = (x: number, y: number) => `${Math.floor(x / CLUSTER_PX)}:${Math.floor(y / CLUSTER_PX)}`;
  const grid = new Map<string, number[]>();
  pts.forEach(({ p }, i) => {
    const k = cell(p.x, p.y);
    grid.set(k, [...(grid.get(k) ?? []), i]);
  });

  // 1) Primul pas: grilă — fiecare marker ia vecinii aflați la mai puțin de CLUSTER_PX.
  const used = new Set<number>();
  let groups: { idx: number[]; x: number; y: number }[] = [];
  pts.forEach(({ p }, i) => {
    if (used.has(i)) return;
    used.add(i);
    const idx = [i];
    const cx = Math.floor(p.x / CLUSTER_PX);
    const cy = Math.floor(p.y / CLUSTER_PX);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (used.has(j)) continue;
          const q = pts[j].p;
          if (Math.hypot(q.x - p.x, q.y - p.y) < reach) {
            used.add(j);
            idx.push(j);
          }
        }
      }
    }
    groups.push({ idx, ...centroid(idx) });
  });

  // 2) Grupurile sunt mai mari decât un marker: unim și grupurile (sau markerele) ale căror iconițe s-ar atinge,
  //    până nu mai rămâne nicio suprapunere.
  function centroid(idx: number[]) {
    return { x: idx.reduce((s, k) => s + pts[k].p.x, 0) / idx.length, y: idx.reduce((s, k) => s + pts[k].p.y, 0) / idx.length };
  }
  for (let merged = zoom < CLUSTER_MAX_ZOOM; merged; ) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i];
        const b = groups[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < (clusterSize(a.idx.length) + clusterSize(b.idx.length)) / 2) {
          const idx = [...a.idx, ...b.idx];
          groups[i] = { idx, ...centroid(idx) };
          groups = groups.filter((_, k) => k !== j);
          merged = true;
          break outer;
        }
      }
    }
  }

  const clusters: MarkerCluster[] = [];
  for (const g of groups) {
    if (g.idx.length < 2) continue;
    const evs = g.idx.map((m) => pts[m].e);
    const byType: Partial<Record<SubtypeKey, number>> = {};
    for (const e of evs) byType[e.subtype] = (byType[e.subtype] ?? 0) + 1;
    const main = (Object.entries(byType) as [SubtypeKey, number][]).sort((x, y) => y[1] - x[1])[0][0];
    clusters.push({
      id: evs.map((e) => e.id).sort()[0],
      members: evs,
      lat: evs.reduce((s, e) => s + e.location.lat, 0) / evs.length,
      lng: evs.reduce((s, e) => s + e.location.lng, 0) / evs.length,
      byType,
      main,
    });
  }
  return clusters;
}
