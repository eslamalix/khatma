import { beforeEach, describe, expect, it } from 'vitest';
import { Onboarding } from './onboarding';

describe('Onboarding', () => {
  beforeEach(() => localStorage.clear());

  it('welcomes a newcomer once, and never someone who has already read', () => {
    const first = new Onboarding();
    first.maybeWelcome(false);
    expect(first.welcomeOpen()).toBe(true);
    first.finishWelcome();
    const again = new Onboarding();
    again.maybeWelcome(false);
    expect(again.welcomeOpen()).toBe(false);

    localStorage.clear();
    const reader = new Onboarding();
    reader.maybeWelcome(true);
    expect(reader.welcomeOpen()).toBe(false);
  });

  it('shows each tip until dismissed, and all of them again on replay', () => {
    const o = new Onboarding();
    expect(o.shouldShow('reader')).toBe(true);
    o.dismiss('reader');
    expect(new Onboarding().shouldShow('reader')).toBe(false);
    expect(o.shouldShow('tadabbur')).toBe(true);
    o.replay();
    expect(o.shouldShow('reader')).toBe(true);
    expect(o.welcomeOpen()).toBe(true);
  });
});
