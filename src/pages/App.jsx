import { useState, useEffect, useCallback } from 'react';
import { MAC, GLOBAL_CSS } from '../styles/mac';
import { WORKSTREAMS, COLUMNS, COL_LABELS } from '../data/workstreams';
import { SEED_TASKS, SEED_AGENTS } from '../data/seed';
import MacWindow from '../components/MacWindow';
import { MenuBar, MenuBarItem, MenuDropdown, FilterPill } from '../components/MenuBar';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import AgentCard from '../components/AgentCard';
import AboutDialog from '../components/AboutDialog';
import { api } from '../lib/api';

export default function App({ mode = 'live' }) {
  const isDemo = mode === 'demo';
  const [tasks, setTasks] = useState(isDemo ? SEED_TASKS : []);
  const [agents, setAgents] = useState(isDemo ? SEED_AGENTS : []);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filterWorkstream, setFilterWorkstream] = useState("all");
  const [dragState, setDragState] = useState({ taskId: null, overCol: null });
  const [clock, setClock] = useState(new Date());
  const [activeMenu, setActiveMenu] = useState(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (isDemo) return;
    Promise.all([api.listTasks(), api.listAgents()])
      .then(([t, a]) => { setTasks(t); setAgents(a); })
      .catch((err) => console.error('load failed', err));
  }, [isDemo]);

  const showDemoAlert = useCallback(() => {
    if (isDemo) {
      alert('This is a demo. Clone the repo to run your own Chaos Dimension.');
      return true;
    }
    return false;
  }, [isDemo]);

  const moveTask = useCallback((taskId, newCol) => {
    if (showDemoAlert()) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column: newCol } : t));
    api.updateTask(taskId, { column: newCol }).catch(console.error);
  }, [showDemoAlert]);

  const addTask = useCallback(async (task) => {
    if (showDemoAlert()) return;
    const created = await api.createTask(task);
    setTasks(prev => [...prev, created]);
    setShowAddTask(false);
  }, [showDemoAlert]);

  const updateTask = useCallback((taskId, updates) => {
    if (showDemoAlert()) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    api.updateTask(taskId, updates).catch(console.error);
  }, [showDemoAlert]);

  const deleteTask = useCallback(async (taskId) => {
    if (showDemoAlert()) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setEditingTask(null);
    await api.deleteTask(taskId).catch(console.error);
  }, [showDemoAlert]);

  const dispatchToAgent = useCallback((taskId) => {
    if (showDemoAlert()) return;
    const free = agents.find(a => a.status === "idle");
    if (!free) return;
    const task = tasks.find(t => t.id === taskId);
    const now = new Date().toLocaleTimeString();
    const updates = {
      taskId, status: "running", startedAt: new Date().toISOString(),
      log: [`[${now}] Dispatched: ${task?.title}`, `[${now}] Loading context...`],
    };
    setAgents(prev => prev.map(a => a.id === free.id ? { ...a, ...updates } : a));
    api.updateAgent(free.id, updates).catch(console.error);
    moveTask(taskId, "active");
  }, [agents, tasks, moveTask, showDemoAlert]);

  const completeAgent = useCallback((agentId) => {
    if (showDemoAlert()) return;
    const agent = agents.find(a => a.id === agentId);
    if (agent?.taskId) moveTask(agent.taskId, "review");
    const now = new Date().toLocaleTimeString();
    const updates = {
      taskId: null, status: "idle", startedAt: null,
      log: [...(agent?.log ?? []), `[${now}] Task complete`],
    };
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, ...updates } : a));
    api.updateAgent(agentId, updates).catch(console.error);
  }, [agents, moveTask, showDemoAlert]);

  const resetData = useCallback(() => {
    if (showDemoAlert()) return;
    setTasks(SEED_TASKS);
    setAgents(SEED_AGENTS);
  }, [showDemoAlert]);

  const filtered = filterWorkstream === "all" ? tasks : tasks.filter(t => t.workstream === filterWorkstream);
  const stats = {
    total: tasks.length,
    active: tasks.filter(t => t.column === "active").length,
    done: tasks.filter(t => t.column === "done").length,
  };
  const runningAgents = agents.filter(a => a.status === "running").length;

  return (
    <div
      style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", cursor: "default", userSelect: "none" }}
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
            ]} />
          )}
        </MenuBarItem>
        <MenuBarItem label="File" active={activeMenu === "file"} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "file" ? null : "file"); }}>
          {activeMenu === "file" && (
            <MenuDropdown items={[
              { label: "New Task", shortcut: "⌘N", action: () => { setShowAddTask(true); setActiveMenu(null); } },
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
              ...Object.entries(WORKSTREAMS).map(([k, v]) => ({
                label: `${v.icon} ${v.label}`, checked: filterWorkstream === k,
                action: () => { setFilterWorkstream(k); setActiveMenu(null); },
              })),
            ]} />
          )}
        </MenuBarItem>
        <MenuBarItem label="Agents" active={activeMenu === "agents"} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "agents" ? null : "agents"); }}>
          {activeMenu === "agents" && (
            <MenuDropdown items={agents.map(a => ({
              label: `${a.name}: ${a.status}`, disabled: true,
            }))} />
          )}
        </MenuBarItem>
      </MenuBar>

      {/* ══════ DESKTOP ══════ */}
      <div style={{
        flex: 1, position: "relative", overflow: "hidden",
        background: MAC.bg,
        backgroundImage: "repeating-conic-gradient(#5070B8 0% 25%, transparent 0% 50%)",
        backgroundSize: "4px 4px",
      }}>

        {/* ══════ MAIN KANBAN WINDOW ══════ */}
        <MacWindow title="Chaos Dimension — Tasks" x={4} y={4} w="calc(55% - 8px)" h="calc(100% - 8px)">
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
            {Object.entries(WORKSTREAMS).map(([k, v]) => (
              <FilterPill key={k} label={v.icon} title={v.label} active={filterWorkstream === k} onClick={() => setFilterWorkstream(k)} />
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: MAC.textDim }}>{filtered.length} tasks</span>
          </div>

          {/* Kanban Columns */}
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
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
                  flex: 1, borderRight: col !== "done" ? `1px solid ${MAC.chromeDark}` : "none",
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
        <MacWindow title="Agent Monitor" x="55%" y={4} w="calc(45% - 8px)" h="60%">
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
        <MacWindow title="Workstream Progress" x="55%" y="calc(60% + 8px)" w="calc(45% - 8px)" h="calc(40% - 12px)">
          <div style={{ padding: 10 }}>
            {Object.entries(WORKSTREAMS).map(([key, ws]) => {
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
      {showAddTask && <TaskModal onSave={addTask} onClose={() => setShowAddTask(false)} />}
      {editingTask && (
        <TaskModal
          task={editingTask}
          onSave={(u) => { updateTask(editingTask.id, u); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
          onDelete={() => deleteTask(editingTask.id)}
        />
      )}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </div>
  );
}
