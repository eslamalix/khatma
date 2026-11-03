import { bypassWorker, playableStreams, RADIO_STATIONS, streamAfter } from './radio.service';

describe('radio stations', () => {
  it('offers Saudi and Cairo, each with https streams', () => {
    expect(RADIO_STATIONS.map((s) => s.id)).toEqual(['saudi', 'cairo']);
    for (const s of RADIO_STATIONS) {
      expect(s.streams.length).toBeGreaterThan(1);
      for (const { url } of s.streams) expect(url.startsWith('https://')).toBe(true);
    }
  });

  it('leaves HLS out where the browser cannot play it', () => {
    const saudi = RADIO_STATIONS[0];
    expect(playableStreams(saudi, true)[0]).toContain('.m3u8');
    expect(playableStreams(saudi, false).some((u) => u.includes('.m3u8'))).toBe(false);
    expect(playableStreams(saudi, false).length).toBe(saudi.streams.length - 1);
  });

  it('keeps the service worker out of every stream', () => {
    for (const s of RADIO_STATIONS) {
      for (const url of playableStreams(s, true)) expect(new URL(url).searchParams.get('ngsw-bypass')).toBe('1');
    }
    expect(bypassWorker('https://a.example/live')).toBe('https://a.example/live?ngsw-bypass=1');
    expect(bypassWorker('https://a.example/live?x=1')).toBe('https://a.example/live?x=1&ngsw-bypass=1');
  });

  it('falls back through backup streams, then gives up', () => {
    expect(streamAfter(3, 0)).toBe(1);
    expect(streamAfter(3, 1)).toBe(2);
    expect(streamAfter(3, 2)).toBeNull();
    expect(streamAfter(0, 0)).toBeNull();
  });
});
