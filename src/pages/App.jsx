// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { useState, useEffect, useCallback, useRef } from 'react';
import { WORKSTREAMS as SEED_WORKSTREAMS, COLUMNS, COL_LABELS } from '../data/workstreams';
import { SEED_TASKS, SEED_AGENTS } from '../data/seed';
import MacWindow from '../components/MacWindow';
import { MenuBar, MenuBarItem, MenuDropdown, FilterPill } from '../components/MenuBar';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import AgentCard from '../components/AgentCard';
import AboutDialog from '../components/AboutDialog';
import WorkstreamModal from '../components/WorkstreamModal';
import NewPublicBoardModal from '../components/NewPublicBoardModal';
import SpecModal from '../components/SpecModal';
import OnboardingCoach from '../components/OnboardingCoach';
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
  const [specs, setSpecs] = useState(isDemo ? loadDemo('specs', []) : []);
  const [editingSpec, setEditingSpec] = useState(null); // { spec, target }
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filterWorkstream, setFilterWorkstream] = useState("all");
  const [dragState, setDragState] = useState({ taskId: null, overCol: null });
  const [clock, setClock] = useState(new Date());
  const [activeMenu, setActiveMenu] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showWorkstreams, setShowWorkstreams] = useState(false);
  const [showNewPublicBoard, setShowNewPublicBoard] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const closeCoach = useCallback(() => setCoachOpen(false), []);

  // Owner status gates the Admin menu (live mode only).
  useEffect(() => {
    if (isDemo) return;
    api.me().then((r) => setIsOwner(!!r?.isOwner)).catch(() => {});
  }, [isDemo]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (mode !== 'live') return;
    let cancelled = false;
    api.getOnboarding()
      .then(s => {
        if (cancelled) return;
        const done = s.has_connected_ai && s.has_mcp_created_task;
        if (!s.coach_dismissed && !done) setCoachOpen(true);
      })
      .catch(() => { /* ignore — coach stays closed */ });
    return () => { cancelled = true; };
  }, [mode]);

  useEffect(() => {
    if (isDemo) return;

    // Each resource refreshes independently. A single failing call (e.g. a
    // not-yet-migrated /api/specs returning 500) must never blank the rest of
    // the board — so we do NOT bundle these into one Promise.all, where one
    // rejection would drop every result. Each updates its own state or logs.
    const fetchAll = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      api.listTasks().then(setTasks).catch((err) => console.error('tasks refresh failed', err));
      api.listAgents().then(setAgents).catch((err) => console.error('agents refresh failed', err));
      api.listWorkstreams()
        .then((ws) => setWorkstreams(Object.fromEntries(ws.map(w => [w.id, { label: w.label, color: w.color, icon: w.icon, slug: w.slug, isPublic: w.isPublic }]))))
        .catch((err) => console.error('workstreams refresh failed', err));
      api.listSpecs().then(setSpecs).catch((err) => console.error('specs refresh failed', err));
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
  useEffect(() => { if (isDemo) saveDemo('specs', specs); }, [isDemo, specs]);

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
    setWorkstreams(prev => ({ ...prev, [created.id]: { label: created.label, color: created.color, icon: created.icon, slug: created.slug, isPublic: created.isPublic } }));
    return created;
  }, [isDemo, nextWorkstreamId]);

  const updateWorkstream = useCallback(async (id, updates) => {
    if (isDemo) {
      setWorkstreams(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
      return { id, ...workstreams[id], ...updates };
    }
    const updated = await api.updateWorkstream(id, updates);
    setWorkstreams(prev => ({ ...prev, [id]: { label: updated.label, color: updated.color, icon: updated.icon, slug: updated.slug, isPublic: updated.isPublic } }));
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

  // ── Specs (requirements docs) ──────────────────────────────────────────
  const createSpec = useCallback(async (target, { title, content, note }) => {
    if (isDemo) {
      const now = new Date().toISOString();
      const created = {
        id: localId('s'), title, content, note, version: 1,
        taskId: target.taskId ?? null, workstreamId: target.workstreamId ?? null,
        createdVia: 'ui', updatedAt: now,
        revisions: [{ version: 1, title, note: note || '', createdAt: now }],
      };
      setSpecs(prev => [created, ...prev]);
      return created;
    }
    const body = { title, content, note };
    if (target.taskId) body.task = target.taskId;
    if (target.workstreamId) body.workstream = target.workstreamId;
    const created = await api.createSpec(body);
    setSpecs(prev => [created, ...prev.filter(s => s.id !== created.id)]);
    return created;
  }, [isDemo]);

  const updateSpec = useCallback(async (id, updates) => {
    if (isDemo) {
      const now = new Date().toISOString();
      setSpecs(prev => prev.map(s => {
        if (s.id !== id) return s;
        const contentChanged = typeof updates.content === 'string' && updates.content !== s.content;
        const version = contentChanged ? (s.version || 1) + 1 : s.version;
        const title = updates.title ?? s.title;
        const revisions = contentChanged
          ? [{ version, title, note: updates.note || '', createdAt: now }, ...(s.revisions || [])]
          : (s.revisions || []);
        return { ...s, ...updates, title, version, updatedAt: now, revisions };
      }));
      return;
    }
    const updated = await api.updateSpec(id, updates);
    setSpecs(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
    return updated;
  }, [isDemo]);

  const deleteSpec = useCallback(async (id) => {
    setSpecs(prev => prev.filter(s => s.id !== id));
    setEditingSpec(null);
    if (!isDemo) await api.deleteSpec(id).catch(console.error);
  }, [isDemo]);

  // Existing specs are listed as metadata; load the full body on open. In demo
  // mode the content already lives in local state.
  const loadFullSpec = useCallback(async (id) => {
    if (isDemo) return specs.find(s => s.id === id) ?? null;
    return api.getSpec(id);
  }, [isDemo, specs]);

  const loadSpecRevision = useCallback(async (id, version) => {
    if (isDemo) {
      const s = specs.find(x => x.id === id);
      const rev = (s?.revisions || []).find(r => r.version === version);
      return rev ? { ...rev, content: s.content } : null;
    }
    return api.getSpecRevision(id, version);
  }, [isDemo, specs]);

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

  const SPLIT_KEY = 'cd.splitPct';
  const SPLIT_MIN = 25;
  const SPLIT_MAX = 80;
  const clampSplit = (n) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));
  const [splitPct, setSplitPct] = useState(() => {
    if (typeof window === 'undefined') return 55;
    const raw = window.localStorage.getItem(SPLIT_KEY);
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) ? clampSplit(n) : 55;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SPLIT_KEY, String(splitPct));
    }
  }, [splitPct]);

  const desktopRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (isMobile) return;
    const onMove = (e) => {
      if (!draggingRef.current || !desktopRef.current) return;
      const rect = desktopRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(clampSplit(pct));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isMobile]);

  const startDragSplit = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
  };

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
              // AGPL §13 source-disclosure: every signed-in user sees a link
              // to the source of the running software.
              { label: "View source on GitHub", action: () => { window.open('https://github.com/gabelev/chaos_dimension', '_blank', 'noopener'); setActiveMenu(null); } },
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
              // Public boards are backed by the live API (create + public URL),
              // so this only makes sense in live mode, not the localStorage demo.
              ...(isDemo ? [] : [
                { label: "New Public Board...", action: () => { setShowNewPublicBoard(true); setActiveMenu(null); } },
              ]),
              // "Reset All Data..." only makes sense in the demo (it clears
              // localStorage). In live mode it never touched the DB and just
              // flashed the demo seed onto the user's board until the next
              // poll — misleading UX, hide it.
              ...(isDemo ? [
                { divider: true },
                { label: "Reset All Data...", action: () => { resetData(); setActiveMenu(null); } },
              ] : []),
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
        {mode === 'live' && isOwner && (
          <MenuBarItem label="Admin" active={activeMenu === "admin"} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "admin" ? null : "admin"); }}>
            {activeMenu === "admin" && (
              <MenuDropdown items={[
                { label: 'Manage invites & users…', action: () => { window.location.href = '/admin'; setActiveMenu(null); } },
              ]} />
            )}
          </MenuBarItem>
        )}
        <MenuBarItem label="Theme" active={activeMenu === "theme"} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "theme" ? null : "theme"); }}>
          {activeMenu === "theme" && (
            <MenuDropdown items={THEME_LIST.map(t => ({
              label: t.label, checked: themeId === t.id,
              action: () => { setThemeId(t.id); setActiveMenu(null); },
            }))} />
          )}
        </MenuBarItem>
        {mode === 'live' && (
          <MenuBarItem
            label="Help"
            active={activeMenu === "help"}
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "help" ? null : "help"); }}
          >
            {activeMenu === "help" && (
              <MenuDropdown items={[
                {
                  label: "Getting Started...",
                  action: async () => {
                    try { await api.resetOnboarding(); } catch { /* ignore */ }
                    setCoachOpen(true);
                    setActiveMenu(null);
                  },
                },
              ]} />
            )}
          </MenuBarItem>
        )}
      </MenuBar>

      {/* ══════ DESKTOP ══════ */}
      <div ref={desktopRef} style={{
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
          x={4} y={4} w={`calc(${splitPct}% - 8px)`} h="calc(100% - 8px)"
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
                  <span style={MAC.columnHeader
                    ? { ...MAC.columnHeader, color: MAC.columnColors?.[col] ?? MAC.columnHeader.color ?? MAC.text }
                    : { fontWeight: "bold", fontSize: 11 }}>
                    {COL_LABELS[col]}
                  </span>
                  <span style={MAC.columnCount ?? {
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
                      hasSpec={specs.some(s => s.taskId === task.id || s.workstreamId === task.workstream)}
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

        {/* ══════ VERTICAL SPLITTER ══════ */}
        {!isMobile && (
          <div
            onMouseDown={startDragSplit}
            title="Drag to resize"
            style={{
              position: "absolute",
              left: `calc(${splitPct}% - 3px)`,
              top: 4,
              width: 6,
              height: "calc(100% - 8px)",
              cursor: "col-resize",
              zIndex: 50,
              background: "transparent",
            }}
          />
        )}

        {/* ══════ AGENT MONITOR WINDOW ══════ */}
        <MacWindow
          title="Agent Monitor"
          x={`${splitPct}%`} y={4} w={`calc(${100 - splitPct}% - 8px)`} h="60%"
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
          x={`${splitPct}%`} y="calc(60% + 8px)" w={`calc(${100 - splitPct}% - 8px)`} h="calc(40% - 12px)"
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
          specs={specs
            .filter(s => s.taskId === editingTask.id || s.workstreamId === editingTask.workstream)
            .map(s => ({ ...s, scope: s.taskId === editingTask.id ? 'task' : 'workstream' }))}
          onNewSpec={() => setEditingSpec({ spec: null, target: { taskId: editingTask.id } })}
          onOpenSpec={(s) => setEditingSpec({
            spec: s,
            target: s.taskId ? { taskId: s.taskId } : { workstreamId: s.workstreamId },
          })}
          onSave={(u) => { updateTask(editingTask.id, u); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
          onDelete={() => deleteTask(editingTask.id)}
        />
      )}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {showNewPublicBoard && (
        <NewPublicBoardModal
          onCreate={(name) => createWorkstream({ label: name, isPublic: true })}
          onClose={() => setShowNewPublicBoard(false)}
        />
      )}
      {mode === 'live' && <OnboardingCoach open={coachOpen} onClose={closeCoach} />}
      {showWorkstreams && (
        <WorkstreamModal
          workstreams={workstreams}
          specs={specs}
          onCreate={createWorkstream}
          onUpdate={updateWorkstream}
          onDelete={deleteWorkstream}
          onNewSpec={(wsId) => setEditingSpec({ spec: null, target: { workstreamId: wsId } })}
          onOpenSpec={(s) => setEditingSpec({ spec: s, target: { workstreamId: s.workstreamId } })}
          onClose={() => setShowWorkstreams(false)}
        />
      )}
      {editingSpec && (
        <SpecModal
          spec={editingSpec.spec}
          loadFull={loadFullSpec}
          loadRevision={loadSpecRevision}
          onSave={async (payload) => {
            if (editingSpec.spec?.id) await updateSpec(editingSpec.spec.id, payload);
            else await createSpec(editingSpec.target, payload);
          }}
          onDelete={editingSpec.spec?.id ? () => deleteSpec(editingSpec.spec.id) : undefined}
          onClose={() => setEditingSpec(null)}
        />
      )}
    </div>
  );
}
