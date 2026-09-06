const STORAGE_KEY = "sql-playground-workspace";
const STORAGE_VERSION = 1;
const MAX_TABS_PER_ENGINE = 50;
const MAX_TAB_TITLE_LENGTH = 100;
const MAX_SQL_LENGTH = 1_000_000;

export type PersistedQueryTab = {
  id: string;
  title: string;
  sql: string;
};

export type PersistedQueryWorkspace = {
  tabs: PersistedQueryTab[];
  activeTabId: string;
};

export type PersistedWorkspaceState = {
  workspaces: Record<string, PersistedQueryWorkspace>;
  editorHeight: number;
};

type WorkspaceStateToSave = {
  workspaces: Record<
    string,
    {
      tabs: Array<{ id: string; title: string; sql: string }>;
      activeTabId: string;
    }
  >;
  editorHeight: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTab(value: unknown): PersistedQueryTab | null {
  if (!isRecord(value)) return null;
  const { id, title, sql } = value;
  if (typeof id !== "string" || !id || typeof title !== "string" || typeof sql !== "string") {
    return null;
  }
  return {
    id: id.slice(0, MAX_TAB_TITLE_LENGTH),
    title: title.slice(0, MAX_TAB_TITLE_LENGTH),
    sql: sql.slice(0, MAX_SQL_LENGTH),
  };
}

function readWorkspace(value: unknown): PersistedQueryWorkspace | null {
  if (!isRecord(value) || !Array.isArray(value.tabs)) return null;
  const tabs: PersistedQueryTab[] = [];
  const tabIds = new Set<string>();
  for (const valueTab of value.tabs.slice(0, MAX_TABS_PER_ENGINE)) {
    const tab = readTab(valueTab);
    if (!tab || tabIds.has(tab.id)) continue;
    tabIds.add(tab.id);
    tabs.push(tab);
  }
  if (!tabs.length) return null;
  const activeTabId =
    typeof value.activeTabId === "string" && tabIds.has(value.activeTabId)
      ? value.activeTabId
      : tabs[0].id;
  return { tabs, activeTabId };
}

export function loadWorkspaceState(engineIds: readonly string[]): PersistedWorkspaceState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== STORAGE_VERSION || !isRecord(value.workspaces)) {
      return null;
    }
    const knownEngineIds = new Set(engineIds);
    const workspaces: Record<string, PersistedQueryWorkspace> = {};
    for (const [engineId, workspaceValue] of Object.entries(value.workspaces)) {
      if (!knownEngineIds.has(engineId)) continue;
      const workspace = readWorkspace(workspaceValue);
      if (workspace) workspaces[engineId] = workspace;
    }
    const editorHeight = Number(value.editorHeight);
    if (!Number.isFinite(editorHeight)) return null;
    return { workspaces, editorHeight };
  } catch {
    return null;
  }
}

export function saveWorkspaceState({ workspaces, editorHeight }: WorkspaceStateToSave): void {
  try {
    const persistedWorkspaces = Object.fromEntries(
      Object.entries(workspaces).map(([engineId, workspace]) => [
        engineId,
        {
          activeTabId: workspace.activeTabId,
          tabs: workspace.tabs.map(({ id, title, sql }) => ({ id, title, sql })),
        },
      ]),
    );
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        workspaces: persistedWorkspaces,
        editorHeight,
      }),
    );
  } catch {
    // localStorage can be unavailable or full. The in-memory workspace remains usable.
  }
}
