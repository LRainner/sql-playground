import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Database, Play, Plus, X } from "lucide-react";
import { DatabaseSidebar } from "../components/DatabaseSidebar";
import { QueryEditor } from "../components/QueryEditor";
import { ResultsPanel } from "../components/ResultsPanel";
import { TopBar } from "../components/TopBar";
import { databaseEngines, defaultDatabaseEngine } from "../engines/registry";
import { useDatabase } from "../hooks/useDatabase";
import { useLocale } from "../hooks/useLocale";
import { downloadCsv } from "../lib/csv";
import { modKeyLabel } from "../lib/platform";
import type { QueryResult } from "../types/database";

type QueryTab = {
  id: string;
  title: string;
  sql: string;
  result: QueryResult;
  error: string;
};

type QueryWorkspace = {
  tabs: QueryTab[];
  activeTabId: string;
  initialized: boolean;
};

const EMPTY_RESULT: QueryResult = { columns: [], values: [] };

const DEFAULT_EDITOR_HEIGHT = 240;
const MIN_EDITOR_HEIGHT = 120;
// Height inside the main column taken by chrome the editor can never own:
// toolbar + statusbar + card headers/borders + top margins + min results + handle.
const RESIZE_RESERVED = 380;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createWorkspace(engine: { demoSql: string }): QueryWorkspace {
  return {
    tabs: [
      { id: "query-1", title: "Query 1", sql: engine.demoSql, result: EMPTY_RESULT, error: "" },
    ],
    activeTabId: "query-1",
    initialized: false,
  };
}

export function App() {
  const [selectedEngineId, setSelectedEngineId] = useState(defaultDatabaseEngine.id);
  const selectedEngine =
    databaseEngines.find((engine) => engine.id === selectedEngineId) ?? defaultDatabaseEngine;
  const database = useDatabase(selectedEngine);
  const { locale, t, toggleLocale } = useLocale();
  const mainPanelRef = useRef<HTMLElement>(null);
  const selectedEngineIdRef = useRef(selectedEngineId);
  const dragRef = useRef<{ startY: number; startH: number; maxH: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const [workspaces, setWorkspaces] = useState<Record<string, QueryWorkspace>>(() => ({
    [defaultDatabaseEngine.id]: createWorkspace(defaultDatabaseEngine),
  }));
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({
    demo: true,
  });
  const [editorHeight, setEditorHeight] = useState(DEFAULT_EDITOR_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const workspace = workspaces[selectedEngine.id] ?? createWorkspace(selectedEngine);
  const { tabs, activeTabId } = workspace;
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  // Keep the document language in sync with the UI locale.
  useEffect(() => {
    document.documentElement.lang = locale === "cn" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    selectedEngineIdRef.current = selectedEngineId;
  }, [selectedEngineId]);

  // While the divider is dragged, suppress text selection and cursor flicker.
  useEffect(() => {
    if (!isDragging) return;
    const previousSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
    return () => {
      document.body.style.userSelect = previousSelect;
      document.body.style.cursor = "";
    };
  }, [isDragging]);

  const resizeMax = () => {
    const panelHeight = mainPanelRef.current?.clientHeight ?? 800;
    return Math.max(MIN_EDITOR_HEIGHT, panelHeight - RESIZE_RESERVED);
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startY: event.clientY, startH: editorHeight, maxH: resizeMax() };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = clamp(drag.startH + (event.clientY - drag.startY), MIN_EDITOR_HEIGHT, drag.maxH);
    // Coalesce pointer events to one update per animation frame.
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setEditorHeight(next);
      });
    }
  };

  const endResize = () => {
    dragRef.current = null;
    setIsDragging(false);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const resizeWithKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 16;
    const delta = event.key === "ArrowUp" ? step : -step;
    const max = resizeMax();
    setEditorHeight((current) => clamp(current + delta, MIN_EDITOR_HEIGHT, max));
  };

  useEffect(() => {
    const stateEngineId = database.stateEngineId;
    if (!database.ready || stateEngineId !== selectedEngine.id || !database.result.columns.length)
      return;
    setWorkspaces((current) => {
      const currentWorkspace = current[stateEngineId];
      if (!currentWorkspace || currentWorkspace.initialized) return current;
      return {
        ...current,
        [stateEngineId]: {
          ...currentWorkspace,
          initialized: true,
          tabs: currentWorkspace.tabs.map((tab, index) =>
            index === 0 ? { ...tab, result: database.result } : tab,
          ),
        },
      };
    });
  }, [database.ready, database.result, database.stateEngineId, selectedEngine.id]);

  const updateTab = (engineId: string, tabId: string, changes: Partial<QueryTab>) => {
    setWorkspaces((current) => {
      const currentWorkspace = current[engineId];
      if (!currentWorkspace) return current;
      return {
        ...current,
        [engineId]: {
          ...currentWorkspace,
          tabs: currentWorkspace.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, ...changes } : tab,
          ),
        },
      };
    });
  };

  const updateActiveTab = (changes: Partial<QueryTab>) =>
    updateTab(selectedEngine.id, activeTab.id, changes);

  const clearWorkspaceResults = (engineId: string) => {
    setWorkspaces((current) => {
      const currentWorkspace = current[engineId];
      if (!currentWorkspace) return current;
      return {
        ...current,
        [engineId]: {
          ...currentWorkspace,
          tabs: currentWorkspace.tabs.map((tab) => ({
            ...tab,
            result: EMPTY_RESULT,
            error: "",
          })),
        },
      };
    });
  };

  const createQueryTab = () => {
    const engineId = selectedEngine.id;
    const id = `query-${Date.now()}`;
    setWorkspaces((current) => {
      const currentWorkspace = current[engineId];
      if (!currentWorkspace) return current;
      const nextNumber =
        currentWorkspace.tabs.reduce((max, tab) => {
          const match = tab.title.match(/(\d+)$/);
          return Math.max(max, match ? Number(match[1]) : 0);
        }, 0) + 1;
      return {
        ...current,
        [engineId]: {
          ...currentWorkspace,
          tabs: [
            ...currentWorkspace.tabs,
            { id, title: `Query ${nextNumber}`, sql: "", result: EMPTY_RESULT, error: "" },
          ],
          activeTabId: id,
        },
      };
    });
  };

  const closeQueryTab = (id: string) => {
    const engineId = selectedEngine.id;
    setWorkspaces((current) => {
      const currentWorkspace = current[engineId];
      if (!currentWorkspace || currentWorkspace.tabs.length === 1) return current;
      const closingIndex = currentWorkspace.tabs.findIndex((tab) => tab.id === id);
      if (closingIndex < 0) return current;
      const nextTabs = currentWorkspace.tabs.filter((tab) => tab.id !== id);
      return {
        ...current,
        [engineId]: {
          ...currentWorkspace,
          tabs: nextTabs,
          activeTabId:
            id === currentWorkspace.activeTabId
              ? nextTabs[Math.min(closingIndex, nextTabs.length - 1)].id
              : currentWorkspace.activeTabId,
        },
      };
    });
  };

  const runActiveQuery = async () => {
    const engineId = selectedEngine.id;
    const tabId = activeTab.id;
    const execution = await database.runQuery(activeTab.sql);
    if (execution.stale) return;
    updateTab(engineId, tabId, {
      result: execution.result ?? EMPTY_RESULT,
      error: execution.error,
    });
  };

  const clearActiveResult = () => {
    database.clearResult();
    updateActiveTab({ result: EMPTY_RESULT, error: "" });
  };

  return (
    <div className="app-shell">
      <TopBar
        onImport={async (file) => {
          const engineId = selectedEngine.id;
          const tabId = activeTab.id;
          const loaded = await database.loadFile(file);
          if (loaded.ok) clearWorkspaceResults(engineId);
          else updateTab(engineId, tabId, { error: loaded.error });
        }}
        locale={locale}
        onToggleLocale={toggleLocale}
        t={t}
        engine={database.engine}
      />
      <div className="workspace">
        <DatabaseSidebar
          schema={database.schema}
          openTables={openTables}
          onToggle={(name) => setOpenTables((current) => ({ ...current, [name]: !current[name] }))}
          onRefresh={database.refreshSchema}
          onReset={() => {
            const engineId = selectedEngine.id;
            const tabId = activeTab.id;
            void database.resetDemo().then((reset) => {
              if (reset.ok) {
                clearWorkspaceResults(engineId);
                if (selectedEngineIdRef.current === engineId) setOpenTables({ demo: true });
              } else updateTab(engineId, tabId, { error: reset.error });
            });
          }}
          t={t}
          engine={database.engine}
          engines={databaseEngines}
          onEngineChange={(engineId) => {
            if (engineId === selectedEngineId) return;
            selectedEngineIdRef.current = engineId;
            setSelectedEngineId(engineId);
            const nextEngine = databaseEngines.find((engine) => engine.id === engineId);
            if (nextEngine) {
              setWorkspaces((current) =>
                current[nextEngine.id]
                  ? current
                  : { ...current, [nextEngine.id]: createWorkspace(nextEngine) },
              );
            }
          }}
        />
        <main className="main-panel" ref={mainPanelRef}>
          <div className="toolbar">
            <div className="query-tabs">
              {tabs.map((tab) => (
                <div className={`query-tab ${tab.id === activeTabId ? "active" : ""}`} key={tab.id}>
                  <button
                    className="query-tab-main"
                    onClick={() => {
                      const engineId = selectedEngine.id;
                      setWorkspaces((current) => {
                        const currentWorkspace = current[engineId];
                        if (!currentWorkspace) return current;
                        return {
                          ...current,
                          [engineId]: { ...currentWorkspace, activeTabId: tab.id },
                        };
                      });
                    }}
                  >
                    <Database size={14} /> {tab.title}
                  </button>
                  {tabs.length > 1 && (
                    <button
                      className="query-tab-close"
                      title={t("results.closeQuery")}
                      onClick={() => closeQueryTab(tab.id)}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
              <button
                className="new-tab-btn"
                title={t("results.newQuery")}
                onClick={createQueryTab}
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="toolbar-spacer" />
            <button
              className="run-btn"
              onClick={runActiveQuery}
              disabled={!database.ready || database.running}
            >
              <Play size={15} fill="currentColor" />{" "}
              {database.running ? t("action.running") : t("action.runQuery")}
              <kbd>{modKeyLabel()} ↵</kbd>
            </button>
          </div>
          <QueryEditor
            value={activeTab.sql}
            onChange={(sql) => updateActiveTab({ sql })}
            onRun={runActiveQuery}
            t={t}
            schema={database.schema}
            functions={database.functions}
            engine={database.engine}
            height={editorHeight}
          />
          <div
            className={`resize-handle${isDragging ? " dragging" : ""}`}
            role="separator"
            aria-orientation="horizontal"
            aria-label={t("editor.resize")}
            tabIndex={0}
            aria-valuenow={Math.round(editorHeight)}
            aria-valuemin={MIN_EDITOR_HEIGHT}
            aria-valuemax={Math.round(resizeMax())}
            onPointerDown={startResize}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onKeyDown={resizeWithKeys}
          >
            <span className="resize-grip" aria-hidden="true" />
          </div>
          <ResultsPanel
            result={activeTab.result}
            error={activeTab.error || database.error}
            onExport={() => downloadCsv(activeTab.result)}
            onClear={clearActiveResult}
            t={t}
          />
          <footer className="statusbar">
            <span>
              <span className="status-dot" />{" "}
              {database.ready ? t("status.sqliteReady") : t("status.loadingSqlite")}
            </span>
            <span>{t(database.notice.key, database.notice.params)}</span>
            <span>{t("status.localOnly")}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
