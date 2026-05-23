// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
// Bumped to v2 so visitors with cached demo state from the previous
// (real-looking) seed get the new dummy data on next load.
const KEYS = {
  tasks: 'chaos_demo_tasks_v2',
  agents: 'chaos_demo_agents_v2',
  workstreams: 'chaos_demo_workstreams_v2',
};

// Legacy keys from v1, removed eagerly so we don't leak the old seed
// through inspector / export tooling.
const LEGACY_KEYS = ['chaos_demo_tasks', 'chaos_demo_agents', 'chaos_demo_workstreams'];
if (typeof localStorage !== 'undefined') {
  for (const k of LEGACY_KEYS) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

export function loadDemo(name, fallback) {
  try {
    const raw = localStorage.getItem(KEYS[name]);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse / access errors
  }
  return fallback;
}

export function saveDemo(name, value) {
  try {
    localStorage.setItem(KEYS[name], JSON.stringify(value));
  } catch {
    // ignore quota or private-mode errors
  }
}

export function clearDemo() {
  for (const key of Object.values(KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function localId(prefix = 'demo') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
