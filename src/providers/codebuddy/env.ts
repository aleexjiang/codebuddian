/**
 * Environment utilities for CodeBuddy SDK in Obsidian/Electron.
 *
 * Handles two critical issues:
 * 1. GUI apps (Obsidian) don't inherit shell PATH — node + codebuddy CLI
 *    are not findable without enriching PATH manually.
 * 2. The bundled CLI (in agent-sdk/cli/) may differ from the user's
 *    authenticated global CLI (~/.nvm/...). Auto-detect the global one
 *    when available.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const isWindows = process.platform === 'win32';
const PATH_SEPARATOR = isWindows ? ';' : ':';
const NODE_EXECUTABLE = isWindows ? 'node.exe' : 'node';
const CODEBUDDY_BINARY = isWindows ? 'codebuddy.cmd' : 'codebuddy';

const ENV_PASSTHROUGH = [
  'PATH', 'HOME', 'USERPROFILE',
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'no_proxy',
  'NODE_EXTRA_CA_CERTS', 'NODE_OPTIONS',
  'LANG', 'TERM', 'SHELL', 'TMPDIR', 'TEMP', 'TMP',
];

function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/**
 * GUI apps like Obsidian have minimal PATH, so we add common binary locations.
 */
export function getExtraBinaryPaths(): string[] {
  const home = getHomeDir();
  const paths: string[] = [];

  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA;
    const appData = process.env.APPDATA;
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

    if (appData) paths.push(path.join(appData, 'npm'));
    if (localAppData) {
      paths.push(path.join(localAppData, 'Programs', 'nodejs'));
      paths.push(path.join(localAppData, 'Programs', 'node'));
      paths.push(path.join(localAppData, 'fnm'));
    }
    paths.push(path.join(programFiles, 'nodejs'));

    if (home) {
      paths.push(path.join(home, '.local', 'bin'));
      paths.push(path.join(home, '.bun', 'bin'));
      paths.push(path.join(home, '.volta', 'bin'));
    }

    return paths;
  }

  // Unix
  paths.push('/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin');

  if (home) {
    paths.push(path.join(home, '.local', 'bin'));
    paths.push(path.join(home, '.bun', 'bin'));
    paths.push(path.join(home, '.volta', 'bin'));
    paths.push(path.join(home, '.asdf', 'shims'));

    // NVM: enumerate all installed node versions
    try {
      const nvmDir = path.join(home, '.nvm', 'versions', 'node');
      if (fs.existsSync(nvmDir)) {
        const versions = fs.readdirSync(nvmDir);
        for (const v of versions) {
          const binPath = path.join(nvmDir, v, 'bin');
          if (fs.existsSync(binPath)) {
            paths.unshift(binPath); // Prefer NVM versions
          }
        }
      }
    } catch {
      // ignore
    }

    const nvmBin = process.env.NVM_BIN;
    if (nvmBin) paths.push(nvmBin);
  }

  return paths;
}

/** Find a binary in a list of directories. */
function findInPaths(name: string, dirs: string[]): string | null {
  for (const dir of dirs) {
    if (!dir) continue;
    try {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) {
        const stat = fs.statSync(full);
        if (stat.isFile()) return full;
        // Could be a symlink to a file
        if (stat.isSymbolicLink()) {
          try {
            const real = fs.realpathSync(full);
            if (fs.statSync(real).isFile()) return full;
          } catch {/*ignore*/}
        }
      }
    } catch {
      // unreachable dir
    }
  }
  return null;
}

/** Find the absolute path to `node`, including in nvm/asdf/etc. */
export function findNodeExecutable(): string | null {
  const allDirs = [...getExtraBinaryPaths(), ...parsePath(process.env.PATH || '')];
  return findInPaths(NODE_EXECUTABLE, allDirs);
}

/** Find the absolute path to the user's globally installed `codebuddy` binary. */
export function findCodebuddyExecutable(): string | null {
  const allDirs = [...getExtraBinaryPaths(), ...parsePath(process.env.PATH || '')];
  return findInPaths(CODEBUDDY_BINARY, allDirs);
}

function parsePath(pathStr: string): string[] {
  return pathStr.split(PATH_SEPARATOR).filter(p => p.length > 0);
}

/**
 * Build an enriched PATH that includes node + codebuddy locations.
 */
export function getEnhancedPath(): string {
  const extraPaths = getExtraBinaryPaths();
  const currentPath = process.env.PATH || '';
  const segments = [...extraPaths, ...parsePath(currentPath)];

  // Dedupe
  const seen = new Set<string>();
  const unique = segments.filter(p => {
    const norm = isWindows ? p.toLowerCase() : p;
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });

  return unique.join(PATH_SEPARATOR);
}

/**
 * Build environment variables for the SDK CLI subprocess.
 * Includes enriched PATH so node/codebuddy can be found.
 */
export function buildChildEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};

  for (const key of ENV_PASSTHROUGH) {
    const val = process.env[key];
    if (val !== undefined) env[key] = val;
  }

  for (const [key, val] of Object.entries(process.env)) {
    if ((key.startsWith('CODEBUDDY_') || key.startsWith('WORKBUDDY_')) && val !== undefined) {
      env[key] = val;
    }
  }

  // Enriched PATH (overrides above)
  env.PATH = getEnhancedPath();

  return env;
}
