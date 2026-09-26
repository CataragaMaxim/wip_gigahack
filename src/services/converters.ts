import { Timestamp, GeoPoint } from 'firebase/firestore';
import type { UrbanEvent, LatLng } from '@/types';

const tsToIso = (t: unknown): string | undefined =>
  t instanceof Timestamp ? t.toDate().toISOString() : undefined;

const isoToTs = (s?: string | null): Timestamp | null =>
  s ? Timestamp.fromDate(new Date(s)) : null;

const gpToLatLng = (g: unknown): LatLng | undefined =>
  g instanceof GeoPoint ? { lat: g.latitude, lng: g.longitude } : undefined;

const latLngToGp = (p: LatLng): GeoPoint => new GeoPoint(p.lat, p.lng);

export function fromFirestore(id: string, d: any): UrbanEvent {
  return {
    id,
    category: d.category,
    subtype: d.subtype,
    title: d.title,
    sourceType: d.sourceType,
    source: d.source ?? undefined,
    feed: d.feed ?? undefined,
    planned: d.planned ?? false,
    severity: d.severity,
    district: d.district ?? '',
    streets: d.streets ?? [],
    startAt: tsToIso(d.startAt),
    endAt: tsToIso(d.endAt),
    updatedAt: tsToIso(d.updatedAt),
    reportedAt: tsToIso(d.reportedAt),
    resolvedAt: tsToIso(d.resolvedAt),
    confirmations: d.confirmations ?? 0,
    denials: d.denials ?? 0,
    description: d.description ?? undefined,
    photo: d.photo ?? false,
    authorId: d.authorId ?? undefined,
    location: gpToLatLng(d.location)!,
    path: Array.isArray(d.path) ? (d.path.map(gpToLatLng).filter(Boolean) as LatLng[]) : undefined,
  };
}

export function toFirestore(e: Omit<UrbanEvent, 'id'>) {
  return {
    category: e.category,
    subtype: e.subtype,
    title: e.title,
    sourceType: e.sourceType,
    source: e.source ?? null,
    feed: e.feed ?? null,
    planned: e.planned ?? false,
    severity: e.severity,
    district: e.district,
    streets: e.streets,
    startAt: isoToTs(e.startAt),
    endAt: isoToTs(e.endAt),
    updatedAt: isoToTs(e.updatedAt),
    reportedAt: isoToTs(e.reportedAt),
    resolvedAt: isoToTs(e.resolvedAt),
    confirmations: e.confirmations,
    denials: e.denials,
    description: e.description ?? null,
    photo: e.photo ?? false,
    authorId: e.authorId ?? null,
    location: latLngToGp(e.location),
    path: e.path?.map(latLngToGp) ?? null,
    createdAt: Timestamp.now(),
  };
}