export function parseKeyValueLines(raw?: string | null): Record<string, string> {
  if (!raw) {
    return {};
  }

  const parsed: Record<string, string> = {};
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    parsed[key] = value;
  }

  return parsed;
}
