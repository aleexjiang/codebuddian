import { ChildProcess, spawn } from 'child_process';
import { createInterface } from 'readline';
import type { CodebuddyLaunchOptions } from './types';
import { buildChildEnv } from './env';

export interface PrintTransportResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  streamEvents: object[];
}

export class PrintTransport {
  async execute(cliPath: string, prompt: string, opts: CodebuddyLaunchOptions): Promise<PrintTransportResult> {
    const args = this.buildArgs(opts, prompt);
    const env = buildChildEnv(opts);

    return new Promise((resolve) => {
      const proc = spawn(cliPath, args, {
        cwd: opts.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      const streamEvents: object[] = [];

      const outRl = createInterface({ input: proc.stdout! });
      outRl.on('line', (line: string) => {
        if (!line.trim()) return;
        stdout += line + '\n';
        // Try parse as stream-json
        try {
          streamEvents.push(JSON.parse(line));
        } catch {
          // plain text
        }
      });

      const errRl = createInterface({ input: proc.stderr! });
      errRl.on('line', (line: string) => {
        stderr += line + '\n';
      });

      proc.on('close', (code) => {
        resolve({ exitCode: code, stdout: stdout.trim(), stderr: stderr.trim(), streamEvents });
      });

      proc.on('error', (err) => {
        resolve({ exitCode: -1, stdout, stderr: stderr + err.message, streamEvents });
      });
    });
  }

  private buildArgs(opts: CodebuddyLaunchOptions, prompt: string): string[] {
    const args: string[] = ['-p', prompt, '--output-format', 'stream-json'];

    if (opts.model) args.push('--model', opts.model);
    if (opts.permissionMode) args.push('--permission-mode', opts.permissionMode);
    if (opts.systemPromptFile) args.push('--system-prompt-file', opts.systemPromptFile);
    if (opts.appendSystemPrompt) args.push('--append-system-prompt', opts.appendSystemPrompt);
    if (opts.mcpConfigPath) args.push('--mcp-config', opts.mcpConfigPath);
    if (opts.addDirs && opts.addDirs.length > 0) args.push('--add-dir', ...opts.addDirs);
    if (opts.allowedTools && opts.allowedTools.length > 0) args.push('--allowedTools', ...opts.allowedTools);
    if (opts.disallowedTools && opts.disallowedTools.length > 0) args.push('--disallowedTools', ...opts.disallowedTools);
    if (opts.maxTurns && opts.maxTurns > 0) args.push('--max-turns', String(opts.maxTurns));
    if (opts.effort) args.push('--effort', opts.effort);
    if (opts.debug) args.push('--debug');

    return args;
  }
}
