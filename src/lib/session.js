export const SESSION_COOKIE_NAME = 'chaos_session';

export function sessionOptions() {
  const password = process.env.CHAOS_SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error('CHAOS_SESSION_SECRET must be set and at least 32 chars');
  }
  return {
    password,
    cookieName: SESSION_COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    },
  };
}
