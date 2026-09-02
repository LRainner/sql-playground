import { Database, Download, FileUp, Languages } from "lucide-react";
import type { Locale, Translate } from "../lib/i18n";

type TopBarProps = {
  onImport: (file: File) => void;
  onExport: () => void;
  canExport: boolean;
  locale: Locale;
  onToggleLocale: () => void;
  t: Translate;
};

export function TopBar({ onImport, onExport, canExport, locale, onToggleLocale, t }: TopBarProps) {
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
        <label className="ghost-btn">
          <FileUp size={15} /> {t("action.importDatabase")}
          <input
            type="file"
            accept=".db,.sqlite,.sqlite3,application/octet-stream"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
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
