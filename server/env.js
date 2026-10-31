// Loads .env from the project root into process.env for keys that are missing OR empty.
// Node's --env-file skips keys already present, even when empty, which hides the value. Values are never logged.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
export function loadDotenv(path) {
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return []; }
  const loaded = [];
  for (const [k, v] of Object.entries(parseEnv(text))) if (!process.env[k] && v) { process.env[k] = v; loaded.push(k); }
  return loaded;
}
