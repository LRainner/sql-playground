import type { PGlite } from "@electric-sql/pglite";
import type { DatabaseEngine, EngineSession, SchemaTable } from "../../types/database";
import { decodeSqlImport, toLastQueryResult, type PGliteQueryResult } from "./adapter";

export const POSTGRESQL_DEMO_SQL = "SELECT * FROM demo;";

const POSTGRESQL_DEMO_SETUP = `
CREATE TABLE demo (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  plan TEXT NOT NULL,
  joined_at DATE NOT NULL
);
INSERT INTO demo VALUES
  (1, 'Ava Martinez', 'ava@example.com', 'Pro', '2025-01-12'),
  (2, 'Noah Williams', 'noah@example.com', 'Team', '2025-02-03'),
  (3, 'Mia Chen', 'mia@example.com', 'Free', '2025-02-18'),
  (4, 'Leo Johnson', 'leo@example.com', 'Pro', '2025-03-01'),
  (5, 'Sophia Kim', 'sophia@example.com', 'Free', '2025-03-22');`;

const POSTGRESQL_SCHEMA_SQL = `
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  CASE WHEN EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_schema = tc.constraint_schema
      AND kcu.constraint_name = tc.constraint_name
      AND kcu.table_name = tc.table_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = c.table_schema
      AND tc.table_name = c.table_name
      AND kcu.column_name = c.column_name
  ) THEN 1 ELSE 0 END AS is_primary_key
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema
  AND t.table_name = c.table_name
WHERE c.table_schema = 'public'
  AND t.table_type IN ('BASE TABLE', 'VIEW')
ORDER BY c.table_name, c.ordinal_position;`;

const POSTGRESQL_FUNCTIONS_SQL = `
SELECT DISTINCT p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind IN ('f', 'w', 'a')
  AND n.nspname = 'public'
ORDER BY p.proname;`;

async function createClient(dataDir: string): Promise<PGlite> {
  const { PGlite } = await import("@electric-sql/pglite");
  return PGlite.create(dataDir);
}

function createSession(db: PGlite): EngineSession {
  let closed = false;
  return {
    execute: async (statement) => {
      const results = await db.exec(statement);
      return toLastQueryResult(results);
    },
    getSchema: async () => {
      const result = (await db.query(POSTGRESQL_SCHEMA_SQL)) as PGliteQueryResult;
      const tables = new Map<string, SchemaTable>();
      for (const row of result.rows) {
        const name = String(row.table_name);
        const table = tables.get(name) ?? { name, columns: [] };
        table.columns.push({
          name: String(row.column_name),
          type: String(row.data_type),
          pk: Number(row.is_primary_key),
        });
        tables.set(name, table);
      }
      return [...tables.values()];
    },
    getFunctions: async () => {
      const result = (await db.query(POSTGRESQL_FUNCTIONS_SQL)) as PGliteQueryResult;
      return result.rows.map((row) => String(row.function_name).toLowerCase()).filter(Boolean);
    },
    close: async () => {
      if (closed) return;
      closed = true;
      await db.close();
    },
  };
}

export const postgresqlEngine: DatabaseEngine = {
  id: "postgresql",
  name: "PostgreSQL",
  version: "PGlite · WASM",
  dialect: "postgresql",
  demoSql: POSTGRESQL_DEMO_SQL,
  fileExtensions: [".sql"],
  async load() {
    return {
      createDemo: async () => {
        const db = await createClient("memory://sql-playground-postgresql");
        try {
          await db.exec(POSTGRESQL_DEMO_SETUP);
          return createSession(db);
        } catch (error) {
          await db.close().catch(() => undefined);
          throw error;
        }
      },
      openFile: async (bytes, fileName = "import.sql") => {
        const sql = decodeSqlImport(bytes, fileName);
        const db = await createClient("memory://sql-playground-postgresql-import");
        try {
          await db.exec(sql);
          return createSession(db);
        } catch (error) {
          await db.close().catch(() => undefined);
          throw error;
        }
      },
    };
  },
};
