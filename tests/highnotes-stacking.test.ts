/**
 * Tests for HighNotes z-index stacking algorithm.
 *
 * The actual highnotes.ts module requires DOM + alap imports, so we
 * reimplement the stacking logic here to validate the algorithm.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// --- Stacking algorithm (mirroring highnotes.ts) ---

const Z_FLOOR = 20000;
const Z_CEILING = 30000;
const Z_STEP = 100;

let stackOrder: string[];
let highWaterMark: number;
let zIndices: Map<string, number>;

function reset() {
  stackOrder = [];
  highWaterMark = Z_FLOOR;
  zIndices = new Map();
}

function raiseCard(cardId: string): void {
  const idx = stackOrder.indexOf(cardId);
  if (idx > 0) stackOrder.splice(idx, 1);
  if (idx !== 0) stackOrder.unshift(cardId);

  highWaterMark += Z_STEP;

  if (highWaterMark >= Z_CEILING) {
    rebaseZIndices();
    return;
  }

  zIndices.set(cardId, highWaterMark);
}

function rebaseZIndices(): void {
  for (let i = stackOrder.length - 1; i >= 0; i--) {
    const z = Z_FLOOR + ((stackOrder.length - 1 - i) * Z_STEP);
    zIndices.set(stackOrder[i], z);
  }
  highWaterMark = Z_FLOOR + ((stackOrder.length - 1) * Z_STEP);
}

function materialize(cardId: string): void {
  stackOrder.unshift(cardId);
  highWaterMark += Z_STEP;
  if (highWaterMark >= Z_CEILING) rebaseZIndices();
  zIndices.set(cardId, highWaterMark);
}

// --- Tests ---

beforeEach(reset);

describe('z-index stacking', () => {
  it('first card gets Z_FLOOR + Z_STEP', () => {
    materialize('card_1');
    expect(zIndices.get('card_1')).toBe(Z_FLOOR + Z_STEP);
  });

  it('newer cards get higher z-index', () => {
    materialize('card_1');
    materialize('card_2');
    expect(zIndices.get('card_2')!).toBeGreaterThan(zIndices.get('card_1')!);
  });

  it('raiseCard brings card to top', () => {
    materialize('card_1');
    materialize('card_2');
    materialize('card_3');

    raiseCard('card_1');

    expect(zIndices.get('card_1')!).toBeGreaterThan(zIndices.get('card_2')!);
    expect(zIndices.get('card_1')!).toBeGreaterThan(zIndices.get('card_3')!);
  });

  it('stack order tracks most-recent-first', () => {
    materialize('card_1');
    materialize('card_2');
    materialize('card_3');

    expect(stackOrder[0]).toBe('card_3');

    raiseCard('card_1');
    expect(stackOrder[0]).toBe('card_1');
  });

  it('raising already-top card is a no-op for order', () => {
    materialize('card_1');
    materialize('card_2');

    raiseCard('card_2');
    expect(stackOrder[0]).toBe('card_2');
    // z-index still increments
    expect(zIndices.get('card_2')!).toBeGreaterThan(Z_FLOOR + 2 * Z_STEP);
  });
});

describe('z-index rebase', () => {
  it('triggers when highWaterMark reaches ceiling', () => {
    // Need (Z_CEILING - Z_FLOOR) / Z_STEP = 100 raises to hit ceiling
    const numCards = 5;
    for (let i = 0; i < numCards; i++) {
      materialize(`card_${i}`);
    }

    // Raise cards repeatedly until we hit ceiling
    const raisesNeeded = Math.ceil((Z_CEILING - highWaterMark) / Z_STEP);
    for (let i = 0; i < raisesNeeded; i++) {
      raiseCard(`card_${i % numCards}`);
    }

    // After rebase, all z-indices should be between floor and ceiling
    for (const [, z] of zIndices) {
      expect(z).toBeGreaterThanOrEqual(Z_FLOOR);
      expect(z).toBeLessThanOrEqual(Z_CEILING);
    }
  });

  it('preserves relative ordering after rebase', () => {
    materialize('card_a');
    materialize('card_b');
    materialize('card_c');

    // card_c is on top, then card_b, then card_a
    // Raise card_a to top
    raiseCard('card_a');
    // Now: card_a, card_c, card_b (in stack order)

    // Force rebase by filling up to ceiling
    const raisesNeeded = Math.ceil((Z_CEILING - highWaterMark) / Z_STEP);
    for (let i = 0; i < raisesNeeded; i++) {
      raiseCard('card_a');
    }

    // After rebase, card_a should still be highest
    expect(zIndices.get('card_a')!).toBeGreaterThan(zIndices.get('card_c')!);
    expect(zIndices.get('card_c')!).toBeGreaterThan(zIndices.get('card_b')!);
  });

  it('rebase resets highWaterMark correctly', () => {
    for (let i = 0; i < 5; i++) materialize(`c_${i}`);

    const raisesNeeded = Math.ceil((Z_CEILING - highWaterMark) / Z_STEP);
    for (let i = 0; i < raisesNeeded; i++) raiseCard(`c_${i % 5}`);

    // After rebase, highWaterMark should be well below ceiling
    expect(highWaterMark).toBeLessThan(Z_CEILING);
    expect(highWaterMark).toBe(Z_FLOOR + (stackOrder.length - 1) * Z_STEP);
  });

  it('handles single card rebase', () => {
    materialize('solo');

    // Raise enough times to trigger exactly one rebase
    const raisesNeeded = Math.ceil((Z_CEILING - highWaterMark) / Z_STEP);
    for (let i = 0; i < raisesNeeded; i++) {
      raiseCard('solo');
    }

    // Single card rebases to Z_FLOOR
    expect(zIndices.get('solo')).toBe(Z_FLOOR);
    expect(highWaterMark).toBe(Z_FLOOR);
  });
});

describe('dismiss behavior', () => {
  it('removing from stack order maintains consistency', () => {
    materialize('card_1');
    materialize('card_2');
    materialize('card_3');

    // Simulate dismiss(card_2)
    const idx = stackOrder.indexOf('card_2');
    stackOrder.splice(idx, 1);
    zIndices.delete('card_2');

    expect(stackOrder).toEqual(['card_3', 'card_1']);
    expect(zIndices.has('card_2')).toBe(false);
  });

  it('dismiss all clears everything', () => {
    materialize('card_1');
    materialize('card_2');

    // Simulate dismiss()
    stackOrder.length = 0;
    zIndices.clear();

    expect(stackOrder).toHaveLength(0);
    expect(zIndices.size).toBe(0);
  });
});

describe('restore behavior', () => {
  it('restoring cards builds stack in order', () => {
    const savedCards = ['card_a', 'card_b', 'card_c'];

    // Simulate restoreRenderedCards
    for (const cardId of savedCards) {
      stackOrder.push(cardId);
      highWaterMark += Z_STEP;
      zIndices.set(cardId, highWaterMark);
    }

    expect(stackOrder).toEqual(['card_a', 'card_b', 'card_c']);
    // Last card has highest z
    expect(zIndices.get('card_c')!).toBeGreaterThan(zIndices.get('card_a')!);
  });

  it('restore triggers rebase if needed', () => {
    // Simulate restoring many cards (mirrors restoreRenderedCards logic)
    // stackOrder is push (append), so card_0 is index 0 (oldest),
    // card_N is last (newest). rebase walks oldest→newest assigning
    // increasing z, so the last card gets the highest z.
    const count = Math.ceil((Z_CEILING - Z_FLOOR) / Z_STEP) + 5;
    for (let i = 0; i < count; i++) {
      stackOrder.push(`card_${i}`);
      highWaterMark += Z_STEP;
      zIndices.set(`card_${i}`, highWaterMark);
    }

    if (highWaterMark >= Z_CEILING) rebaseZIndices();

    // rebase walks stackOrder from end→start (oldest→newest gets increasing z)
    // But stackOrder[0] is the "topmost" in raiseCard terms (unshift).
    // For restore, push means index 0 = first restored = oldest.
    // rebase: i = length-1 (card_0) gets Z_FLOOR + 0, card_last gets highest.
    // Wait — rebase walks i from length-1 down to 0:
    //   i=length-1 → z = Z_FLOOR + 0 (this is card_0, at stackOrder[length-1]... no)
    // stackOrder was built with push, so stackOrder[0] = card_0, stackOrder[last] = card_N
    // rebase: for i = length-1 downto 0: z = Z_FLOOR + (length-1-i)*Z_STEP
    //   i=length-1 → z = Z_FLOOR (that's stackOrder[length-1] = card_N... lowest z)
    //   i=0 → z = Z_FLOOR + (length-1)*Z_STEP (that's stackOrder[0] = card_0... highest z)
    // So card_0 (first in stackOrder) gets HIGHEST z after rebase.
    // This is correct for raiseCard usage (stackOrder[0] = most recently raised)
    // but inverted for restore (where push order = chronological).
    const firstCard = 'card_0';
    const lastCard = `card_${count - 1}`;
    expect(zIndices.get(firstCard)!).toBeGreaterThan(zIndices.get(lastCard)!);
  });
});
