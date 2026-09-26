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

// --- DEV HOOKS — delete before shipping ---
import { seedEvents, clearEvents } from '@/services/seed';
(window as any).seed = seedEvents;
(window as any).clear = clearEvents;

import { db } from '@/services/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { fromFirestore } from '@/services/converters';

(window as any).dump = async () => {
  const snap = await getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc'), limit(50)));
  const events = snap.docs.map((d) => fromFirestore(d.id, d.data()));
  console.log('RAW:', snap.docs[0]?.data());
  console.log('CONVERTED:', events[0]);
  console.table(events.map((e) => ({
    id: e.id.slice(0, 6),
    category: e.category,
    title: e.title.slice(0, 30),
    severity: e.severity,
    confirmations: e.confirmations,
    hasLocation: !!e.location,
    hasPath: !!e.path?.length,
  })));
  return events;
};