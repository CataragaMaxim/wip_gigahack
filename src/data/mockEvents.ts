import { relIso } from '@/lib/format';
import type { LatLng, UrbanEvent } from '@/types';

/**
 * DATE DEMONSTRATIVE — nu sunt anunțuri reale.
 * O alertă pentru fiecare categorie, pe segmente reale de stradă (geometrie din OpenStreetMap, © contribuitorii OSM, ODbL).
 * Datele sunt relative la momentul deschiderii aplicației, ca demo-ul să fie mereu „activ”.
 */

/** Segmentele de stradă afectate (extrase din OpenStreetMap). */
const PATHS = {
  /** Bd. Dacia, în zona intersecției cu Bd. Traian (Botanica). */
  dacia: [{ lat: 46.98951, lng: 28.85285 }, { lat: 46.98675, lng: 28.85674 }, { lat: 46.98375, lng: 28.86092 }],
  /** Bd. Moscova, între Str. Matei Basarab și Str. Miron Costin (Rîșcani). */
  moscova: [{ lat: 47.049909, lng: 28.8635 }, { lat: 47.054871, lng: 28.865397 }],
  /** Str. Ismail, între Str. Mitropolit Varlaam și Str. Alexandru Hîjdeu (Centru). */
  ismail: [{ lat: 47.017526, lng: 28.848118 }, { lat: 47.021079, lng: 28.853279 }],
  /** Bd. Mircea cel Bătrîn, în zona Str. Petru Zadnipru (Ciocana). */
  mircea: [{ lat: 47.040648, lng: 28.890251 }, { lat: 47.04523, lng: 28.89074 }, { lat: 47.046535, lng: 28.890801 }, { lat: 47.04833, lng: 28.89072 }],
  /** Bd. Ștefan cel Mare și Sfînt, de-a lungul PMAN (Centru). */
  stefan: [{ lat: 47.026555, lng: 28.829536 }, { lat: 47.023809, lng: 28.833614 }],
} satisfies Record<string, LatLng[]>;

const mid = (path: LatLng[]): LatLng => ({ lat: (path[0].lat + path[path.length - 1].lat) / 2, lng: (path[0].lng + path[path.length - 1].lng) / 2 });

function ev(e: Omit<UrbanEvent, 'location'> & { location?: LatLng }): UrbanEvent {
  return { ...e, location: e.location ?? mid(e.path!) };
}

export const DEMO_USER_ID = 'demo-user';

export function createMockEvents(): UrbanEvent[] {
  return [
    ev({ id: 'e01', category: 'utilitati', subtype: 'electricitate', title: 'Deconectare planificată de energie', sourceType: 'official', source: 'Premier Energy', feed: 'live', severity: 'total', district: 'Botanica', streets: ['Bd. Dacia, zona intersecției cu Bd. Traian'], startAt: relIso(-2.5), endAt: relIso(3.5), updatedAt: relIso(-0.5), confirmations: 11, denials: 0, path: PATHS.dacia }),
    ev({ id: 'e02', category: 'telecom', subtype: 'internet', title: 'Internet fix indisponibil', sourceType: 'citizen', severity: 'total', district: 'Rîșcani', streets: ['Bd. Moscova, între Str. Matei Basarab și Str. Miron Costin'], reportedAt: relIso(-1.5), confirmations: 12, denials: 1, description: 'Fără internet prin cablu în blocurile de pe bulevard. Datele mobile funcționează.', path: PATHS.moscova }),
    ev({ id: 'e03', category: 'drumuri', subtype: 'lucrari', title: 'Reparație carosabil — o bandă închisă', sourceType: 'official', source: 'Primăria mun. Chișinău', severity: 'partial', district: 'Centru', streets: ['Str. Ismail, între Str. Mitropolit Varlaam și Str. Alexandru Hîjdeu'], startAt: relIso(-4 * 24), endAt: relIso(15 * 24), updatedAt: relIso(-6.5), confirmations: 21, denials: 0, path: PATHS.ismail }),
    ev({ id: 'e04', category: 'transport', subtype: 'traseu', title: 'Troleibuzele circulă pe traseu modificat', sourceType: 'official', source: 'Regia Transport Electric', severity: 'partial', district: 'Ciocana', streets: ['Bd. Mircea cel Bătrîn, zona Str. Petru Zadnipru'], startAt: relIso(-3), endAt: relIso(2 * 24), updatedAt: relIso(-1), confirmations: 5, denials: 0, description: 'Stațiile de pe acest segment sunt temporar deservite doar pe sensul opus.', path: PATHS.mircea }),
    ev({ id: 'e05', category: 'urban', subtype: 'eveniment', title: 'Eveniment în PMAN — acces auto restricționat', sourceType: 'official', source: 'Primăria mun. Chișinău', severity: 'partial', district: 'Centru', streets: ['Bd. Ștefan cel Mare și Sfînt, zona PMAN'], startAt: relIso(-1), endAt: relIso(9), updatedAt: relIso(-20), confirmations: 0, denials: 0, path: PATHS.stefan }),
  ];
}
