import CodeMirror from "@uiw/react-codemirror";
import { SQLDialect, SQLite, sql } from "@codemirror/lang-sql";
import { useMemo, useState } from "react";
import type { Translate } from "../lib/i18n";
import { modKeyLabel } from "../lib/platform";
import type { SchemaTable } from "../types/sqlite";

type QueryEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  t: Translate;
  schema: SchemaTable[];
  functions: string[];
  /** Height of the code area in px, controlled by the resizable splitter. */
  height: number;
};

export function QueryEditor({
  value,
  onChange,
  onRun,
  t,
  schema,
  functions,
  height,
}: QueryEditorProps) {
  const [selectedText, setSelectedText] = useState("");
  const completionSchema = useMemo(
    () =>
      Object.fromEntries(
        schema.map((table) => [table.name, table.columns.map((column) => column.name)]),
      ),
    [schema],
  );
  const functionNames = useMemo(() => new Set(functions), [functions]);
  const sqliteDialect = useMemo(
    () =>
      SQLDialect.define({
        ...SQLite.spec,
        builtin: `${SQLite.spec.builtin ?? ""} ${functions.join(" ")}`,
      }),
    [functions],
  );
  const sqlExtension = useMemo(
    () =>
      sql({
        dialect: sqliteDialect,
        schema: completionSchema,
        upperCaseKeywords: true,
        keywordCompletion: (label, type) =>
          functionNames.has(label.toLowerCase())
            ? {
                label,
                displayLabel: `${label}()`,
                apply: `${label}()`,
                type: "function",
                detail: t("editor.functionDetail"),
              }
            : { label, type },
      }),
    [completionSchema, functionNames, sqliteDialect, t],
  );

  return (
    <section
      className="editor-card"
      onKeyDownCapture={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          onRun();
        }
      }}
    >
      <div className="editor-head">
        <span className="editor-label">{t("editor.label")}</span>
        {selectedText ? (
          <span className="selection-hint" title={selectedText}>
            {t("editor.selected", { count: selectedText.length })}{" "}
            <code>{selectedText.length > 42 ? `${selectedText.slice(0, 42)}…` : selectedText}</code>
          </span>
        ) : (
          <span className="editor-hint">
            {t("editor.runWith")} <kbd>{modKeyLabel()}</kbd>
            <kbd>Enter</kbd>
          </span>
        )}
      </div>
      <div className="editor-wrap">
        <CodeMirror
          value={value}
          height={`${height}px`}
          extensions={[sqlExtension]}
          theme="dark"
          onChange={onChange}
          onUpdate={(update) => {
            const { from, to } = update.state.selection.main;
            setSelectedText(
              from === to ? "" : update.state.sliceDoc(from, to).replace(/\s+/g, " ").trim(),
            );
          }}
        />
      </div>
    </section>
  );
}
