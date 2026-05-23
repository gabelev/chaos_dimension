// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { createId } from '@paralleldrive/cuid2';
import { workstreams } from '../db/schema.js';

// Starter workstreams every new user lands with. Same shape as the demo
// seed in src/data/workstreams.js so new accounts feel populated rather
// than empty. Colors/icons match the demo for visual consistency.
const DEFAULTS = [
  { label: 'Research', color: '#4B0082', icon: '🔬', slug: 'research' },
  { label: 'Studio', color: '#B8860B', icon: '🎨', slug: 'studio' },
  { label: 'Writing', color: '#00008B', icon: '✍️', slug: 'writing' },
  { label: 'Build', color: '#006400', icon: '🔧', slug: 'build' },
  { label: 'Practice', color: '#8B008B', icon: '🎹', slug: 'practice' },
];

// Insert the starter workstreams for a newly-created user.
// Must be called inside a withUserContext(...) block so RLS WITH CHECK
// passes (it requires app.current_user_id to match the row's user_id).
export async function seedDefaultWorkstreams(tx, userId) {
  if (!userId) throw new Error('seedDefaultWorkstreams: userId required');
  const rows = DEFAULTS.map((w) => ({
    id: createId(),
    label: w.label,
    color: w.color,
    icon: w.icon,
    slug: w.slug,
    userId,
  }));
  await tx.insert(workstreams).values(rows);
  return rows;
}

export const DEFAULT_WORKSTREAM_LABELS = DEFAULTS.map((w) => w.label);
