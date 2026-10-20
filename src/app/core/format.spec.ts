import { clock, counted, DAYS, hoursAndMinutes, MINUTES, minSec, percent, shortDuration } from './format';

describe('format', () => {
  it('formats clocks with Arabic digits', () => {
    expect(clock(38_656_000)).toBe('١٠:٤٤:١٦');
    expect(minSec(64_000)).toBe('١:٠٤');
    expect(percent(0.919)).toBe('٩٢٪');
  });

  it('uses Arabic counted-noun grammar', () => {
    expect(counted(1, MINUTES)).toBe('دقيقة');
    expect(counted(2, MINUTES)).toBe('دقيقتان');
    expect(counted(5, MINUTES)).toBe('٥ دقائق');
    expect(counted(44, MINUTES)).toBe('٤٤ دقيقة');
    expect(counted(13, DAYS)).toBe('١٣ يوماً');
  });

  it('bends the dual after prepositions and objects', () => {
    expect(counted(2, DAYS, true)).toBe('يومين');
    expect(counted(2, MINUTES, true)).toBe('دقيقتين');
    expect(counted(1, DAYS, true)).toBe('يوم');
    expect(counted(5, DAYS, true)).toBe('٥ أيام');
    expect(hoursAndMinutes(7_200_000, true)).toEqual({ hours: 'ساعتين', minutes: '' });
  });

  it('splits hours and minutes', () => {
    expect(hoursAndMinutes(38_656_000)).toEqual({ hours: '١٠ ساعات', minutes: '٤٤ دقيقة' });
    expect(hoursAndMinutes(3_600_000)).toEqual({ hours: 'ساعة', minutes: '' });
    expect(shortDuration(35_520_000)).toBe('٩ س ٥٢ د');
  });
});
