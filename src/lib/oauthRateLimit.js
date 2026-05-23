// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { eq } from 'drizzle-orm';
import { oauthRateLimits } from '../db/schema.js';

export async function checkRateLimit(db, { bucket, limit, windowSeconds }) {
  const rows = await db
    .select()
    .from(oauthRateLimits)
    .where(eq(oauthRateLimits.bucket, bucket))
    .limit(1);

  const now = new Date();
  if (!rows.length) {
    await db.insert(oauthRateLimits).values({ bucket, windowStart: now, count: 1 }).returning();
    return { allowed: true };
  }

  const row = rows[0];
  const windowAge = (now.getTime() - new Date(row.windowStart).getTime()) / 1000;
  if (windowAge >= windowSeconds) {
    await db.update(oauthRateLimits).set({ windowStart: now, count: 1 }).where(eq(oauthRateLimits.id, row.id));
    return { allowed: true };
  }

  if (row.count >= limit) return { allowed: false, retryAfter: Math.ceil(windowSeconds - windowAge) };

  await db.update(oauthRateLimits).set({ count: row.count + 1 }).where(eq(oauthRateLimits.id, row.id));
  return { allowed: true };
}

export function ipBucket(name, req) {
  const fwd = req.headers?.['x-forwarded-for'] || '';
  const ip = String(fwd).split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  return `${name}:${ip}`;
}
