import type { Street } from '@/types';

/**
 * Străzi principale din Chișinău, cu trasee APROXIMATIVE (câteva puncte).
 * Folosite la căutare, autocomplete, adresa pinului și segmentele implicite.
 * La integrare se înlocuiesc cu date reale (ex. OpenStreetMap / serviciu de geocodare).
 */
export const STREETS: Street[] = [
  { id: 'stefan', name: 'Bd. Ștefan cel Mare și Sfînt', district: 'Centru', path: [{ lat: 47.0331, lng: 28.8171 }, { lat: 47.0253, lng: 28.8322 }, { lat: 47.0158, lng: 28.8492 }] },
  { id: 'iesilor', name: 'Calea Ieșilor', district: 'Buiucani', path: [{ lat: 47.0555, lng: 28.7815 }, { lat: 47.0420, lng: 28.8030 }, { lat: 47.0331, lng: 28.8171 }] },
  { id: 'dacia', name: 'Bd. Dacia', district: 'Botanica', path: [{ lat: 46.9985, lng: 28.8545 }, { lat: 46.9885, lng: 28.8690 }, { lat: 46.9760, lng: 28.8880 }] },
  { id: 'moscova', name: 'Bd. Moscova', district: 'Rîșcani', path: [{ lat: 47.0395, lng: 28.8555 }, { lat: 47.0480, lng: 28.8600 }, { lat: 47.0580, lng: 28.8655 }] },
  { id: 'mircea', name: 'Bd. Mircea cel Bătrîn', district: 'Ciocana', path: [{ lat: 47.0430, lng: 28.8810 }, { lat: 47.0485, lng: 28.8910 }, { lat: 47.0545, lng: 28.9020 }] },
  { id: 'decebal', name: 'Bd. Decebal', district: 'Botanica', path: [{ lat: 46.9990, lng: 28.8580 }, { lat: 46.9935, lng: 28.8700 }, { lat: 46.9875, lng: 28.8830 }] },
  { id: 'alba', name: 'Str. Alba Iulia', district: 'Buiucani', path: [{ lat: 47.0395, lng: 28.7700 }, { lat: 47.0330, lng: 28.7850 }, { lat: 47.0290, lng: 28.8010 }] },
  { id: 'vieru', name: 'Bd. Grigore Vieru', district: 'Centru', path: [{ lat: 47.0180, lng: 28.8240 }, { lat: 47.0260, lng: 28.8420 }, { lat: 47.0330, lng: 28.8560 }] },
  { id: 'orhei', name: 'Calea Orheiului', district: 'Rîșcani', path: [{ lat: 47.0430, lng: 28.8660 }, { lat: 47.0560, lng: 28.8760 }, { lat: 47.0700, lng: 28.8860 }] },
  { id: 'creanga', name: 'Str. Ion Creangă', district: 'Buiucani', path: [{ lat: 47.0480, lng: 28.7960 }, { lat: 47.0410, lng: 28.7945 }, { lat: 47.0330, lng: 28.7930 }] },
  { id: 'ismail', name: 'Str. Ismail', district: 'Centru', path: [{ lat: 47.0310, lng: 28.8420 }, { lat: 47.0230, lng: 28.8400 }, { lat: 47.0140, lng: 28.8420 }] },
  { id: 'bucuresti', name: 'Str. București', district: 'Centru', path: [{ lat: 47.0310, lng: 28.8190 }, { lat: 47.0268, lng: 28.8330 }, { lat: 47.0235, lng: 28.8440 }] },
  { id: 'varlaam', name: 'Str. Mitropolit Varlaam', district: 'Centru', path: [{ lat: 47.0260, lng: 28.8180 }, { lat: 47.0220, lng: 28.8310 }, { lat: 47.0190, lng: 28.8420 }] },
  { id: 'kiev', name: 'Str. Kiev', district: 'Rîșcani', path: [{ lat: 47.0440, lng: 28.8500 }, { lat: 47.0470, lng: 28.8650 }] },
  { id: 'russo', name: 'Str. Alecu Russo', district: 'Rîșcani', path: [{ lat: 47.0540, lng: 28.8670 }, { lat: 47.0600, lng: 28.8760 }] },
  { id: 'sadoveanu', name: 'Str. Mihai Sadoveanu', district: 'Ciocana', path: [{ lat: 47.0410, lng: 28.8880 }, { lat: 47.0455, lng: 28.8960 }, { lat: 47.0500, lng: 28.9060 }] },
  { id: 'cuza', name: 'Str. Cuza Vodă', district: 'Botanica', path: [{ lat: 46.9870, lng: 28.8570 }, { lat: 46.9840, lng: 28.8660 }, { lat: 46.9810, lng: 28.8760 }] },
  { id: 'grenoble', name: 'Str. Grenoble', district: 'Botanica', path: [{ lat: 46.9960, lng: 28.8420 }, { lat: 46.9860, lng: 28.8480 }, { lat: 46.9760, lng: 28.8530 }] },
  { id: 'independentei', name: 'Str. Independenței', district: 'Botanica', path: [{ lat: 46.9860, lng: 28.8620 }, { lat: 46.9800, lng: 28.8720 }] },
  { id: 'traian', name: 'Bd. Traian', district: 'Botanica', path: [{ lat: 46.9820, lng: 28.8560 }, { lat: 46.9770, lng: 28.8660 }, { lat: 46.9730, lng: 28.8760 }] },
  { id: 'trandafirilor', name: 'Str. Trandafirilor', district: 'Botanica', path: [{ lat: 46.9915, lng: 28.8600 }, { lat: 46.9880, lng: 28.8640 }] },
  { id: 'columna', name: 'Str. Columna', district: 'Centru', path: [{ lat: 47.0330, lng: 28.8230 }, { lat: 47.0290, lng: 28.8330 }] },
];

export const STREET_BY_ID: Record<string, Street> = Object.fromEntries(STREETS.map((s) => [s.id, s]));
