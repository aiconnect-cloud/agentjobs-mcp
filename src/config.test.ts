import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('config.defaultTimezone', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reflects DEFAULT_TIMEZONE when set', async () => {
    vi.stubEnv('DEFAULT_TIMEZONE', 'America/Sao_Paulo');
    const { config } = await import('./config.js');
    expect(config.defaultTimezone).toBe('America/Sao_Paulo');
    expect(config.DEFAULT_TIMEZONE).toBe('America/Sao_Paulo');
  });

  it('falls back to UTC when DEFAULT_TIMEZONE is unset', async () => {
    vi.stubEnv('DEFAULT_TIMEZONE', '');
    const { config } = await import('./config.js');
    expect(config.defaultTimezone).toBe('UTC');
    expect(config.DEFAULT_TIMEZONE).toBe('UTC');
  });
});
