/**
 * `{{key}}` substitution — the only templating the prompts get.
 *
 * Lives in its own module so tools can use it without importing the agent
 * loop, which would be a cycle.
 */
export function render(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    values[key] !== undefined ? values[key] : match,
  );
}

export function toEnvKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}
