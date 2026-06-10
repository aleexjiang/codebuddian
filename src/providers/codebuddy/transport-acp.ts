import { ChildProcess, spawn } from 'child_process';
import { createInterface } from 'readline';
import type { AcpMessage, CodebuddyLaunchOptions } from './types';
import type { SessionEvent } from '../../core/types';
import { buildChildEnv } from './env';

type AcpEventHandler = (event: SessionEvent) => void;

export class AcpTransport {
  private process: ChildProcess | null = null;
  private handlers: Map<string, Set<AcpEventHandler>> = new Map();
  private msgIdCounter = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (result: unknown) => void;
    reject: (err: Error) => void;
  }>();
  private buffer = '';
  private _isRunning = false;

  get isRunning(): boolean {
    return this._isRunning;
  }

  async start(cliPath: string, opts: CodebuddyLaunchOptions): Promise<void> {
    if (this.process) {
      await this.stop();
    }

    const args = this.buildArgs(opts);
    const env = buildChildEnv(opts);

    this.process = spawn(cliPath, args, {
      cwd: opts.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this._isRunning = true;

    this.process.on('error', (err) => {
      this._isRunning = false;
      this.emit('error', { type: 'error', data: err.message, timestamp: Date.now() });
    });

    this.process.on('exit', (code) => {
      this._isRunning = false;
      this.emit('end', { type: 'end', data: { exitCode: code }, timestamp: Date.now() });
    });

    // Parse ndJSON from stdout
    const rl = createInterface({ input: this.process.stdout! });
    rl.on('line', (line: string) => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);
        this.handleMessage(msg);
      } catch (e) {
        // Not valid JSON - might be a log line, emit as raw
        this.emit('message', { type: 'message', data: { raw: line }, timestamp: Date.now() });
      }
    });

    // Log stderr
    const errRl = createInterface({ input: this.process.stderr! });
    errRl.on('line', (line: string) => {
      this.emit('error', { type: 'error', data: { stderr: line }, timestamp: Date.now() });
    });
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    this._isRunning = false;

    return new Promise((resolve) => {
      const proc = this.process!;
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, 5000);

      proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      proc.kill('SIGTERM');
      this.process = null;
    });
  }

  sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.process || !this._isRunning) {
      return Promise.reject(new Error('ACP transport not running'));
    }

    const id = ++this.msgIdCounter;
    const msg: AcpMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      const data = JSON.stringify(msg) + '\n';
      this.process!.stdin!.write(data, (err) => {
        if (err) {
          this.pendingRequests.delete(id);
          reject(err);
        }
      });
    });
  }

  sendNotification(method: string, params?: Record<string, unknown>): void {
    if (!this.process || !this._isRunning) return;

    const msg: AcpMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const data = JSON.stringify(msg) + '\n';
    this.process.stdin!.write(data);
  }

  on(evt: string, handler: AcpEventHandler): () => void {
    if (!this.handlers.has(evt)) {
      this.handlers.set(evt, new Set());
    }
    this.handlers.get(evt)!.add(handler);
    return () => this.handlers.get(evt)?.delete(handler);
  }

  private emit(evt: string, event: SessionEvent): void {
    this.handlers.get(evt)?.forEach(h => h(event));
    this.handlers.get('*')?.forEach(h => h(event));
  }

  private handleMessage(msg: AcpMessage): void {
    // Handle JSON-RPC responses
    if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!;
      this.pendingRequests.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error.message));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    // Handle notifications / events from CLI
    if (msg.method) {
      const event = this.acpMethodToEvent(msg.method, msg.params);
      if (event) {
        this.emit(event.type, event);
      }
    }
  }

  private acpMethodToEvent(method: string, params?: Record<string, unknown>): SessionEvent | null {
    const ts = Date.now();

    switch (method) {
      case 'session/update':
      case 'agent/message':
        return { type: 'message', data: params, timestamp: ts };
      case 'tool/use':
        return { type: 'tool_use', data: params, timestamp: ts };
      case 'tool/result':
        return { type: 'tool_result', data: params, timestamp: ts };
      case 'approval/request':
        return { type: 'approval', data: params, timestamp: ts };
      case 'thinking':
        return { type: 'thinking', data: params, timestamp: ts };
      case 'session/end':
        return { type: 'end', data: params, timestamp: ts };
      case 'turn/end':
        return { type: 'turn_end', data: params, timestamp: ts };
      default:
        // Unknown method — still emit as generic message
        return { type: 'message', data: { method, params }, timestamp: ts };
    }
  }

  private buildArgs(opts: CodebuddyLaunchOptions): string[] {
    const args: string[] = ['--acp', '--acp-transport', 'stdio'];

    if (opts.sessionId) args.push('--session-id', opts.sessionId);
    if (opts.resume) args.push('--resume', opts.resume);
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
    if (opts.includePartialMessages) args.push('--include-partial-messages');
    if (opts.strictMcpConfig) args.push('--strict-mcp-config');
    if (opts.debug) args.push('--debug');
    if (opts.verbose) args.push('--verbose');

    return args;
  }
}
