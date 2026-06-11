// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
async function request(path, opts = {}) {
  const { skipAuthRedirect, ...rest } = opts;
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...rest,
    body: rest.body ? JSON.stringify(rest.body) : undefined,
  });
  if (res.status === 401 && !skipAuthRedirect) {
    window.location.href = '/login';
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText || 'Request failed'}`;
    try {
      const body = await res.json();
      if (body?.message) detail = body.message;
      else if (body?.error) detail = body.error;
    } catch {
      // body wasn't JSON; keep the status-line detail
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  me: () => request('/api/me'),
  // skipAuthRedirect — these endpoints' 401 is the legitimate response,
  // not a "your session expired, send them to /login" signal.
  login: ({ email, password }) => request('/api/login', { method: 'POST', body: { email, password }, skipAuthRedirect: true }),
  signup: ({ email, password, inviteCode }) => request('/api/signup', { method: 'POST', body: { email, password, invite_code: inviteCode }, skipAuthRedirect: true }),
  logout: () => request('/api/logout', { method: 'POST' }),
  listTasks: () => request('/api/tasks'),
  createTask: (task) => request('/api/tasks', { method: 'POST', body: task }),
  updateTask: (id, updates) => request(`/api/tasks/${id}`, { method: 'PATCH', body: updates }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  listAgents: () => request('/api/agents'),
  updateAgent: (id, updates) => request(`/api/agents/${id}`, { method: 'PATCH', body: updates }),
  listWorkstreams: () => request('/api/workstreams'),
  createWorkstream: (ws) => request('/api/workstreams', { method: 'POST', body: ws }),
  updateWorkstream: (id, updates) => request(`/api/workstreams/${id}`, { method: 'PATCH', body: updates }),
  deleteWorkstream: (id) => request(`/api/workstreams/${id}`, { method: 'DELETE' }),
  // Spec / requirements docs. listSpecs() with no args returns metadata for all
  // specs; pass { task } or { workstream } to filter. getSpec returns full content.
  listSpecs: (filters = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return request(`/api/specs${qs ? `?${qs}` : ''}`);
  },
  getSpec: (id) => request(`/api/specs/${id}`),
  getSpecRevision: (id, version) => request(`/api/specs/${id}?version=${version}`),
  createSpec: (spec) => request('/api/specs', { method: 'POST', body: spec }),
  updateSpec: (id, updates) => request(`/api/specs/${id}`, { method: 'PATCH', body: updates }),
  deleteSpec: (id) => request(`/api/specs/${id}`, { method: 'DELETE' }),
  // MCP credential management — used by the Connect AI walk-through.
  listMyTokens: () => request('/api/agent-tokens'),
  mintToken: (label) => request('/api/agent-tokens', { method: 'POST', body: { label } }),
  revokeToken: (id) => request(`/api/agent-tokens/${id}`, { method: 'DELETE' }),
  listMyOauthClients: () => request('/api/oauth/clients/mine'),
  // Onboarding coach state — read flags, dismiss the coach, or reset to re-open it.
  getOnboarding: () => request('/api/me/onboarding'),
  dismissOnboarding: () => request('/api/me/onboarding', { method: 'POST', body: { action: 'dismiss' } }),
  resetOnboarding: () => request('/api/me/onboarding', { method: 'POST', body: { action: 'reset' } }),
  // Owner admin — all of these 403 for non-owner sessions.
  listInvites: () => request('/api/admin/invites'),
  mintInvite: (note = '') => request('/api/admin/invites', { method: 'POST', body: { note } }),
  revokeInvite: (id) => request(`/api/admin/invites/${id}`, { method: 'DELETE' }),
  listUsers: () => request('/api/admin/users'),
  resetUserPassword: (id, password) => request(`/api/admin/users/${id}`, { method: 'PATCH', body: password ? { password } : {} }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  listWaitlist: () => request('/api/waitlist'),
  inviteFromWaitlist: (id) => request(`/api/admin/waitlist/${id}`, { method: 'POST' }),
  deleteWaitlistEntry: (id) => request(`/api/admin/waitlist/${id}`, { method: 'DELETE' }),
};
