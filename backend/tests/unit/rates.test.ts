import { describe, it, expect } from '@jest/globals';
import { parseText } from '../../src/cron/pipeline/rates';

describe('parseText dollar amounts', () => {
  it('parses a single-decimal price without truncating the cents', () => {
    const out = parseText('$1.5 per hour', 'test');
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(1.5);
  });

  it('parses a two-decimal price', () => {
    expect(parseText('$10.50 per hour', 'test')[0].amount).toBe(10.5);
  });

  it('parses a whole-dollar price', () => {
    expect(parseText('$2 per entry', 'test')[0].amount).toBe(2);
  });

  it('reads first and subsequent single-decimal amounts', () => {
    const out = parseText('First 1 hour $2.5, subsequent $1.2 per 30 min', 'test');
    expect(out.map(r => r.amount)).toEqual([2.5, 1.2]);
  });

  it('returns a free entry when no amount is present', () => {
    const out = parseText('Free parking on Sundays', 'test');
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(0);
    expect(out[0].unit).toBe('free');
  });
});
