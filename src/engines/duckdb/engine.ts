import * as duckdb from "@duckdb/duckdb-wasm";
import duckdbWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import duckdbWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type {
  DatabaseEngine,
  EngineFactory,
  EngineSession,
  QueryResult,
  SchemaTable,
} from "../../types/database";

export const DUCKDB_DEMO_SQL = "SELECT * FROM demo;";
const DUCKDB_DEMO_SETUP = `
CREATE TABLE demo (
  id INTEGER,
  name VARCHAR NOT NULL,
  email VARCHAR,
  plan VARCHAR NOT NULL,
  joined_at VARCHAR NOT NULL
);
INSERT INTO demo VALUES
  (1, 'Ava Martinez', 'ava@example.com', 'Pro', '2025-01-12'),
  (2, 'Noah Williams', 'noah@example.com', 'Team', '2025-02-03'),
  (3, 'Mia Chen', 'mia@example.com', 'Free', '2025-02-18'),
  (4, 'Leo Johnson', 'leo@example.com', 'Pro', '2025-03-01'),
  (5, 'Sophia Kim', 'sophia@example.com', 'Free', '2025-03-22');`;

type ArrowTable = {
  schema: { fields: Array<{ name: string }> };
  toArray(): Array<Record<string, unknown> & { toJSON?: () => Record<string, unknown> }>;
};

function toQueryResult(table: ArrowTable): QueryResult {
  const columns = table.schema.fields.map((field) => field.name);
  const values = table.toArray().map((row) => {
    const record = typeof row.toJSON === "function" ? row.toJSON() : row;
    return columns.map((column) => record[column]);
  });
  return { columns, values };
}

type DuckDBResources = {
  worker: Worker;
  db: AsyncDuckDB;
  connection: AsyncDuckDBConnection;
};

type ImportFileType = "csv" | "json" | "parquet" | "duckdb";

async function disposeResources(resources: Partial<DuckDBResources>): Promise<void> {
  try {
    await resources.connection?.close();
  } finally {
    try {
      await resources.db?.terminate();
    } finally {
      resources.worker?.terminate();
    }
  }
}

function detectFileType(bytes: Uint8Array, fileName: string): ImportFileType {
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase();
  if (extension === "csv" || extension === "json" || extension === "parquet") return extension;
  if (extension === "duckdb" || extension === "db") return "duckdb";
  if (new TextDecoder().decode(bytes.slice(0, 4)) === "PAR1") return "parquet";

  const sample = new TextDecoder().decode(bytes.slice(0, 8192)).trimStart();
  if (sample.startsWith("{") || sample.startsWith("[")) return "json";
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  if (sample.includes("\n") && /[,;\t]/.test(firstLine)) return "csv";
  return "duckdb";
}

async function createConnection(): Promise<DuckDBResources> {
  const worker = new Worker(duckdbWorker);
  let db: AsyncDuckDB | undefined;
  try {
    db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await db.instantiate(duckdbWasm);
    return { worker, db, connection: await db.connect() };
  } catch (error) {
    await disposeResources({ worker, db }).catch(() => undefined);
    throw error;
  }
}

function createSession(resources: DuckDBResources): EngineSession {
  const { db, connection } = resources;
  let closed = false;
  return {
    execute: async (statement) => toQueryResult(await connection.query(statement)),
    getSchema: async () => {
      const table = toQueryResult(
        await connection.query(`
        SELECT table_name, column_name, data_type, ordinal_position
        FROM information_schema.columns
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_name, ordinal_position;
      `),
      );
      const tables = new Map<string, SchemaTable>();
      const tableIndex = table.columns.indexOf("table_name");
      const columnIndex = table.columns.indexOf("column_name");
      const typeIndex = table.columns.indexOf("data_type");
      for (const row of table.values) {
        const name = String(row[tableIndex]);
        const current = tables.get(name) ?? { name, columns: [] };
        current.columns.push({
          name: String(row[columnIndex]),
          type: String(row[typeIndex]),
          pk: 0,
        });
        tables.set(name, current);
      }
      return [...tables.values()];
    },
    getFunctions: async () => {
      const table = toQueryResult(
        await connection.query(
          "SELECT DISTINCT function_name FROM duckdb_functions() ORDER BY function_name;",
        ),
      );
      return table.values.map((row) => String(row[0]).toLowerCase()).filter(Boolean);
    },
    close: async () => {
      if (closed) return;
      closed = true;
      await disposeResources(resources);
    },
  };
}

export const duckdbEngine: DatabaseEngine = {
  id: "duckdb",
  name: "DuckDB",
  version: "Wasm · local",
  dialect: "duckdb",
  demoSql: DUCKDB_DEMO_SQL,
  fileExtensions: [".duckdb", ".csv", ".json", ".parquet"],
  async load(): Promise<EngineFactory> {
    return {
      createDemo: async () => {
        const resources = await createConnection();
        try {
          await resources.connection.query(DUCKDB_DEMO_SETUP);
          return createSession(resources);
        } catch (error) {
          await disposeResources(resources).catch(() => undefined);
          throw error;
        }
      },
      openFile: async (bytes, fileName = "import.duckdb") => {
        const fileType = detectFileType(bytes, fileName);
        const registeredName = `upload.${fileType}`;
        const resources = await createConnection();
        try {
          await resources.db.registerFileBuffer(registeredName, bytes);
          if (fileType === "csv") {
            await resources.connection.query(
              `CREATE TABLE imported AS SELECT * FROM read_csv_auto('${registeredName}');`,
            );
          } else if (fileType === "json") {
            await resources.connection.query(
              `CREATE TABLE imported AS SELECT * FROM read_json_auto('${registeredName}');`,
            );
          } else if (fileType === "parquet") {
            await resources.connection.query(
              `CREATE TABLE imported AS SELECT * FROM read_parquet('${registeredName}');`,
            );
          } else {
            await resources.connection.query(
              `ATTACH '${registeredName}' AS imported; USE imported;`,
            );
          }
          return createSession(resources);
        } catch (error) {
          await disposeResources(resources).catch(() => undefined);
          throw error;
        }
      },
    };
  },
};
