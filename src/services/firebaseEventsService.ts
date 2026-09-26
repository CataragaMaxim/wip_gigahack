import {
  collection, doc, getDocs, addDoc, deleteDoc,
  setDoc, getDoc, updateDoc, increment,
  query, orderBy, limit, serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { db, auth } from './firebase';
import { fromFirestore, toFirestore } from './converters';
import type { EventsService } from './eventsService';

const EVENTS = 'events';

const deviceId = () => {
  const KEY = 'wip.deviceId';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
};

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
    });
    return { ...event, id: ref.id };
  },

  async remove(id) {
    await deleteDoc(doc(db, EVENTS, id));
  },

  async vote(eventId, vote) {
    const did = deviceId();
    const voteRef = doc(db, EVENTS, eventId, 'votes', did);
    if ((await getDoc(voteRef)).exists()) return;
    await setDoc(voteRef, { vote, uid: auth.currentUser?.uid ?? null, at: serverTimestamp() });
    await updateDoc(doc(db, EVENTS, eventId), {
      [vote === 'yes' ? 'confirmations' : 'denials']: increment(1),
    });
  },
};