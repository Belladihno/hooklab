const HARD_DELETE_TABLES = new Set(['projects']);

export function isHardDeleteAllowed(tableName: string): boolean {
  return HARD_DELETE_TABLES.has(tableName);
}
