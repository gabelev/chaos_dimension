async function request(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
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
  login: (password) => request('/api/login', { method: 'POST', body: { password } }),
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
};
