import { describe, it, expect } from 'vitest';
import { issueAuthCode, consumeAuthCode } from '../../src/lib/oauthCodes.js';
import { hashToken } from '../../src/lib/oauthCrypto.js';

function makeDb(initial = []) {
  const rows = [...initial];
  return {
    rows,
    insert: () => ({ values: (row) => ({ returning: async () => { rows.push(row); return [row]; } }) }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: async (n) => rows.slice(0, n) }),
      }),
    }),
    update: () => ({
      set: (patch) => ({
        where: () => {
          // The only conditional update in oauthCodes is `consumedAt IS NULL`,
          // so simulate that semantics directly: if the row's consumedAt was
          // already set, the conditional update returns no rows; otherwise it
          // applies and returns the updated row. Memoize so awaiting both the
          // where() result and chained .returning() doesn't double-apply.
          let result;
          const apply = async () => {
            if (result !== undefined) return result;
            if (!rows[0]) { result = []; return result; }
            if ('consumedAt' in patch && rows[0].consumedAt != null) { result = []; return result; }
            Object.assign(rows[0], patch);
            result = [rows[0]];
            return result;
          };
          const thenable = { then: (res, rej) => apply().then(res, rej), returning: apply };
          return thenable;
        },
      }),
    }),
  };
}

describe('oauthCodes', () => {
  it('issueAuthCode returns the raw code and stores its hash', async () => {
    const db = makeDb();
    const res = await issueAuthCode(db, {
      clientId: 'c1', redirectUri: 'https://x/cb',
      codeChallenge: 'abc', codeChallengeMethod: 'S256',
      scope: 'mcp', state: 's',
    });
    expect(res.code).toMatch(/^cd_oac_/);
    expect(db.rows[0].codeHash).toBe(hashToken(res.code));
    expect(db.rows[0].consumedAt).toBeNull();
  });

  it('consumeAuthCode returns the row and marks it consumed on first use', async () => {
    const db = makeDb([{
      id: 'r1', codeHash: hashToken('cd_oac_known'), clientId: 'c1',
      redirectUri: 'https://x/cb', codeChallenge: 'abc', codeChallengeMethod: 'S256',
      scope: 'mcp', state: 's',
      expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
    }]);
    const out = await consumeAuthCode(db, 'cd_oac_known');
    expect(out.ok).toBe(true);
    expect(out.row.clientId).toBe('c1');
    expect(db.rows[0].consumedAt).not.toBeNull();
  });

  it('consumeAuthCode rejects an expired code', async () => {
    const db = makeDb([{
      id: 'r1', codeHash: hashToken('cd_oac_old'), clientId: 'c1',
      redirectUri: 'https://x/cb', codeChallenge: 'abc', codeChallengeMethod: 'S256',
      scope: 'mcp', state: 's',
      expiresAt: new Date(Date.now() - 1000), consumedAt: null,
    }]);
    const out = await consumeAuthCode(db, 'cd_oac_old');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('expired');
  });

  it('consumeAuthCode reports reuse on a second consume', async () => {
    const consumed = {
      id: 'r1', codeHash: hashToken('cd_oac_used'), clientId: 'c1',
      redirectUri: 'https://x/cb', codeChallenge: 'abc', codeChallengeMethod: 'S256',
      scope: 'mcp', state: 's',
      expiresAt: new Date(Date.now() + 60_000), consumedAt: new Date(),
    };
    const db = makeDb([consumed]);
    const out = await consumeAuthCode(db, 'cd_oac_used');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('reuse');
    expect(out.row.clientId).toBe('c1');
  });

  it('consumeAuthCode returns not_found for unknown codes', async () => {
    const db = makeDb();
    const out = await consumeAuthCode(db, 'cd_oac_nope');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('not_found');
  });
});
