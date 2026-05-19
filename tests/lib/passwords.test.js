import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/passwords.js';

describe('passwords', () => {
  it('hashes a password to a bcrypt string', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(hash).not.toBe('hunter2');
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword('hunter2', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
