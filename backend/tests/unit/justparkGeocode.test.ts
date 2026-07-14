import { jest, describe, it, expect } from '@jest/globals';
import { resolveJustparkCoords } from '../../src/cron/providers/justpark';
import type { CarparkRecord } from '../../src/cron/pipeline/types';

const rec = (name: string, lat = 0, lng = 0): CarparkRecord => ({
  id: `CLND-${name}`, name, lat, lng, address: name, agency: 'CapitaLand', source: 'justpark',
  rates: [], availability: {}, lot_types: 'C', metadata: {},
} as CarparkRecord);

describe('resolveJustparkCoords', () => {
  it('geocodes sites shipped at 0,0 and fills in real coordinates', async () => {
    const geocodeFn = jest.fn<any>().mockResolvedValue({ lat: 1.3006, lng: 103.8455 });
    const records = [rec('Plaza Singapura')];
    const n = await resolveJustparkCoords(records, geocodeFn);
    expect(n).toBe(1);
    expect(records[0].lat).toBeCloseTo(1.3006);
    expect(records[0].lng).toBeCloseTo(103.8455);
  });

  it('leaves records that already have coordinates untouched and does not geocode them', async () => {
    const geocodeFn = jest.fn<any>().mockResolvedValue({ lat: 1, lng: 103 });
    const records = [rec('Bugis Junction', 1.2996, 103.8557)];
    const n = await resolveJustparkCoords(records, geocodeFn);
    expect(n).toBe(0);
    expect(geocodeFn).not.toHaveBeenCalled();
  });

  it('caches by name so a repeated mall is only geocoded once', async () => {
    const geocodeFn = jest.fn<any>().mockResolvedValue({ lat: 1.29, lng: 103.85 });
    await resolveJustparkCoords([rec('IMM'), rec('IMM')], geocodeFn);
    expect(geocodeFn).toHaveBeenCalledTimes(1);
  });

  it('leaves a site at 0,0 when geocoding fails (it will be geofenced out, as before)', async () => {
    const geocodeFn = jest.fn<any>().mockResolvedValue(null);
    const records = [rec('Nonexistent Mall XYZ')];
    const n = await resolveJustparkCoords(records, geocodeFn);
    expect(n).toBe(0);
    expect(records[0].lat).toBe(0);
  });
});
