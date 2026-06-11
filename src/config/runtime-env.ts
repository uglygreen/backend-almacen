import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

let loaded = false;

export function loadRuntimeEnv() {
  if (loaded) {
    return;
  }

  const cwd = process.cwd();
  const execDir = (process as any).pkg ? path.dirname(process.execPath) : cwd;
  const candidates = uniquePaths([
    path.join(execDir, '.env'),
    path.join(execDir, '.env.production'),
    path.join(cwd, '.env'),
    path.join(cwd, '.env.production'),
  ]);

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    dotenv.config({
      path: filePath,
      override: false,
    });
  }

  loaded = true;
}

export function envString(key: string, defaultValue = ''): string {
  const value = process.env[key];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return value;
}

export function envNumber(key: string, defaultValue: number): number {
  const value = envString(key, `${defaultValue}`);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function envBoolean(key: string, defaultValue = false): boolean {
  const value = envString(key, defaultValue ? 'true' : 'false').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function uniquePaths(values: string[]) {
  return [...new Set(values)];
}
