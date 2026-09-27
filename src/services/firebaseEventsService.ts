import {
  collection, doc, getDocs, addDoc, deleteDoc,
  query, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { geohashForLocation } from 'geofire-common';
import { auth, db } from './firebase';
import { deviceId } from './device';
import { fromFirestore, toFirestore } from './converters';
import type { EventsService } from './eventsService';
import type { LatLng } from '@/types';

const EVENTS = 'events';


export const firebaseEventsService: EventsService = {
  async list() {
    const q = query(collection(db, EVENTS), orderBy('createdAt', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromFirestore(d.id, d.data()));
  },

  subscribe(onData, onError) {
    // Ascultare live (onSnapshot): o singură citire completă la pornire, apoi doar documentele schimbate.
    const q = query(collection(db, EVENTS), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(q, (snap) => onData(snap.docs.map((d) => fromFirestore(d.id, d.data()))), onError);
  },

  async create(event) {
    const { id: _omit, ...rest } = event;
    const ref = await addDoc(collection(db, EVENTS), {
      ...toFirestore(rest),
      geohash: geohashForLocation([event.location.lat, event.location.lng]),
      // Dispozitivul autorului: o credibilitate prea mică blochează raportările și de pe el (colecția blockedDevices).
      authorDeviceId: deviceId(),
    });
    return { ...event, id: ref.id };
  },

  async remove(id) {
    await deleteDoc(doc(db, EVENTS, id));
  },

  async vote(eventId, vote, location: LatLng) {
    if (vote !== 'yes' && vote !== 'no') throw new Error('Invalid vote choice.');
    if (!auth.currentUser) await signInAnonymously(auth);
    const functions = getFunctions(undefined, 'europe-west1');
    const castVote = httpsCallable<
      { eventId: string; vote: 'yes' | 'no'; latitude: number; longitude: number; legacyDeviceId: string },
      { confirmations: number; denials: number; status: string }
    >(functions, 'castWebVote');
    await castVote({ eventId, vote, latitude: location.lat, longitude: location.lng, legacyDeviceId: deviceId() });
  },
};
