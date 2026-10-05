import { RADIO_STATIONS, streamAfter } from './radio.service';

describe('radio stations', () => {
  it('offers Saudi and Cairo, each with an https stream', () => {
    expect(RADIO_STATIONS.map((s) => s.id)).toEqual(['saudi', 'cairo']);
    for (const s of RADIO_STATIONS) {
      expect(s.streams.length).toBeGreaterThan(0);
      for (const url of s.streams) expect(url.startsWith('https://')).toBe(true);
    }
  });

  it('falls back through backup streams, then gives up', () => {
    const saudi = RADIO_STATIONS[0];
    expect(streamAfter(saudi, 0)).toBe(1);
    expect(streamAfter(saudi, 1)).toBeNull();
    expect(streamAfter(RADIO_STATIONS[1], 0)).toBeNull();
  });
});
