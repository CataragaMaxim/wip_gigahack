import { firebaseEventsService } from './firebaseEventsService';
import { createMockEvents } from '@/data/mockEvents';
import type { UrbanEvent } from '@/types';

/**
 * Stratul de date. Componentele depind doar de această interfață,
 * așa că trecerea de la datele demonstrative la Firebase nu atinge UI-ul.
 * Vezi src/services/README.md.
 */
export interface EventsService {
  list(): Promise<UrbanEvent[]>;
  /**
   * Ascultă evenimentele în timp real: `onData` primește lista completă la pornire și după fiecare schimbare
   * (raportare nouă, vot, actualizare din fluxurile oficiale). Întoarce funcția de dezabonare.
   */
  subscribe(onData: (events: UrbanEvent[]) => void, onError: (e: unknown) => void): () => void;
  create(event: UrbanEvent): Promise<UrbanEvent>;
  remove(id: string): Promise<void>;
  vote(id: string, vote: 'yes' | 'no'): Promise<void>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Implementare demonstrativă, în memorie. */
export const mockEventsService: EventsService = {
  async list() {
    await wait(450);
    return createMockEvents();
  },
  subscribe(onData) {
    const timer = window.setTimeout(() => onData(createMockEvents()), 450);
    return () => window.clearTimeout(timer);
  },
  async create(event) {
    await wait(250);
    return event;
  },
  async remove() {
    await wait(150);
  },
  async vote() {
    await wait(100);
  },
};

export const eventsService: EventsService = firebaseEventsService;
