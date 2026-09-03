import { sqliteEngine } from "./sqlite/engine";
import { duckdbEngine } from "./duckdb/engine";

export const databaseEngines = [sqliteEngine, duckdbEngine];
export const defaultDatabaseEngine = sqliteEngine;
