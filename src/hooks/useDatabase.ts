import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

type SessionSnapshot = { schema: SchemaTable[]; functions: string[]; demoResult?: QueryResult };
type CachedEngine = {
  factory: EngineFactory;
  session: EngineSession;
  schema: SchemaTable[];
  functions: string[];
  result: QueryResult;
  notice: Notice;
};

export function useDatabase(engine: DatabaseEngine) {
  const cacheRef = useRef(new Map<string, CachedEngine>());
  const sessionRef = useRef<EngineSession | null>(null);
  const activeEngineIdRef = useRef(engine.id);
  const sessionGenerationRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [functions, setFunctions] = useState<string[]>([]);
  const [result, setResult] = useState<QueryResult>(emptyResult);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>({ key: "notice.loading" });
  const [running, setRunning] = useState(false);
  const [stateEngineId, setStateEngineId] = useState<string | null>(null);

  useLayoutEffect(() => {
    activeEngineIdRef.current = engine.id;
  }, [engine.id]);

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

  const applyCachedSession = useCallback((engineId: string, cached: CachedEngine) => {
    if (activeEngineIdRef.current !== engineId) return;
    sessionRef.current = cached.session;
    sessionGenerationRef.current += 1;
    requestGenerationRef.current += 1;
    setSchema(cached.schema);
    setFunctions(cached.functions);
    setResult(cached.result);
    setNotice(cached.notice);
    setError("");
    setRunning(false);
    setStateEngineId(engineId);
    setReady(true);
  }, []);

  useEffect(() => {
    let active = true;
    setReady(false);
    setRunning(false);
    setError("");
    setStateEngineId(null);
    requestGenerationRef.current += 1;
    const cached = cacheRef.current.get(engine.id);
    if (cached) {
      applyCachedSession(engine.id, cached);
    } else {
      engine
        .load()
        .then(async (factory) => {
          if (!active || activeEngineIdRef.current !== engine.id) return;
          const session = await factory.createDemo();
          if (!active || activeEngineIdRef.current !== engine.id) {
            await session.close();
            return;
          }
          const snapshot = await inspectSession(session, true);
          if (!active || activeEngineIdRef.current !== engine.id) {
            await session.close();
            return;
          }
          const cachedSession: CachedEngine = {
            factory,
            session,
            schema: snapshot.schema,
            functions: snapshot.functions,
            result: snapshot.demoResult ?? emptyResult,
            notice: { key: "notice.demoReady" },
          };
          cacheRef.current.set(engine.id, cachedSession);
          applyCachedSession(engine.id, cachedSession);
        })
        .catch((err) => {
          if (active) setError(`SQL engine could not start: ${String(err)}`);
        });
    }
    return () => {
      active = false;
      requestGenerationRef.current += 1;
    };
  }, [applyCachedSession, engine, inspectSession]);

  useEffect(
    () => () => {
      void Promise.all([...cacheRef.current.values()].map((cached) => cached.session.close()));
    },
    [],
  );

  const refreshSchema = useCallback(async () => {
    const session = sessionRef.current;
    const cached = cacheRef.current.get(activeEngineIdRef.current);
    if (!session || !cached) return;
    const generation = sessionGenerationRef.current;
    try {
      const nextSchema = await session.getSchema();
      if (sessionRef.current === session && generation === sessionGenerationRef.current) {
        cached.schema = nextSchema;
        setSchema(nextSchema);
      }
    } catch (err) {
      if (sessionRef.current === session && generation === sessionGenerationRef.current)
        setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const runQuery = useCallback((statement: string): Promise<QueryExecution> => {
    const session = sessionRef.current;
    const cached = cacheRef.current.get(activeEngineIdRef.current);
    if (!session || !cached || !statement.trim())
      return Promise.resolve({ result: null, error: "" });
    const generation = sessionGenerationRef.current;
    const request = ++requestGenerationRef.current;
    setRunning(true);
    setError("");
    return new Promise((resolve) =>
      window.setTimeout(async () => {
        const stale = () =>
          sessionRef.current !== session ||
          generation !== sessionGenerationRef.current ||
          request !== requestGenerationRef.current;
        try {
          const output = await session.execute(statement);
          const nextSchema = await session.getSchema();
          if (stale()) {
            resolve({ result: null, error: "", stale: true });
            return;
          }
          cached.result = output;
          cached.schema = nextSchema;
          cached.notice = {
            key: "notice.rowsReturned",
            params: { count: output.values.length, plural: output.values.length === 1 ? "" : "s" },
          };
          setResult(output);
          setSchema(nextSchema);
          setNotice(cached.notice);
          resolve({ result: output, error: "" });
        } catch (err) {
          if (stale()) {
            resolve({ result: null, error: "", stale: true });
            return;
          }
          const message = err instanceof Error ? err.message : String(err);
          cached.notice = { key: "notice.queryFailed" };
          setError(message);
          setNotice(cached.notice);
          resolve({ result: null, error: message });
        } finally {
          if (request === requestGenerationRef.current) setRunning(false);
        }
      }, 30),
    );
  }, []);

  const replaceSession = useCallback(
    async (
      targetEngineId: string,
      cached: CachedEngine,
      session: EngineSession,
      snapshot: SessionSnapshot,
      nextResult: QueryResult,
      nextNotice: Notice,
    ) => {
      if (cacheRef.current.get(targetEngineId) !== cached)
        throw new Error("SQL engine session changed during this operation");
      if (activeEngineIdRef.current === targetEngineId) {
        requestGenerationRef.current += 1;
        setRunning(false);
        setReady(false);
      }
      try {
        await cached.session.close();
      } catch (error) {
        applyCachedSession(targetEngineId, cached);
        throw error;
      }
      cached.session = session;
      cached.schema = snapshot.schema;
      cached.functions = snapshot.functions;
      cached.result = nextResult;
      cached.notice = nextNotice;
      applyCachedSession(targetEngineId, cached);
    },
    [applyCachedSession],
  );

  const loadFile = useCallback(
    async (file: File): Promise<DatabaseActionResult> => {
      const targetEngineId = engine.id;
      const cached = cacheRef.current.get(targetEngineId);
      if (!cached) return { ok: false, error: "SQL engine is not ready" };
      let candidate: EngineSession | null = null;
      try {
        candidate = await cached.factory.openFile(
          new Uint8Array(await file.arrayBuffer()),
          file.name,
        );
        const snapshot = await inspectSession(candidate);
        await replaceSession(targetEngineId, cached, candidate, snapshot, emptyResult, {
          key: "notice.fileLoaded",
          params: { name: file.name },
        });
        candidate = null;
        return { ok: true };
      } catch (err) {
        await (candidate ? Promise.resolve(candidate.close()).catch(() => undefined) : undefined);
        const message = `Could not open database: ${err instanceof Error ? err.message : String(err)}`;
        if (activeEngineIdRef.current === targetEngineId) setError(message);
        return { ok: false, error: message };
      }
    },
    [engine.id, inspectSession, replaceSession],
  );

  const resetDemo = useCallback(async (): Promise<DatabaseActionResult> => {
    const targetEngineId = engine.id;
    const cached = cacheRef.current.get(targetEngineId);
    if (!cached) return { ok: false, error: "SQL engine is not ready" };
    let candidate: EngineSession | null = null;
    try {
      candidate = await cached.factory.createDemo();
      const snapshot = await inspectSession(candidate, true);
      await replaceSession(targetEngineId, cached, candidate, snapshot, emptyResult, {
        key: "notice.demoReady",
      });
      candidate = null;
      return { ok: true };
    } catch (err) {
      await (candidate ? Promise.resolve(candidate.close()).catch(() => undefined) : undefined);
      const message = `Could not reset demo database: ${err instanceof Error ? err.message : String(err)}`;
      if (activeEngineIdRef.current === targetEngineId) setError(message);
      return { ok: false, error: message };
    }
  }, [engine.id, inspectSession, replaceSession]);

  const clearResult = useCallback(() => {
    const cached = cacheRef.current.get(activeEngineIdRef.current);
    if (cached) {
      cached.result = emptyResult;
      cached.notice = { key: "notice.resultsCleared" };
    }
    setResult(emptyResult);
    setError("");
    setNotice({ key: "notice.resultsCleared" });
  }, []);

  return {
    engine,
    stateEngineId,
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
