import { ChevronDown, ChevronRight, Database, RefreshCw, ShieldCheck, Table2 } from "lucide-react";
import type { Translate } from "../lib/i18n";
import type { DatabaseEngine, SchemaTable } from "../types/database";

type DatabaseSidebarProps = {
  schema: SchemaTable[];
  openTables: Record<string, boolean>;
  onToggle: (name: string) => void;
  onRefresh: () => void;
  onReset: () => void;
  t: Translate;
  engine: DatabaseEngine;
  engines: DatabaseEngine[];
  onEngineChange: (engineId: string) => void;
};

export function DatabaseSidebar({
  schema,
  openTables,
  onToggle,
  onRefresh,
  onReset,
  t,
  engine,
  engines,
  onEngineChange,
}: DatabaseSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="side-head">
        <span>{t("sidebar.databases")}</span>
        <button className="icon-btn" title={t("sidebar.resetDemo")} onClick={onReset}>
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="engine-list" aria-label="SQL engines">
        {engines.map((availableEngine) => (
          <button
            className={`engine-row${availableEngine.id === engine.id ? " active" : ""}`}
            key={availableEngine.id}
            type="button"
            aria-pressed={availableEngine.id === engine.id}
            onClick={() => onEngineChange(availableEngine.id)}
          >
            <Database size={15} />
            <span className="engine-row-name">{availableEngine.name}</span>
            <span className="engine-row-version">{availableEngine.version}</span>
            <span className="engine-row-dot" />
          </button>
        ))}
      </div>
      <div className="schema-head">
        <span>
          {t("sidebar.tables")} <em>{schema.length}</em>
        </span>
        <button className="icon-btn" title={t("sidebar.refreshSchema")} onClick={onRefresh}>
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="table-tree">
        {schema.map((table) => (
          <div key={table.name} className="tree-table">
            <button className="tree-row" onClick={() => onToggle(table.name)}>
              {openTables[table.name] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              <Table2 size={14} className="table-icon" />
              <span>{table.name}</span>
            </button>
            {openTables[table.name] && (
              <div className="columns">
                {table.columns.map((column) => (
                  <div className="column-row" key={column.name}>
                    <span className={column.pk ? "key-dot" : "type-dot"}>
                      {column.pk ? "◆" : "·"}
                    </span>
                    <span>{column.name}</span>
                    <span className="column-type">{column.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="privacy-note">
        <div className="privacy-icon">
          <ShieldCheck size={13} strokeWidth={2.5} />
        </div>
        <div>
          <strong>{t("sidebar.dataStaysHere")}</strong>
          <p>{t("sidebar.localFilesOnly")}</p>
        </div>
      </div>
    </aside>
  );
}
