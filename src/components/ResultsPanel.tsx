import { Download, Play, X } from "lucide-react";
import type { Translate } from "../lib/i18n";
import type { QueryResult } from "../types/sqlite";

type ResultsPanelProps = {
  result: QueryResult;
  error: string;
  onExport: () => void;
  onClear: () => void;
  t: Translate;
};

export function ResultsPanel({ result, error, onExport, onClear, t }: ResultsPanelProps) {
  return (
    <section className="results-card">
      <div className="results-head">
        <div>
          <span className="results-title">{t("results.title")}</span>
          <span className="results-meta">
            {result.columns.length
              ? t("results.rows", { count: result.values.length })
              : t("results.runToSee")}
          </span>
        </div>
        <div className="result-actions">
          <button className="small-btn" onClick={onExport} disabled={!result.columns.length}>
            <Download size={14} /> CSV
          </button>
          <button className="icon-btn" title={t("results.clear")} onClick={onClear}>
            <X size={15} />
          </button>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      {result.columns.length ? (
        <div className="result-scroll">
          <table>
            <thead>
              <tr>
                <th className="row-number">#</th>
                {result.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.values.map((row, index) => (
                <tr key={index}>
                  <td className="row-number">{index + 1}</td>
                  {row.map((cell, columnIndex) => (
                    <td key={columnIndex}>
                      {cell === null ? <span className="null-value">NULL</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-results">
          <div className="empty-icon">
            <Play size={18} />
          </div>
          <strong>{t("results.noResults")}</strong>
          <span>{t("results.writeQuery")}</span>
        </div>
      )}
    </section>
  );
}
