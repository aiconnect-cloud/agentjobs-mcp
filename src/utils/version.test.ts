import { describe, it, expect } from 'vitest';
import { mcpServerVersion } from './version.js';

describe('mcpServerVersion', () => {
  it('resolves to a non-empty string from package.json in dev tree', () => {
    expect(typeof mcpServerVersion).toBe('string');
    expect(mcpServerVersion.length).toBeGreaterThan(0);
    expect(mcpServerVersion).not.toBe('unknown');
  });
});
