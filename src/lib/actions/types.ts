export type ActionResult = { error: string } | { success: true };

/** Maps a Postgres foreign-key-restrict violation to a friendly message. */
export function isForeignKeyRestrictError(error: { code?: string } | null): boolean {
  return error?.code === "23503";
}
