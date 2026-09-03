import { useCallback, useEffect, useRef, useState } from "react";
import type { TranslationKey, TranslationParams } from "../lib/i18n";
import type {
  DatabaseEngine,
  EngineFactory,
  EngineSession,
  QueryResult,
  SchemaTable,
} from "../types/database";

export type Notice = { key: TranslationKey; params?: TranslationParams };
export type QueryExecution = { result: QueryResult | null; error: string; stale?: boolean };
export type DatabaseActionResult = { ok: true } | { ok: false; error: string };

const emptyResult: QueryResult = { columns: [], values: [] };

type SessionSnapshot = {
  schema: SchemaTable[];
  functions: string[];
  demoResult?: QueryResult;
};

export function useDatabase(engine: DatabaseEngine) {
  const factoryRef = useRef<EngineFactory | null>(null);
  const sessionRef = useRef<EngineSession | null>(null);
  const sessionGenerationRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [databaseName, setDatabaseName] = useState(engine.demoName);
  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [functions, setFunctions] = useState<string[]>([]);
  const [result, setResult] = useState<QueryResult>(emptyResult);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>({ key: "notice.loading" });
  const [running, setRunning] = useState(false);

  const inspectSession = useCallback(
    async (session: EngineSession, includeDemoResult = false): Promise<SessionSnapshot> => {
      const [nextSchema, nextFunctions] = await Promise.all([
        session.getSchema(),
        session.getFunctions(),
      ]);
      return {
        schema: nextSchema,
        functions: nextFunctions,
        demoResult: includeDemoResult ? await session.execute(engine.demoSql) : undefined,
      };
    },
    [engine.demoSql],
  );

  const commitSession = useCallback(
    async (
      session: EngineSession,
      snapshot: SessionSnapshot,
      nextDatabaseName: string,
      nextNotice: Notice,
      nextResult: QueryResult,
    ) => {
      const previousSession = sessionRef.current;
      setReady(false);
      requestGenerationRef.current += 1;
      try {
        await previousSession?.close();
      } catch (closeError) {
        await Promise.resolve(session.close()).catch(() => undefined);
        setReady(Boolean(previousSession));
        throw closeError;
      }
      sessionRef.current = session;
      sessionGenerationRef.current += 1;
      requestGenerationRef.current += 1;
      setDatabaseName(nextDatabaseName);
      setSchema(snapshot.schema);
      setFunctions(snapshot.functions);
      setResult(nextResult);
      setNotice(nextNotice);
      setError("");
      setReady(true);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    engine
      .load()
      .then(async (factory) => {
        if (!active) return;
        factoryRef.current = factory;
        const candidate = await factory.createDemo();
        if (!active) {
          await candidate.close();
          return;
        }
        const snapshot = await inspectSession(candidate, true);
        if (!active) {
          await candidate.close();
          return;
        }
        await commitSession(
          candidate,
          snapshot,
          engine.demoName,
          { key: "notice.demoReady" },
          snapshot.demoResult ?? emptyResult,
        );
      })
      .catch((err) => {
        if (active) setError(`SQL engine could not start: ${String(err)}`);
      });
    return () => {
      active = false;
      requestGenerationRef.current += 1;
      void sessionRef.current?.close();
    };
  }, [commitSession, engine, inspectSession]);

  const refreshSchema = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    const sessionGeneration = sessionGenerationRef.current;
    try {
      const nextSchema = await session.getSchema();
      if (sessionRef.current === session && sessionGenerationRef.current === sessionGeneration) {
        setSchema(nextSchema);
      }
    } catch (err) {
      if (sessionRef.current === session && sessionGenerationRef.current === sessionGeneration) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, []);

  const runQuery = useCallback((statement: string): Promise<QueryExecution> => {
    const session = sessionRef.current;
    if (!session || !statement.trim()) return Promise.resolve({ result: null, error: "" });
    const sessionGeneration = sessionGenerationRef.current;
    const requestGeneration = ++requestGenerationRef.current;
    setRunning(true);
    setError("");
    return new Promise((resolve) => {
      window.setTimeout(async () => {
        const isStale = () =>
          sessionRef.current !== session ||
          sessionGenerationRef.current !== sessionGeneration ||
          requestGenerationRef.current !== requestGeneration;
        try {
          const output = await session.execute(statement);
          const nextSchema = await session.getSchema();
          if (isStale()) {
            resolve({ result: null, error: "", stale: true });
            return;
          }
          setResult(output);
          setSchema(nextSchema);
          setNotice({
            key: "notice.rowsReturned",
            params: {
              count: output.values.length,
              plural: output.values.length === 1 ? "" : "s",
            },
          });
          resolve({ result: output, error: "" });
        } catch (err) {
          if (isStale()) {
            resolve({ result: null, error: "", stale: true });
            return;
          }
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setNotice({ key: "notice.queryFailed" });
          resolve({ result: null, error: message });
        } finally {
          if (requestGenerationRef.current === requestGeneration) setRunning(false);
        }
      }, 30);
    });
  }, []);

  const loadFile = useCallback(
    async (file: File): Promise<DatabaseActionResult> => {
      const factory = factoryRef.current;
      if (!factory) return { ok: false, error: "SQL engine is not ready" };
      let candidate: EngineSession | null = null;
      try {
        candidate = await factory.openFile(new Uint8Array(await file.arrayBuffer()));
        const snapshot = await inspectSession(candidate);
        await commitSession(
          candidate,
          snapshot,
          file.name,
          { key: "notice.fileLoaded", params: { name: file.name } },
          emptyResult,
        );
        candidate = null;
        return { ok: true };
      } catch (err) {
        await (candidate ? Promise.resolve(candidate.close()).catch(() => undefined) : undefined);
        const message = `Could not open database: ${err instanceof Error ? err.message : String(err)}`;
        setError(message);
        return { ok: false, error: message };
      }
    },
    [commitSession, inspectSession],
  );

  const resetDemo = useCallback(async (): Promise<DatabaseActionResult> => {
    const factory = factoryRef.current;
    if (!factory) return { ok: false, error: "SQL engine is not ready" };
    let candidate: EngineSession | null = null;
    try {
      candidate = await factory.createDemo();
      const snapshot = await inspectSession(candidate, true);
      await commitSession(
        candidate,
        snapshot,
        engine.demoName,
        { key: "notice.demoReady" },
        snapshot.demoResult ?? emptyResult,
      );
      candidate = null;
      return { ok: true };
    } catch (err) {
      await (candidate ? Promise.resolve(candidate.close()).catch(() => undefined) : undefined);
      const message = `Could not reset demo database: ${err instanceof Error ? err.message : String(err)}`;
      setError(message);
      return { ok: false, error: message };
    }
  }, [commitSession, engine.demoName, inspectSession]);

  const clearResult = useCallback(() => {
    setResult(emptyResult);
    setError("");
    setNotice({ key: "notice.resultsCleared" });
  }, []);

  return {
    engine,
    databaseName,
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
