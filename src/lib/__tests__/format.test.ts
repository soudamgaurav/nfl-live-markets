import { describe, expect, it } from 'vitest';
import { decimalsForTick, formatCents, roundToTick, spreadOf } from '../format';

describe('format', () => {
  it('derives decimals from tick size', () => {
    expect(decimalsForTick(0.01)).toBe(2);
    expect(decimalsForTick(0.001)).toBe(3);
    expect(decimalsForTick(0.0001)).toBe(4);
  });

  it('rounds to the tick without float noise', () => {
    expect(roundToTick(0.5349, 0.01)).toBe(0.53);
    expect(roundToTick(0.1 + 0.2, 0.01)).toBe(0.3);
  });

  it('shows cents at the right precision for the tick', () => {
    expect(formatCents(0.53, 0.01)).toBe('53¢');
    expect(formatCents(0.531, 0.001)).toBe('53.1¢');
    expect(formatCents(null, 0.01)).toBe('—');
  });

  it('computes spread as ask minus bid, clean', () => {
    expect(spreadOf(0.52, 0.55, 0.01)).toBe(0.03);
    expect(spreadOf(0.1, 0.3, 0.01)).toBe(0.2);
    expect(spreadOf(null, 0.55, 0.01)).toBeNull();
  });
});
