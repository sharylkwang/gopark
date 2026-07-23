import { describe, it, expect } from '@jest/globals';
import { parseIncident } from '../../src/providers/traffic/parse';

describe('parseIncident', () => {
  it('splits the datamall timestamp prefix into a clock time and clean headline', () => {
    const out = parseIncident({
      Type: 'Accident',
      Latitude: 1.3521,
      Longitude: 103.8198,
      Message: '(20/7)21:29 Accident on PIE (towards Tuas) after Jurong Exit. Avoid lane 1.',
    });
    expect(out).not.toBeNull();
    expect(out!.time).toBe('21:29');
    expect(out!.headline).toBe('Accident on PIE (towards Tuas) after Jurong Exit. Avoid lane 1.');
    expect(out!.type).toBe('Accident');
    expect(out!.lat).toBeCloseTo(1.3521);
  });

  it('keeps the full message as headline when no timestamp prefix exists', () => {
    const out = parseIncident({ Type: 'Roadwork', Latitude: 1.3, Longitude: 103.8, Message: 'Road Works on TPE at Loyang.' });
    expect(out!.time).toBeNull();
    expect(out!.headline).toBe('Road Works on TPE at Loyang.');
  });

  it('pads single digit hours', () => {
    const out = parseIncident({ Type: 'Roadwork', Latitude: 1.3, Longitude: 103.8, Message: '(3/1)7:05 Road Works on AYE.' });
    expect(out!.time).toBe('07:05');
  });

  it('rejects records without coordinates or message', () => {
    expect(parseIncident({ Type: 'Accident', Message: 'x' })).toBeNull();
    expect(parseIncident({ Type: 'Accident', Latitude: 1.3, Longitude: 103.8, Message: '' })).toBeNull();
  });

  it('builds a stable id from position and headline', () => {
    const rec = { Type: 'Accident', Latitude: 1.35211111, Longitude: 103.81981111, Message: '(20/7)21:29 Accident on PIE.' };
    expect(parseIncident(rec)!.id).toBe(parseIncident({ ...rec })!.id);
  });
});
