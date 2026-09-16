import { pendingFor, Reading } from '../reading/reading';
import { CloudAccount, isDeviceTakeover } from './cloud-sync';

const account = (uid: string, anonymous = false): CloudAccount => ({
  uid,
  anonymous,
  name: null,
  email: null,
  photoUrl: null,
});

const reading = (id: string, syncedTo?: string): Reading => ({
  id,
  page: 1,
  khatma: 1,
  startAt: 0,
  endAt: 60_000,
  durationMs: 60_000,
  synced: syncedTo ? 1 : 0,
  syncedTo,
});

describe('isDeviceTakeover', () => {
  it('lets an account back into its own device', () => {
    expect(isDeviceTakeover('eslam', account('eslam'))).toBe(false);
  });

  it('holds another person signing in on a device that holds someone else data', () => {
    expect(isDeviceTakeover('eslam', account('other'))).toBe(true);
  });

  it('lets the first account claim a device that has only been used anonymously', () => {
    expect(isDeviceTakeover(null, account('eslam'))).toBe(false);
  });

  it('never holds the anonymous session itself', () => {
    expect(isDeviceTakeover('eslam', account('anon', true))).toBe(false);
  });
});

describe('pendingFor', () => {
  it('sends up what this account has never received', () => {
    const readings = [reading('a', 'eslam'), reading('b'), reading('c', 'old-anonymous-uid')];
    expect(pendingFor(readings, 'eslam').map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('sends nothing up when the account already has everything', () => {
    expect(pendingFor([reading('a', 'eslam'), reading('b', 'eslam')], 'eslam')).toEqual([]);
  });

  it('treats a whole history synced to a previous account as pending', () => {
    const readings = [reading('a', 'first'), reading('b', 'first')];
    expect(pendingFor(readings, 'second')).toHaveLength(2);
  });
});
