import { describe, it, expect } from '@jest/globals';
import { buildSourceIdIndex, resolveCarparkIds } from '../../src/cron/pipeline/idResolution';

describe('buildSourceIdIndex', () => {
  it('groups carpark ids by source and source id', () => {
    const index = buildSourceIdIndex([
      { id: 'URA-J0122', sourceIds: { datamall: 'URA-J0122', parkaholic: 'J0122' } },
      { id: 'J0122', sourceIds: { parkaholic: 'J0122' } },
      { id: 'CY', sourceIds: { gov: 'CY', datamall: 'URA-Q0006' } },
    ]);

    expect(index.datamall['URA-J0122']).toEqual(['URA-J0122']);
    expect(index.datamall['URA-Q0006']).toEqual(['CY']);
    expect(index.parkaholic['J0122'].sort()).toEqual(['J0122', 'URA-J0122']);
  });

  it('skips empty source ids', () => {
    const index = buildSourceIdIndex([{ id: 'A', sourceIds: { datamall: '' } }]);
    expect(index.datamall).toBeUndefined();
  });
});

describe('resolveCarparkIds', () => {
  const index = buildSourceIdIndex([
    { id: 'URA-J0122', sourceIds: { datamall: 'URA-J0122', parkaholic: 'J0122' } },
    { id: 'J0122', sourceIds: { parkaholic: 'J0122' } },
    { id: 'CY', sourceIds: { gov: 'CY', datamall: 'URA-Q0006' } },
    { id: 'JP-CP', sourceIds: { justpark: 'jp-77' } },
  ]);

  it('maps a datamall id onto the carpark it merged into', () => {
    expect(resolveCarparkIds(index, 'datamall', 'URA-Q0006').sort()).toEqual(['CY', 'Q0006', 'URA-Q0006']);
  });

  it('includes the unprefixed datamall id so legacy bare-id rows stay in sync', () => {
    expect(resolveCarparkIds(index, 'datamall', 'URA-J0122').sort()).toEqual(['J0122', 'URA-J0122']);
  });

  it('maps a parkaholic id onto every carpark that claims it', () => {
    expect(resolveCarparkIds(index, 'parkaholic', 'J0122').sort()).toEqual(['J0122', 'URA-J0122']);
  });

  it('maps a justpark id through source ids like the previous justpark-only mapping', () => {
    expect(resolveCarparkIds(index, 'justpark', 'jp-77').sort()).toEqual(['JP-CP', 'jp-77']);
  });

  it('falls back to the provider id when nothing matches', () => {
    expect(resolveCarparkIds(index, 'gov', 'B65')).toEqual(['B65']);
  });
});
