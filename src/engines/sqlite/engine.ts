import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { DatabaseEngine, EngineSession, QueryResult, SchemaTable } from "../../types/database";

export const DEMO_SQL = "SELECT * FROM demo;";

const DEMO_SETUP = `
CREATE TABLE demo (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  plan TEXT NOT NULL,
  joined_at TEXT NOT NULL
);
INSERT INTO demo VALUES
  (1, 'Ava Martinez', 'ava@example.com', 'Pro', '2025-01-12'),
  (2, 'Noah Williams', 'noah@example.com', 'Team', '2025-02-03'),
  (3, 'Mia Chen', 'mia@example.com', 'Free', '2025-02-18'),
  (4, 'Leo Johnson', 'leo@example.com', 'Pro', '2025-03-01'),
  (5, 'Sophia Kim', 'sophia@example.com', 'Free', '2025-03-22');`;

function execute(db: Database, statement: string): QueryResult {
  const result = db.exec(statement);
  if (!result.length) return { columns: [], values: [] };
  return { columns: result[0].columns, values: result[0].values };
}

function getSchema(db: Database): SchemaTable[] {
  const tables = execute(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
  );
  return tables.values.map(([name]) => {
    const escapedName = String(name).replaceAll('"', '""');
    const info = execute(db, `PRAGMA table_info("${escapedName}");`);
    return {
      name: String(name),
      columns: info.values.map((row) => ({
        name: String(row[1]),
        type: String(row[2] || "TEXT"),
        pk: Number(row[5]),
      })),
    };
  });
}

function getFunctions(db: Database): string[] {
  try {
    const functions = execute(db, "PRAGMA function_list;");
    const nameIndex = functions.columns.indexOf("name");
    if (nameIndex < 0) return [];
    return [...new Set(functions.values.map((row) => String(row[nameIndex]).trim().toLowerCase()))]
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}

function createSession(db: Database): EngineSession {
  return {
    execute: (statement) => execute(db, statement),
    getSchema: () => getSchema(db),
    getFunctions: () => getFunctions(db),
    close: () => db.close(),
  };
}

export const sqliteEngine: DatabaseEngine = {
  id: "sqlite",
  name: "SQLite",
  version: "3.x · WASM",
  dialect: "sqlite",
  demoName: "Demo.Memory",
  demoSql: DEMO_SQL,
  fileExtensions: [".db", ".sqlite", ".sqlite3"],
  async load() {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    return {
      createDemo: () => {
        const db = new SQL.Database();
        db.run(DEMO_SETUP);
        return createSession(db);
      },
      openFile: (bytes) => createSession(new SQL.Database(bytes)),
    };
  },
};
