// GAS wraps server-thrown errors as "ScriptError: Error: <message>".
// Strip all known prefixes so only the human-readable message reaches the UI.
export function cleanError(e: unknown): string {
  const raw = String(e instanceof Error ? e.message : e);
  return raw
    .replace(/^ScriptError:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();
}
