import { describe, expect, it } from 'vitest';
import { TICK, TYPE_TICKS, beats } from '../../src/lib/heroTimeline';

const SQUEEZE = 6; // CROWD_WIDE has six steps

describe('the hero timeline', () => {
  // Mutation: raise TYPE_AT, CROWD_AT, CROWD_STEP or TYPE_TICKS back to the old values.
  it('starts filing into the Canon window within two seconds, in every variant', () => {
    for (const variant of ['scatter', 'cards', 'tabs']) {
      expect(beats(variant, SQUEEZE, true).filedAt * TICK, variant).toBeLessThanOrEqual(2000);
      expect(beats(variant, SQUEEZE, false).filedAt * TICK, variant).toBeLessThanOrEqual(2000);
    }
  });

  it('keeps the beats in order: type, send, file, leave', () => {
    for (const variant of ['scatter', 'tabs']) {
      const b = beats(variant, SQUEEZE, true);
      expect(b.replyAt).toBeGreaterThan(b.typeAt + TYPE_TICKS);
      expect(b.filedAt).toBeGreaterThan(b.replyAt);
      expect(b.outAt).toBeGreaterThan(b.filedAt);
    }
  });

  it('types only after the tabs have finished crowding in', () => {
    // CROWD_AT 6 plus six steps of 2 ticks ends the squeeze at tick 18.
    expect(beats('tabs', SQUEEZE, true).typeAt).toBeGreaterThan(18);
  });
});
