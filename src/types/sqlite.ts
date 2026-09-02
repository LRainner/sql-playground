import type { Database } from "sql.js";

export type Column = { name: string; type: string; pk: number };
export type SchemaTable = { name: string; columns: Column[] };
export type QueryResult = { columns: string[]; values: unknown[][] };
export type SqlDatabase = Database;
