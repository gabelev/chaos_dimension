import { describe, it, expect } from 'vitest';
import {
  generateOauthToken,
  hashToken,
  detectTokenKind,
  verifyPkceS256,
  signPayload,
  verifyPayload,
  PREFIX_ACCESS,
  PREFIX_REFRESH,
  PREFIX_CODE,
} from '../../src/lib/oauthCrypto.js';

describe('oauthCrypto', () => {
  it('generates a token with the requested prefix', () => {
    const t = generateOauthToken(PREFIX_ACCESS);
    expect(t.startsWith('cd_oat_')).toBe(true);
    expect(t.length).toBeGreaterThan(40);
  });

  it('hashes to 64-char hex', () => {
    expect(hashToken('cd_oat_x')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('detects token kind from prefix', () => {
    expect(detectTokenKind('cd_oat_xyz')).toBe('access');
    expect(detectTokenKind('cd_ort_xyz')).toBe('refresh');
    expect(detectTokenKind('cd_oac_xyz')).toBe('code');
    expect(detectTokenKind('cd_xyz')).toBe('agent');
    expect(detectTokenKind('garbage')).toBe('unknown');
  });

  it('verifies a valid PKCE S256 verifier', () => {
    // verifier = "test-verifier-value-of-sufficient-length-abcdefg"
    // S256(verifier) = base64url(sha256(verifier))
    const verifier = 'test-verifier-value-of-sufficient-length-abcdefg';
    const challenge = 'aPBVJbZcdO5F2leVsOgCUkzd6EqLZRfEKFnEbA-cAfE';
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });

  it('rejects an invalid PKCE verifier', () => {
    expect(verifyPkceS256('wrong', 'aPBVJbZcdO5F2leVsOgCUkzd6EqLZRfEKFnEbA-cAfE')).toBe(false);
  });

  it('round-trips a signed payload', () => {
    const secret = 'a'.repeat(32);
    const sig = signPayload({ x: 1 }, secret, 60);
    const out = verifyPayload(sig, secret);
    expect(out).toEqual({ x: 1 });
  });

  it('rejects an expired signed payload', () => {
    const secret = 'a'.repeat(32);
    const sig = signPayload({ x: 1 }, secret, -1);
    expect(verifyPayload(sig, secret)).toBeNull();
  });

  it('rejects a tampered signed payload', () => {
    const secret = 'a'.repeat(32);
    const sig = signPayload({ x: 1 }, secret, 60);
    const tampered = sig.slice(0, -2) + 'AA';
    expect(verifyPayload(tampered, secret)).toBeNull();
  });

  it('rejects a tampered body in a signed payload', () => {
    const secret = 'a'.repeat(32);
    const sig = signPayload({ x: 1 }, secret, 60);
    const [body, sigPart] = sig.split('.');
    const tamperedBody = body.slice(0, -2) + 'AA' + '.' + sigPart;
    expect(verifyPayload(tamperedBody, secret)).toBeNull();
  });

  it('refuses to sign a payload containing reserved key "exp"', () => {
    const secret = 'a'.repeat(32);
    expect(() => signPayload({ exp: 1234 }, secret, 60)).toThrow();
  });
});
