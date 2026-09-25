import { relIso } from '@/lib/format';
import type { LatLng, UrbanEvent } from '@/types';
import { STREET_BY_ID } from './streets';

/**
 * DATE DEMONSTRATIVE — nu sunt anunțuri reale.
 * Datele sunt relative la momentul deschiderii aplicației, ca demo-ul să fie mereu „activ”.
 * Coordonatele sunt aproximative.
 */

/** Porțiunea [t1, t2] (0..1) de-a lungul unei străzi. */
function along(streetId: string, t1: number, t2: number): LatLng[] {
  const p = STREET_BY_ID[streetId].path;
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const d = Math.hypot(p[i + 1].lat - p[i].lat, p[i + 1].lng - p[i].lng);
    seg.push(d);
    total += d;
  }
  const at = (t: number): LatLng => {
    let rem = t * total;
    for (let i = 0; i < seg.length; i++) {
      if (rem <= seg[i] || i === seg.length - 1) {
        const k = seg[i] ? Math.min(1, rem / seg[i]) : 0;
        return { lat: p[i].lat + (p[i + 1].lat - p[i].lat) * k, lng: p[i].lng + (p[i + 1].lng - p[i].lng) * k };
      }
      rem -= seg[i];
    }
    return p[p.length - 1];
  };
  const out = [at(t1)];
  let acc = 0;
  for (let i = 0; i < seg.length; i++) {
    acc += seg[i];
    const t = acc / total;
    if (t > t1 && t < t2) out.push(p[i + 1]);
  }
  out.push(at(t2));
  return out;
}
const mid = (path: LatLng[]): LatLng => path[Math.floor(path.length / 2)] ?? path[0];

function ev(e: Omit<UrbanEvent, 'location'> & { location?: LatLng }): UrbanEvent {
  return { ...e, location: e.location ?? mid(e.path!) };
}

export const DEMO_USER_ID = 'demo-user';

export function createMockEvents(): UrbanEvent[] {
  const e01Path = along('dacia', 0.28, 0.48);
  const e10Path = along('ismail', 0.42, 0.62);
  return [
    ev({ id: 'e01', category: 'utilitati', subtype: 'electricitate', title: 'Deconectare planificată de energie', sourceType: 'official', source: 'Premier Energy', feed: 'live', severity: 'total', district: 'Botanica', streets: ['Bd. Dacia 23–47', 'Str. Trandafirilor 2–18', 'Str. Independenței 1–9'], startAt: relIso(-5.5), endAt: relIso(3.5), updatedAt: relIso(-0.7), confirmations: 14, denials: 1, path: e01Path }),
    ev({ id: 'e02', category: 'utilitati', subtype: 'electricitate', title: 'Lucrări pe rețea — tensiune instabilă', sourceType: 'official', source: 'Premier Energy', feed: 'live', severity: 'partial', district: 'Rîșcani', streets: ['Bd. Moscova 2–20', 'Str. Kiev 4–16'], startAt: relIso(-4.5), endAt: relIso(1.5), updatedAt: relIso(-3), confirmations: 3, denials: 0, path: along('moscova', 0.25, 0.45) }),
    ev({ id: 'e03', category: 'utilitati', subtype: 'electricitate', title: 'Deconectare programată pentru mentenanță', sourceType: 'official', source: 'Premier Energy', feed: 'live', severity: 'total', district: 'Ciocana', streets: ['Str. Mihai Sadoveanu 20–42'], startAt: relIso(18.5), endAt: relIso(26.5), updatedAt: relIso(-22), confirmations: 0, denials: 0, path: along('sadoveanu', 0.3, 0.6) }),
    ev({ id: 'e04', category: 'utilitati', subtype: 'electricitate', title: 'Avarie pe rețeaua de joasă tensiune', sourceType: 'official', source: 'Premier Energy', feed: 'live', severity: 'total', district: 'Centru', streets: ['Str. București 60–74'], startAt: relIso(-25), endAt: relIso(-22), updatedAt: relIso(-22), resolvedAt: relIso(-22), confirmations: 9, denials: 0, path: along('bucuresti', 0.35, 0.5) }),
    ev({ id: 'e05', category: 'utilitati', subtype: 'apa', title: 'Sistare apă — lucrări la conductă', sourceType: 'official', source: 'Apă-Canal Chișinău', severity: 'total', district: 'Buiucani', streets: ['Str. Alba Iulia 75–121', 'Str. Ion Creangă 49–53'], startAt: relIso(-6.5), endAt: relIso(5.5), updatedAt: relIso(-2), confirmations: 6, denials: 0, path: along('alba', 0.35, 0.65) }),
    ev({ id: 'e06', category: 'utilitati', subtype: 'apa', title: 'Presiune scăzută la apă', sourceType: 'citizen', severity: 'partial', district: 'Centru', streets: ['Str. Mitropolit Varlaam'], reportedAt: relIso(-2.4), confirmations: 7, denials: 1, description: 'La etajele de sus apa curge foarte slab de la prânz.', path: along('varlaam', 0.4, 0.62) }),
    ev({ id: 'e07', category: 'utilitati', subtype: 'gaz', title: 'Lucrări la rețeaua de gaz', sourceType: 'official', source: 'Chișinău-Gaz', severity: 'total', district: 'Ciocana', streets: ['Bd. Mircea cel Bătrîn 4–36'], startAt: relIso(-4.5), endAt: relIso(25.5), updatedAt: relIso(-5.3), confirmations: 4, denials: 0, path: along('mircea', 0.3, 0.55) }),
    ev({ id: 'e08', category: 'telecom', subtype: 'internet', title: 'Internet fix indisponibil', sourceType: 'citizen', severity: 'total', district: 'Rîșcani', streets: ['Bd. Moscova 11–21'], reportedAt: relIso(-3.5), confirmations: 12, denials: 2, description: 'Fără internet prin cablu în blocurile de lângă stația de troleibuz. Datele mobile funcționează.', path: along('moscova', 0.62, 0.8) }),
    ev({ id: 'e09', category: 'telecom', subtype: 'mobil', title: 'Semnal mobil slab', sourceType: 'citizen', severity: 'partial', district: 'Botanica', streets: ['Str. Cuza Vodă'], reportedAt: relIso(-0.6), confirmations: 2, denials: 0, description: 'Apelurile se întrerup în zona intersecției. Datele merg greu.', path: along('cuza', 0.45, 0.7) }),
    ev({ id: 'e10', category: 'drumuri', subtype: 'lucrari', title: 'Reparație carosabil — o bandă închisă', sourceType: 'official', source: 'Primăria mun. Chișinău', severity: 'partial', district: 'Centru', streets: ['Str. Ismail, între Bd. Ștefan cel Mare și Str. Mitropolit Varlaam'], startAt: relIso(-4 * 24), endAt: relIso(15 * 24), updatedAt: relIso(-6.5), confirmations: 21, denials: 0, path: e10Path }),
    ev({ id: 'e11', category: 'drumuri', subtype: 'deteriorat', title: 'Groapă adâncă pe carosabil', sourceType: 'citizen', authorId: DEMO_USER_ID, severity: 'partial', district: 'Buiucani', streets: ['Str. Ion Creangă'], reportedAt: relIso(-20), confirmations: 5, denials: 0, description: 'Groapă pe banda din dreapta, lângă trecerea de pietoni. Greu vizibilă seara.', photo: true, path: along('creanga', 0.4, 0.55) }),
    ev({ id: 'e12', category: 'drumuri', subtype: 'inchis', title: 'Drum închis pentru lucrări?', sourceType: 'citizen', severity: 'total', district: 'Botanica', streets: ['Bd. Decebal'], reportedAt: relIso(-4.2), confirmations: 2, denials: 6, description: 'Barieră la intersecție, circulația pare deviată.', path: along('decebal', 0.4, 0.6) }),
    ev({ id: 'e13', category: 'transport', subtype: 'traseu', title: 'Troleibuzele de pe str. Ismail circulă pe traseu deviat', sourceType: 'official', source: 'Regia Transport Electric', severity: 'partial', district: 'Centru', streets: ['Ocolire: Str. București → Str. Mitropolit Varlaam'], startAt: relIso(-4 * 24), endAt: relIso(15 * 24), updatedAt: relIso(-28), confirmations: 8, denials: 1, path: [...along('bucuresti', 0.62, 0.95), ...along('varlaam', 0.95, 0.62).reverse()] }),
    ev({ id: 'e14', category: 'transport', subtype: 'intarzieri', title: 'Autobuze cu întârzieri mari', sourceType: 'citizen', severity: 'partial', district: 'Ciocana', streets: ['Bd. Mircea cel Bătrîn'], reportedAt: relIso(-0.5), confirmations: 2, denials: 1, description: 'Aștept de peste 25 de minute în stație. Panoul nu afișează nimic.', path: along('mircea', 0.05, 0.2) }),
    ev({ id: 'e15', category: 'urban', subtype: 'eveniment', title: 'Eveniment în PMAN — acces auto restricționat', sourceType: 'official', source: 'Primăria mun. Chișinău', severity: 'partial', district: 'Centru', streets: ['Bd. Ștefan cel Mare și Sfînt, zona PMAN'], startAt: relIso(19.5), endAt: relIso(31.5), updatedAt: relIso(-48), confirmations: 0, denials: 0, path: along('stefan', 0.4, 0.55) }),
    ev({ id: 'e16', category: 'urban', subtype: 'urbane', title: 'Reabilitare trotuar și iluminat stradal', sourceType: 'official', source: 'Primăria mun. Chișinău', severity: 'partial', district: 'Rîșcani', streets: ['Str. Alecu Russo 1–15'], startAt: relIso(-11 * 24), endAt: relIso(10 * 24), updatedAt: relIso(-3 * 24), confirmations: 3, denials: 0, path: along('russo', 0.2, 0.7) }),
    ev({ id: 'e17', category: 'transport', subtype: 'suspendat', title: 'Stație de autobuz mutată temporar', sourceType: 'citizen', authorId: DEMO_USER_ID, severity: 'partial', district: 'Buiucani', streets: ['Calea Ieșilor'], reportedAt: relIso(-3 * 24), resolvedAt: relIso(-2 * 24), confirmations: 9, denials: 0, description: 'Stația a fost mutată cu 100 m din cauza lucrărilor.', path: along('iesilor', 0.3, 0.4) }),
  ];
}
