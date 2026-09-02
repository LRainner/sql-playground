import { useEffect, useRef, useState } from "react";
import { Database, Plus, X } from "lucide-react";
import { DatabaseSidebar } from "../components/DatabaseSidebar";
import { QueryEditor } from "../components/QueryEditor";
import { ResultsPanel } from "../components/ResultsPanel";
import { TopBar } from "../components/TopBar";
import { useLocale } from "../hooks/useLocale";
import { useSqliteDatabase } from "../hooks/useSqliteDatabase";
import { downloadCsv } from "../lib/csv";
import { DEMO_SQL } from "../lib/sqlite";
import type { QueryResult } from "../types/sqlite";

type QueryTab = {
  id: string;
  title: string;
  sql: string;
  result: QueryResult;
  error: string;
};

const EMPTY_RESULT: QueryResult = { columns: [], values: [] };

export function App() {
  const database = useSqliteDatabase();
  const { locale, t, toggleLocale } = useLocale();
  const initializedDemo = useRef(false);
  const [tabs, setTabs] = useState<QueryTab[]>([
    { id: "query-1", title: "Query 1", sql: DEMO_SQL, result: EMPTY_RESULT, error: "" },
  ]);
  const [activeTabId, setActiveTabId] = useState("query-1");
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({
    demo: true,
  });
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

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
      { id, title: `Query ${nextNumber}`, sql: "", result: EMPTY_RESULT, error: "" },
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
    updateActiveTab({ result: execution.result ?? EMPTY_RESULT, error: execution.error });
  };

  const clearActiveResult = () => updateActiveTab({ result: EMPTY_RESULT, error: "" });

  return (
    <div className="app-shell">
      <TopBar
        onImport={async (file) => {
          await database.loadFile(file);
          updateActiveTab({ result: EMPTY_RESULT, error: "" });
        }}
        onExport={() => downloadCsv(activeTab.result)}
        canExport={Boolean(activeTab.result.columns.length)}
        locale={locale}
        onToggleLocale={toggleLocale}
        t={t}
      />
      <div className="workspace">
        <DatabaseSidebar
          schema={database.schema}
          openTables={openTables}
          onToggle={(name) => setOpenTables((current) => ({ ...current, [name]: !current[name] }))}
          onRefresh={database.refreshSchema}
          onReset={() => {
            database.resetDemo();
            setOpenTables({ demo: true });
          }}
          t={t}
        />
        <main className="main-panel">
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
              <span>▶</span> {database.running ? t("action.running") : t("action.runQuery")}
              <kbd>⌘ ↵</kbd>
            </button>
          </div>
          <QueryEditor
            value={activeTab.sql}
            onChange={(sql) => updateActiveTab({ sql })}
            onRun={runActiveQuery}
            t={t}
            schema={database.schema}
            functions={database.functions}
          />
          <ResultsPanel
            result={activeTab.result}
            error={activeTab.error}
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
