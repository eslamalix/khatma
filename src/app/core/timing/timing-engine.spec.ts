import { PageVisit, TimingEngine } from './timing-engine';

const SEC = 1000;
const MIN = 60 * SEC;

function setup() {
  let t = 1_000_000;
  const visits: PageVisit[] = [];
  const engine = new TimingEngine((v) => visits.push(v), { idleMs: 3 * MIN, idleCreditMs: 90 * SEC, minMs: 10 * SEC }, () => t);
  const advance = (ms: number, step = SEC) => {
    for (let done = 0; done < ms; done += step) {
      t += Math.min(step, ms - done);
      engine.tick();
    }
  };
  return { engine, visits, advance, now: () => t };
}

describe('TimingEngine', () => {
  it('records the time spent on a page when moving to the next', () => {
    const { engine, visits, advance } = setup();
    engine.open(50);
    advance(64 * SEC);
    engine.open(51);
    expect(visits).toHaveLength(1);
    expect(visits[0].page).toBe(50);
    expect(visits[0].durationMs).toBe(64 * SEC);
    expect(visits[0].endAt - visits[0].startAt).toBe(64 * SEC);
  });

  it('drops visits shorter than 10 seconds (flipping through)', () => {
    const { engine, visits, advance } = setup();
    engine.open(1);
    advance(9 * SEC);
    engine.open(2);
    advance(10 * SEC);
    engine.close();
    expect(visits.map((v) => v.page)).toEqual([2]);
  });

  it('pauses while the app is hidden', () => {
    const { engine, visits, advance } = setup();
    engine.open(10);
    advance(30 * SEC);
    engine.setVisible(false);
    advance(10 * MIN);
    engine.setVisible(true);
    advance(20 * SEC);
    engine.close();
    expect(visits[0].durationMs).toBe(50 * SEC);
  });

  it('keeps a long silent read shorter than the idle limit', () => {
    const { engine, visits, advance } = setup();
    engine.open(3);
    advance(2 * MIN + 50 * SEC);
    engine.open(4);
    expect(visits[0].durationMs).toBe(2 * MIN + 50 * SEC);
  });

  it('stops counting when the reader walks away, crediting only a reading allowance', () => {
    const { engine, visits, advance } = setup();
    engine.open(7);
    advance(20 * SEC);
    engine.activity();
    advance(30 * MIN);
    engine.close();
    expect(visits[0].durationMs).toBe(20 * SEC + 90 * SEC);
  });

  it('resumes on the same page after idling', () => {
    const { engine, visits, advance } = setup();
    engine.open(8);
    advance(5 * MIN);
    engine.activity();
    advance(40 * SEC);
    engine.close();
    expect(visits[0].durationMs).toBe(90 * SEC + 40 * SEC);
  });

  it('reports live elapsed time', () => {
    const { engine, advance } = setup();
    engine.open(9);
    advance(15 * SEC);
    expect(engine.elapsedMs()).toBe(15 * SEC);
  });
});
