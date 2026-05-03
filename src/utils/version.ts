import fs from 'fs';

function readVersion(): string {
  try {
    const raw = fs.readFileSync(
      new URL('../../package.json', import.meta.url),
      'utf-8'
    );
    const pkg = JSON.parse(raw);
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export const mcpServerVersion: string = readVersion();
