import { useRef } from "react";
import { Database, FileUp, Github, Languages } from "lucide-react";
import type { Locale, Translate } from "../lib/i18n";
import type { DatabaseEngine } from "../types/database";

type TopBarProps = {
  onImport: (file: File) => void;
  locale: Locale;
  onToggleLocale: () => void;
  t: Translate;
  engine: DatabaseEngine;
};

export function TopBar({ onImport, locale, onToggleLocale, t, engine }: TopBarProps) {
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
        <button
          className="locale-btn"
          onClick={onToggleLocale}
          title={t("action.switchLanguage")}
          aria-label={t("action.switchLanguage")}
        >
          <Languages size={14} /> {locale === "cn" ? "EN" : "中文"}
        </button>
        <a
          className="github-link"
          href="https://github.com/LRainner/sql-playground"
          target="_blank"
          rel="noreferrer"
          title={t("action.github")}
          aria-label={t("action.github")}
        >
          <Github size={16} />
        </a>
        <span className="local-pill">
          <span className="pulse" /> {t("status.runsLocally")}
        </span>
      </div>
    </header>
  );
}
