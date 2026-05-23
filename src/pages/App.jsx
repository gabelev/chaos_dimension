import { useState, useEffect, useCallback } from 'react';
import { WORKSTREAMS as SEED_WORKSTREAMS, COLUMNS, COL_LABELS } from '../data/workstreams';
import { SEED_TASKS, SEED_AGENTS } from '../data/seed';
import MacWindow from '../components/MacWindow';
import { MenuBar, MenuBarItem, MenuDropdown, FilterPill } from '../components/MenuBar';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import AgentCard from '../components/AgentCard';
import AboutDialog from '../components/AboutDialog';
import WorkstreamModal from '../components/WorkstreamModal';
import { api } from '../lib/api';
import { loadDemo, saveDemo, clearDemo, localId, slugify } from '../lib/demoStorage';
import { useIsMobile } from '../lib/useIsMobile';
import { useTheme, THEME_LIST } from '../themes';

export default function App({ mode = 'live' }) {
  const { theme, themeId, setThemeId } = useTheme();
  const MAC = theme;
  const GLOBAL_CSS = theme.GLOBAL_CSS;
  const isDemo = mode === 'demo';
  const [tasks, setTasks] = useState(isDemo ? loadDemo('tasks', SEED_TASKS) : []);
  const [agents, setAgents] = useState(isDemo ? loadDemo('agents', SEED_AGENTS) : []);
  const [workstreams, setWorkstreams] = useState(isDemo ? loadDemo('workstreams', SEED_WORKSTREAMS) : {});
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filterWorkstream, setFilterWorkstream] = useState("all");
  const [dragState, setDragState] = useState({ taskId: null, overCol: null });
  const [clock, setClock] = useState(new Date());
  const [activeMenu, setActiveMenu] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showWorkstreams, setShowWorkstreams] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (isDemo) return;

    const fetchAll = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      Promise.all([api.listTasks(), api.listAgents(), api.listWorkstreams()])
        .then(([t, a, ws]) => {
          setTasks(t);
          setAgents(a);
          setWorkstreams(Object.fromEntries(ws.map(w => [w.id, { label: w.label, color: w.color, icon: w.icon }])));
        })
        .catch((err) => console.error('refresh failed', err));
    };

    fetchAll();
    const interval = setInterval(fetchAll, 10000);

    const onVisibility = () => { if (!document.hidden) fetchAll(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isDemo]);

  // Persist demo state to localStorage on change.
  useEffect(() => { if (isDemo) saveDemo('tasks', tasks); }, [isDemo, tasks]);
  useEffect(() => { if (isDemo) saveDemo('agents', agents); }, [isDemo, agents]);
  useEffect(() => { if (isDemo) saveDemo('workstreams', workstreams); }, [isDemo, workstreams]);

  const nextWorkstreamId = useCallback((baseLabel, providedId) => {
    const base = slugify(providedId || baseLabel);
    if (!base) return null;
    if (!workstreams[base]) return base;
    for (let n = 2; n <= 100; n += 1) {
      const candidate = `${base}-${n}`;
      if (!workstreams[candidate]) return candidate;
    }
    return null;
  }, [workstreams]);

  const createWorkstream = useCallback(async (ws) => {
    if (isDemo) {
      const id = nextWorkstreamId(ws.label, ws.id);
      if (!id) throw new Error('Could not derive a valid id from the label.');
      const created = { id, label: ws.label, color: ws.color, icon: ws.icon };
      setWorkstreams(prev => ({ ...prev, [id]: { label: created.label, color: created.color, icon: created.icon } }));
      return created;
    }
    const created = await api.createWorkstream(ws);
    setWorkstreams(prev => ({ ...prev, [created.id]: { label: created.label, color: created.color, icon: created.icon } }));
    return created;
  }, [isDemo, nextWorkstreamId]);

  const updateWorkstream = useCallback(async (id, updates) => {
    if (isDemo) {
      setWorkstreams(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
      return { id, ...workstreams[id], ...updates };
    }
    const updated = await api.updateWorkstream(id, updates);
    setWorkstreams(prev => ({ ...prev, [id]: { label: updated.label, color: updated.color, icon: updated.icon } }));
    return updated;
  }, [isDemo, workstreams]);

  const deleteWorkstream = useCallback(async (id) => {
    const referencing = tasks.filter(t => t.workstream === id).length;
    if (isDemo) {
      if (referencing > 0) {
        const msg = `Cannot delete: ${referencing} task${referencing === 1 ? '' : 's'} still in this workstream. Move or delete them first.`;
        alert(msg);
        throw new Error(msg);
      }
      setWorkstreams(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    try {
      await api.deleteWorkstream(id);
      setWorkstreams(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      alert(err.message || 'Could not delete workstream');
      throw err;
    }
  }, [isDemo, tasks]);

  const moveTask = useCallback((taskId, newCol) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column: newCol } : t));
    if (!isDemo) api.updateTask(taskId, { column: newCol }).catch(console.error);
  }, [isDemo]);

  const addTask = useCallback(async (task) => {
    if (isDemo) {
      const now = new Date().toISOString();
      const created = { ...task, id: localId('t'), createdAt: now, updatedAt: now };
      setTasks(prev => [...prev, created]);
      setShowAddTask(false);
      return;
    }
    const created = await api.createTask(task);
    setTasks(prev => [...prev, created]);
    setShowAddTask(false);
  }, [isDemo]);

  const updateTask = useCallback((taskId, updates) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    if (!isDemo) api.updateTask(taskId, updates).catch(console.error);
  }, [isDemo]);

  const deleteTask = useCallback(async (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setEditingTask(null);
    if (!isDemo) await api.deleteTask(taskId).catch(console.error);
  }, [isDemo]);

  const dispatchToAgent = useCallback((taskId) => {
    const free = agents.find(a => a.status === "idle");
    if (!free) return;
    const task = tasks.find(t => t.id === taskId);
    const now = new Date().toLocaleTimeString();
    const updates = {
      taskId, status: "running", startedAt: new Date().toISOString(),
      log: [`[${now}] Dispatched: ${task?.title}`, `[${now}] Loading context...`],
    };
    setAgents(prev => prev.map(a => a.id === free.id ? { ...a, ...updates } : a));
    if (!isDemo) api.updateAgent(free.id, updates).catch(console.error);
    moveTask(taskId, "active");
  }, [agents, tasks, moveTask, isDemo]);

  const completeAgent = useCallback((agentId) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent?.taskId) moveTask(agent.taskId, "review");
    const now = new Date().toLocaleTimeString();
    const updates = {
      taskId: null, status: "idle", startedAt: null,
      log: [...(agent?.log ?? []), `[${now}] Task complete`],
    };
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, ...updates } : a));
    if (!isDemo) api.updateAgent(agentId, updates).catch(console.error);
  }, [agents, moveTask, isDemo]);

  const resetData = useCallback(() => {
    if (isDemo) {
      if (!window.confirm('Reset the demo back to its initial state? Your local changes will be lost.')) return;
      clearDemo();
      setTasks(SEED_TASKS);
      setAgents(SEED_AGENTS);
      setWorkstreams(SEED_WORKSTREAMS);
      return;
    }
    if (!window.confirm('Reset all tasks and agents? This cannot be undone.')) return;
    setTasks(SEED_TASKS);
    setAgents(SEED_AGENTS);
  }, [isDemo]);

  const filtered = filterWorkstream === "all" ? tasks : tasks.filter(t => t.workstream === filterWorkstream);
  const stats = {
    total: tasks.length,
    active: tasks.filter(t => t.column === "active").length,
    done: tasks.filter(t => t.column === "done").length,
  };
  const runningAgents = agents.filter(a => a.status === "running").length;
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        cursor: "default",
        userSelect: isMobile ? "auto" : "none",
      }}
      onClick={() => setActiveMenu(null)}
    >
      <style>{GLOBAL_CSS}</style>

      {/* ══════ MENU BAR ══════ */}
      <MenuBar clock={clock}>
        <MenuBarItem label="🍎" active={activeMenu === "apple"} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "apple" ? null : "apple"); }}>
          {activeMenu === "apple" && (
            <MenuDropdown items={[
              { label: "About Chaos Dimension...", action: () => { setShowAbout(true); setActiveMenu(null); } },
              { divider: true },
              { label: `Tasks: ${stats.total}   Active: ${stats.active}   Done: ${stats.done}`, disabled: true },
              { label: `Agents: ${runningAgents} running`, disabled: true },
              ...(isDemo ? [] : [
                { divider: true },
                { label: "Sign out", action: async () => {
                  setActiveMenu(null);
                  try { await api.logout(); } catch { /* still navigate to /login */ }
                  window.location.href = '/login';
                } },
              ]),
            ]} />
          )}
        </MenuBarItem>
        <MenuBarItem label="File" active={activeMenu === "file"} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "file" ? null : "file"); }}>
          {activeMenu === "file" && (
            <MenuDropdown items={[
              { label: "New Task", shortcut: "⌘N", action: () => { setShowAddTask(true); setActiveMenu(null); } },
              { label: "Manage Workstreams...", action: () => { setShowWorkstreams(true); setActiveMenu(null); } },
              { divider: true },
              { label: "Reset All Data...", action: () => { resetData(); setActiveMenu(null); } },
            ]} />
          )}
        </MenuBarItem>
        <MenuBarItem label="View" active={activeMenu === "view"} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "view" ? null : "view"); }}>
          {activeMenu === "view" && (
            <MenuDropdown items={[
              { label: "All Workstreams", checked: filterWorkstream === "all", action: () => { setFilterWorkstream("all"); setActiveMenu(null); } },
              { divider: true },
              ...Object.entries(workstreams).map(([k, v]) => ({
                label: `${v.icon} ${v.label}`, checked: filterWorkstream === k,
                action: () => { setFilterWorkstream(k); setActiveMenu(null); },
              })),
            ]} />
          )}
        </MenuBarItem>
        <MenuBarItem label="Agents" active={activeMenu === "agents"} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "agents" ? null : "agents"); }}>
          {activeMenu === "agents" && (
            <MenuDropdown items={agents.length === 0
              ? [{ label: 'None', disabled: true }]
              : agents.map(a => ({ label: `${a.name}: ${a.status}`, disabled: true }))
            } />
          )}
        </MenuBarItem>
        <MenuBarItem label="Connect AI" active={activeMenu === "connect"} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "connect" ? null : "connect"); }}>
          {activeMenu === "connect" && (
            <MenuDropdown items={[
              { label: 'Set up Claude / ChatGPT / Claude Code…', action: () => { window.location.href = '/connect'; setActiveMenu(null); } },
            ]} />
          )}
        </MenuBarItem>
        <MenuBarItem label="Theme" active={activeMenu === "theme"} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "theme" ? null : "theme"); }}>
          {activeMenu === "theme" && (
            <MenuDropdown items={THEME_LIST.map(t => ({
              label: t.label, checked: themeId === t.id,
              action: () => { setThemeId(t.id); setActiveMenu(null); },
            }))} />
          )}
        </MenuBarItem>
      </MenuBar>

      {/* ══════ DESKTOP ══════ */}
      <div style={{
        flex: 1,
        position: "relative",
        overflow: isMobile ? "auto" : "hidden",
        padding: isMobile ? 4 : 0,
        background: MAC.bg,
        backgroundImage: MAC.desktopBgImage,
        backgroundSize: MAC.desktopBgSize,
        color: MAC.text,
      }}>

        {/* ══════ MAIN KANBAN WINDOW ══════ */}
        <MacWindow
          title="Chaos Dimension — Tasks"
          x={4} y={4} w="calc(55% - 8px)" h="calc(100% - 8px)"
          stacked={isMobile}
          minHeight={isMobile ? 520 : undefined}
        >
          {/* Toolbar */}
          <div style={{
            padding: "6px 8px", background: MAC.chrome,
            borderBottom: `1px solid ${MAC.border}`,
            display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap",
          }}>
            <button className="mac-btn" onClick={() => setShowAddTask(true)} style={{ fontWeight: "bold", padding: "3px 12px" }}>
              + New
            </button>
            <div style={{ width: 1, height: 16, background: MAC.chromeDark, margin: "0 4px" }} />
            <FilterPill label="All" active={filterWorkstream === "all"} onClick={() => setFilterWorkstream("all")} />
            {Object.entries(workstreams).map(([k, v]) => (
              <FilterPill key={k} label={v.icon} title={v.label} active={filterWorkstream === k} onClick={() => setFilterWorkstream(k)} />
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: MAC.textDim }}>{filtered.length} tasks</span>
          </div>

          {/* Kanban Columns */}
          <div style={{
            display: "flex",
            flex: 1,
            overflowX: isMobile ? "auto" : "hidden",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
          }}>
            {COLUMNS.map(col => (
              <div
                key={col}
                className={dragState.overCol === col ? "col-drop-active" : ""}
                onDragOver={(e) => { e.preventDefault(); setDragState(p => ({ ...p, overCol: col })); }}
                onDragLeave={() => setDragState(p => ({ ...p, overCol: null }))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragState.taskId) moveTask(dragState.taskId, col);
                  setDragState({ taskId: null, overCol: null });
                }}
                style={{
                  flex: isMobile ? `0 0 240px` : 1,
                  borderRight: col !== "done" ? `1px solid ${MAC.chromeDark}` : "none",
                  display: "flex", flexDirection: "column", minWidth: 0,
                }}
              >
                <div style={{
                  padding: "5px 8px", background: MAC.chrome,
                  borderBottom: `1px solid ${MAC.border}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontWeight: "bold", fontSize: 11 }}>{COL_LABELS[col]}</span>
                  <span style={{
                    fontSize: 10, color: MAC.textDim, background: MAC.chromeLight,
                    padding: "0 5px", borderRadius: 3, border: `1px solid ${MAC.chromeDark}`,
                  }}>
                    {filtered.filter(t => t.column === col).length}
                  </span>
                </div>
                <div style={{ flex: 1, overflow: "auto", padding: 4, background: MAC.windowBg }}>
                  {filtered.filter(t => t.column === col).map(task => (
                    <TaskCard
                      key={task.id} task={task} agents={agents}
                      workstreams={workstreams}
                      setDragState={setDragState}
                      onEdit={() => setEditingTask(task)}
                      onDispatch={() => dispatchToAgent(task.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </MacWindow>

        {/* ══════ AGENT MONITOR WINDOW ══════ */}
        <MacWindow
          title="Agent Monitor"
          x="55%" y={4} w="calc(45% - 8px)" h="60%"
          stacked={isMobile}
          minHeight={isMobile ? 280 : undefined}
        >
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                task={tasks.find(t => t.id === agent.taskId)}
                onComplete={() => completeAgent(agent.id)}
              />
            ))}
          </div>
        </MacWindow>

        {/* ══════ PROGRESS WINDOW ══════ */}
        <MacWindow
          title="Workstream Progress"
          x="55%" y="calc(60% + 8px)" w="calc(45% - 8px)" h="calc(40% - 12px)"
          stacked={isMobile}
          minHeight={isMobile ? 240 : undefined}
        >
          <div style={{ padding: 10 }}>
            {Object.entries(workstreams).map(([key, ws]) => {
              const wt = tasks.filter(t => t.workstream === key);
              const done = wt.filter(t => t.column === "done").length;
              const active = wt.filter(t => t.column === "active").length;
              const pct = wt.length ? Math.round((done / wt.length) * 100) : 0;
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 11 }}>{ws.icon} {ws.label}</span>
                    <span style={{ fontSize: 10, color: MAC.textDim }}>
                      {done}/{wt.length} done{active > 0 ? ` · ${active} active` : ""}
                    </span>
                  </div>
                  <div style={{ height: 12, background: MAC.chromeLight, border: `2px inset ${MAC.chromeDark}`, borderRadius: 2 }}>
                    <div style={{
                      height: "100%", width: `${pct}%`, transition: "width 0.3s",
                      background: `repeating-linear-gradient(90deg, ${ws.color} 0px, ${ws.color} 6px, transparent 6px, transparent 8px)`,
                    }} />
                  </div>
                </div>
              );
            })}
            <div style={{
              marginTop: 12, padding: "6px 8px", background: MAC.chromeLight,
              border: `1px solid ${MAC.chromeDark}`, fontSize: 10, borderRadius: 2,
            }}>
              Summer '26 — {stats.done}/{stats.total} tasks complete ({stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%)
            </div>
          </div>
        </MacWindow>
      </div>

      {/* ══════ MODALS ══════ */}
      {showAddTask && <TaskModal workstreams={workstreams} onSave={addTask} onClose={() => setShowAddTask(false)} />}
      {editingTask && (
        <TaskModal
          task={editingTask}
          workstreams={workstreams}
          onSave={(u) => { updateTask(editingTask.id, u); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
          onDelete={() => deleteTask(editingTask.id)}
        />
      )}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {showWorkstreams && (
        <WorkstreamModal
          workstreams={workstreams}
          onCreate={createWorkstream}
          onUpdate={updateWorkstream}
          onDelete={deleteWorkstream}
          onClose={() => setShowWorkstreams(false)}
        />
      )}
    </div>
  );
}
