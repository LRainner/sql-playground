import { useRef } from "react";
import { Database, Download, FileUp, Languages } from "lucide-react";
import type { Locale, Translate } from "../lib/i18n";
import type { DatabaseEngine } from "../types/database";

type TopBarProps = {
  onImport: (file: File) => void;
  onExport: () => void;
  canExport: boolean;
  locale: Locale;
  onToggleLocale: () => void;
  t: Translate;
  engine: DatabaseEngine;
};

export function TopBar({
  onImport,
  onExport,
  canExport,
  locale,
  onToggleLocale,
  t,
  engine,
}: TopBarProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Database size={18} />
        </div>
        <div>
          <div className="brand-name">SQL Playground</div>
          <div className="brand-sub">{t("brand.subtitle")}</div>
        </div>
      </div>
      <div className="top-actions">
        <button
          type="button"
          className="ghost-btn"
          title={t("action.importDatabase")}
          onClick={() => fileInput.current?.click()}
        >
          <FileUp size={15} /> {t("action.importDatabase")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={`${engine.fileExtensions.join(",")},application/octet-stream`}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.currentTarget.value = "";
          }}
        />
        <button className="ghost-btn" onClick={onExport} disabled={!canExport}>
          <Download size={15} /> {t("action.exportCsv")}
        </button>
        <button
          className="locale-btn"
          onClick={onToggleLocale}
          title={t("action.switchLanguage")}
          aria-label={t("action.switchLanguage")}
        >
          <Languages size={14} /> {locale === "cn" ? "EN" : "中文"}
        </button>
        <span className="local-pill">
          <span className="pulse" /> {t("status.runsLocally")}
        </span>
      </div>
    </header>
  );
}
