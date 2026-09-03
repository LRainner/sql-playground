export type Column = { name: string; type: string; pk: number };
export type SchemaTable = { name: string; columns: Column[] };
export type QueryResult = { columns: string[]; values: unknown[][] };
export type Awaitable<T> = T | Promise<T>;
export type SqlDialect = "sqlite" | "duckdb";

export type EngineSession = {
  execute(statement: string): Awaitable<QueryResult>;
  getSchema(): Awaitable<SchemaTable[]>;
  getFunctions(): Awaitable<string[]>;
  close(): Awaitable<void>;
};

export type EngineFactory = {
  createDemo(): Awaitable<EngineSession>;
  openFile(bytes: Uint8Array, fileName?: string): Awaitable<EngineSession>;
};

export type DatabaseEngine = {
  id: string;
  name: string;
  version: string;
  dialect: SqlDialect;
  demoSql: string;
  fileExtensions: string[];
  load(): Promise<EngineFactory>;
};
