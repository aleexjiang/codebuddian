/**
 * Custom spawn function for Obsidian/Electron environment.
 *
 * Works around two issues:
 * 1. GUI apps don't inherit shell PATH — resolve `node` to a full path
 * 2. Obsidian's Electron uses a different AbortSignal realm — don't pass
 *    `signal` to spawn(), handle abort manually instead
 *
 * Mirrors claudian's createCustomSpawnFunction pattern.
 */

import { spawn, type ChildProcess } from 'child_process';

export interface SpawnOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

export interface SpawnedProcess {
  pid?: number;
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(signal?: string | number): boolean;
}

/**
 * Find the `node` executable in common locations.
 */
function findNodeExecutable(): string | undefined {
  const pathEnv = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';

  for (const dir of pathEnv.split(sep)) {
    // Check common node paths
    const candidates = process.platform === 'win32'
      ? [`${dir}\\node.exe`]
      : [`${dir}/node`, `${dir}/node`];

    // We can't easily check file existence synchronously without fs,
    // so just return a reasonable path
    if (dir.includes('nvm') || dir.includes('node') || dir.includes('.volta')) {
      return `${dir}/node`;
    }
  }

  // Fallback: use common paths
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const commonPaths = [
    `${home}/.nvm/versions/node/v25.8.1/bin/node`,
    `${home}/.nvm/versions/node/v22.22.2/bin/node`,
    '/usr/local/bin/node',
  ];

  return commonPaths[0]; // Best guess
}

/**
 * Check if a CLI path requires running through `node`.
 */
function cliPathRequiresNode(cliPath: string): boolean {
  return cliPath.endsWith('.js') || cliPath.includes('codebuddy-code');
}

/**
 * Create a custom spawn function suitable for Obsidian/Electron.
 */
export function createCustomSpawnFunction(
  enhancedPath: string,
): (options: SpawnOptions) => SpawnedProcess {
  return (options: SpawnOptions): SpawnedProcess => {
    let { command, args } = options;
    const { cwd, env, signal } = options;

    // Resolve node paths for Electron compatibility
    if (command === 'node' || cliPathRequiresNode(command)) {
      const nodeFullPath = findNodeExecutable();

      if (command === 'node') {
        if (nodeFullPath) {
          command = nodeFullPath;
        }
      } else {
        // CLI is a Node.js script — prepend node path
        args = [command, ...args];
        command = nodeFullPath || 'node';
      }
    }

    // Do NOT pass `signal` to spawn() — Obsidian's Electron uses a different
    // AbortSignal realm that breaks Node's internal `instanceof` check.
    // Handle abort manually instead.
    const child: ChildProcess = spawn(command, args, {
      cwd,
      env: env as Record<string, string>,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    if (signal) {
      const killChild = (): void => {
        child.kill('SIGTERM');
      };
      if (signal.aborted) {
        killChild();
      } else {
        signal.addEventListener('abort', killChild, { once: true });
      }
    }

    // Ignore stderr data to prevent buffer overflow
    if (child.stderr && typeof child.stderr.on === 'function') {
      child.stderr.on('data', () => {});
    }

    if (!child.stdin || !child.stdout) {
      throw new Error('Failed to create process streams');
    }

    return child as unknown as SpawnedProcess;
  };
}
