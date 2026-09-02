import { useCallback, useEffect, useRef, useState } from "react";
import type { Database, SqlJsStatic } from "sql.js";
import type { TranslationKey, TranslationParams } from "../lib/i18n";
import {
  createDemoDatabase,
  DEMO_SQL,
  executeQuery,
  loadSqlite,
  readFunctions,
  readSchema,
} from "../lib/sqlite";
import type { QueryResult, SchemaTable } from "../types/sqlite";

export type Notice = { key: TranslationKey; params?: TranslationParams };
export type QueryExecution = { result: QueryResult | null; error: string };

const emptyResult: QueryResult = { columns: [], values: [] };

export function useSqliteDatabase() {
  const dbRef = useRef<Database | null>(null);
  const sqlRef = useRef<SqlJsStatic | null>(null);
  const [ready, setReady] = useState(false);
  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [functions, setFunctions] = useState<string[]>([]);
  const [result, setResult] = useState<QueryResult>(emptyResult);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>({ key: "notice.loading" });
  const [running, setRunning] = useState(false);

  const syncDemo = useCallback((db: Database) => {
    dbRef.current = db;
    setSchema(readSchema(db));
    setFunctions(readFunctions(db));
    setResult(executeQuery(db, DEMO_SQL));
    setNotice({ key: "notice.demoReady" });
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    loadSqlite()
      .then((SQL) => {
        if (!active) return;
        sqlRef.current = SQL;
        syncDemo(createDemoDatabase(SQL));
        setReady(true);
      })
      .catch((err) => setError(`SQL engine could not start: ${String(err)}`));
    return () => {
      active = false;
      dbRef.current?.close();
    };
  }, [syncDemo]);

  const refreshSchema = useCallback(() => {
    if (dbRef.current) setSchema(readSchema(dbRef.current));
  }, []);

  const runQuery = useCallback(
    (statement: string): Promise<QueryExecution> => {
      const db = dbRef.current;
      if (!db || !statement.trim()) return Promise.resolve({ result: null, error: "" });
      setRunning(true);
      setError("");
      return new Promise((resolve) => {
        window.setTimeout(() => {
          try {
            const output = executeQuery(db, statement);
            setResult(output);
            refreshSchema();
            setNotice({
              key: "notice.rowsReturned",
              params: {
                count: output.values.length,
                plural: output.values.length === 1 ? "" : "s",
              },
            });
            resolve({ result: output, error: "" });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setNotice({ key: "notice.queryFailed" });
            resolve({ result: null, error: message });
          } finally {
            setRunning(false);
          }
        }, 30);
      });
    },
    [refreshSchema],
  );

  const loadFile = useCallback(async (file: File) => {
    if (!sqlRef.current) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      dbRef.current?.close();
      const db = new sqlRef.current.Database(bytes);
      dbRef.current = db;
      setSchema(readSchema(db));
      setFunctions(readFunctions(db));
      setResult(emptyResult);
      setError("");
      setNotice({ key: "notice.fileLoaded", params: { name: file.name } });
    } catch (err) {
      setError(`Could not open database: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const resetDemo = useCallback(() => {
    if (!sqlRef.current) return;
    dbRef.current?.close();
    syncDemo(createDemoDatabase(sqlRef.current));
  }, [syncDemo]);

  const clearResult = useCallback(() => {
    setResult(emptyResult);
    setError("");
    setNotice({ key: "notice.resultsCleared" });
  }, []);

  return {
    ready,
    schema,
    functions,
    result,
    error,
    notice,
    running,
    runQuery,
    loadFile,
    refreshSchema,
    resetDemo,
    clearResult,
  };
}
