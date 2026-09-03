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
import { defaultDatabaseEngine } from "../engines/registry";
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

const EMPTY_RESULT: QueryResult = { columns: [], values: [] };

const DEFAULT_EDITOR_HEIGHT = 240;
const MIN_EDITOR_HEIGHT = 120;
// Height inside the main column taken by chrome the editor can never own:
// toolbar + statusbar + card headers/borders + top margins + min results + handle.
const RESIZE_RESERVED = 380;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function App() {
  const database = useDatabase(defaultDatabaseEngine);
  const { locale, t, toggleLocale } = useLocale();
  const mainPanelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startY: number; startH: number; maxH: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const initializedDemo = useRef(false);
  const [tabs, setTabs] = useState<QueryTab[]>([
    {
      id: "query-1",
      title: "Query 1",
      sql: defaultDatabaseEngine.demoSql,
      result: EMPTY_RESULT,
      error: "",
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("query-1");
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({
    demo: true,
  });
  const [editorHeight, setEditorHeight] = useState(DEFAULT_EDITOR_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  // Keep the document language in sync with the UI locale.
  useEffect(() => {
    document.documentElement.lang = locale === "cn" ? "zh-CN" : "en";
  }, [locale]);

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
    if (!database.ready || initializedDemo.current || !database.result.columns.length) return;
    initializedDemo.current = true;
    setTabs((current) =>
      current.map((tab, index) => (index === 0 ? { ...tab, result: database.result } : tab)),
    );
  }, [database.ready, database.result]);

  const updateActiveTab = (changes: Partial<QueryTab>) => {
    setTabs((current) =>
      current.map((tab) => (tab.id === activeTab.id ? { ...tab, ...changes } : tab)),
    );
  };

  const createQueryTab = () => {
    const nextNumber =
      tabs.reduce((max, tab) => {
        const match = tab.title.match(/(\d+)$/);
        return Math.max(max, match ? Number(match[1]) : 0);
      }, 0) + 1;
    const id = `query-${Date.now()}`;
    setTabs((current) => [
      ...current,
      {
        id,
        title: `Query ${nextNumber}`,
        sql: "",
        result: EMPTY_RESULT,
        error: "",
      },
    ]);
    setActiveTabId(id);
  };

  const closeQueryTab = (id: string) => {
    if (tabs.length === 1) return;
    const closingIndex = tabs.findIndex((tab) => tab.id === id);
    const nextTabs = tabs.filter((tab) => tab.id !== id);
    if (id === activeTabId)
      setActiveTabId(nextTabs[Math.min(closingIndex, nextTabs.length - 1)].id);
    setTabs(nextTabs);
  };

  const runActiveQuery = async () => {
    const execution = await database.runQuery(activeTab.sql);
    if (execution.stale) return;
    updateActiveTab({ result: execution.result ?? EMPTY_RESULT, error: execution.error });
  };

  const clearActiveResult = () => {
    database.clearResult();
    updateActiveTab({ result: EMPTY_RESULT, error: "" });
  };

  return (
    <div className="app-shell">
      <TopBar
        onImport={async (file) => {
          const loaded = await database.loadFile(file);
          if (loaded.ok) updateActiveTab({ result: EMPTY_RESULT, error: "" });
          else updateActiveTab({ error: loaded.error });
        }}
        onExport={() => downloadCsv(activeTab.result)}
        canExport={Boolean(activeTab.result.columns.length)}
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
            void database.resetDemo().then((reset) => {
              if (!reset.ok) updateActiveTab({ error: reset.error });
            });
            setOpenTables({ demo: true });
          }}
          t={t}
          engine={database.engine}
          databaseName={database.databaseName}
        />
        <main className="main-panel" ref={mainPanelRef}>
          <div className="toolbar">
            <div className="query-tabs">
              {tabs.map((tab) => (
                <div className={`query-tab ${tab.id === activeTabId ? "active" : ""}`} key={tab.id}>
                  <button className="query-tab-main" onClick={() => setActiveTabId(tab.id)}>
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
