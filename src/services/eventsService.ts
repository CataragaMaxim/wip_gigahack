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
