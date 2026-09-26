console.log('ENV CHECK:', {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles/tokens.css';
import './styles/app.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { seedEvents, clearEvents } from '@/services/seed';
(window as any).seed = seedEvents;
(window as any).clear = clearEvents;

// TEMP — delete after inspecting
import { db } from '@/services/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { fromFirestore } from '@/services/converters';

(window as any).dump = async () => {
  const snap = await getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc'), limit(50)));
  const events = snap.docs.map((d) => fromFirestore(d.id, d.data()));

  console.log('=== RAW FIRESTORE DOC (first one) ===');
  console.log(snap.docs[0]?.data());

  console.log('=== CONVERTED EVENT (first one) ===');
  console.log(events[0]);

  console.log('=== ALL EVENTS (summary) ===');
  console.table(events.map((e) => ({
    id: e.id.slice(0, 6) + '…',
    category: e.category,
    subtype: e.subtype,
    title: e.title.slice(0, 30),
    severity: e.severity,
    district: e.district,
    confirmations: e.confirmations,
    hasLocation: !!e.location,
    hasPath: !!e.path?.length,
    startAt: e.startAt?.slice(0, 16),
  })));

  return events;
};