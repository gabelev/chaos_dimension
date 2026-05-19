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
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
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
};
