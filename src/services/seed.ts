import { collection, addDoc, getDocs, deleteDoc, Timestamp, GeoPoint } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { db } from './firebase';
import { createMockEvents } from '@/data/mockEvents';
import type { LatLng } from '@/types';

const toGp = (p: LatLng) => new GeoPoint(p.lat, p.lng);
const toTs = (s?: string) => (s ? Timestamp.fromDate(new Date(s)) : null);

export async function seedEvents() {
  const mock = createMockEvents();
  for (const e of mock) {
    const { id, ...rest } = e;
    await addDoc(collection(db, 'events'), {
      ...rest,
      startAt: toTs(e.startAt),
      endAt: toTs(e.endAt),
      updatedAt: toTs(e.updatedAt),
      reportedAt: toTs(e.reportedAt),
      resolvedAt: toTs(e.resolvedAt),
      location: toGp(e.location),
      path: e.path?.map(toGp) ?? null,
      geohash: geohashForLocation([e.location.lat, e.location.lng]),
      createdAt: Timestamp.now(),
    });
  }
  console.log(`Seeded ${mock.length} events`);
}

export async function clearEvents() {
  const snap = await getDocs(collection(db, 'events'));
  for (const d of snap.docs) await deleteDoc(d.ref);
  console.log(`Cleared ${snap.size} events`);
}