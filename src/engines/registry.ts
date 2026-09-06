import { sqliteEngine } from "./sqlite/engine";
import { duckdbEngine } from "./duckdb/engine";
import { postgresqlEngine } from "./postgresql/engine";

export const databaseEngines = [sqliteEngine, duckdbEngine, postgresqlEngine];
export const defaultDatabaseEngine = sqliteEngine;
