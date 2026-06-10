import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type { StartOptions, SessionHandle, RuntimeStatus } from '../../../core/runtime/types';
import type { ProviderDescriptor, UserInput, SessionEvent, PermissionMode } from '../../../core/types';
import type { CodebuddianSettings } from '../../../core/types/settings';
import type { ApprovalManager } from '../../../core/security/ApprovalManager';
import { AcpTransport } from '../transport-acp';
import { CliDetector } from '../cli-detect';
import { PromptCompiler } from '../../../core/prompt/mainAgent';
import { CODEBUDDY_PROVIDER } from '../index';
import type { CodebuddyLaunchOptions, CodebuddyProviderState } from '../types';

export class CodebuddyChatRuntime implements ChatRuntime {
  readonly descriptor: ProviderDescriptor = CODEBUDDY_PROVIDER;
  private transport: AcpTransport;
  private cliDetector: CliDetector;
  private promptCompiler: PromptCompiler;
  private approvalManager: ApprovalManager;
  private settings: CodebuddianSettings;
  private currentSession: SessionHandleImpl | null = null;
  private state: CodebuddyProviderState;

  constructor(settings: CodebuddianSettings, approvalManager: ApprovalManager, vaultPath: string) {
    this.settings = settings;
    this.transport = new AcpTransport();
    this.cliDetector = new CliDetector();
    this.promptCompiler = new PromptCompiler(settings, vaultPath);
    this.approvalManager = approvalManager;
    this.state = {
      cliPath: '',
      cliVersion: '',
      isInstalled: false,
      model: settings.model,
      sessionId: null,
    };
  }

  async start(opts: StartOptions): Promise<SessionHandle> {
    const cliPath = await this.resolveCliPath();

    const launchOpts: CodebuddyLaunchOptions = {
      cwd: opts.cwd,
      sessionId: opts.sessionId,
      resume: opts.resume,
      model: opts.model || this.settings.model || undefined,
      permissionMode: opts.permissionMode || this.settings.permissionMode,
      allowedTools: opts.allowedTools || (this.settings.allowedTools.length > 0 ? this.settings.allowedTools : undefined),
      disallowedTools: opts.disallowedTools || (this.settings.disallowedTools.length > 0 ? this.settings.disallowedTools : undefined),
      systemPromptFile: opts.systemPromptFile || this.settings.systemPromptFile || undefined,
      appendSystemPrompt: opts.appendSystemPrompt || this.settings.appendSystemPrompt || undefined,
      mcpConfigPath: opts.mcpConfigPath || this.settings.mcpConfigPath || undefined,
      addDirs: opts.addDirs || (this.settings.addDirs.length > 0 ? this.settings.addDirs : undefined),
      maxTurns: opts.maxTurns || this.settings.maxTurns || undefined,
      effort: opts.effort || this.settings.effort || undefined,
      includePartialMessages: this.settings.includePartialMessages,
      strictMcpConfig: this.settings.strictMcpConfig,
      debug: this.settings.debugMode,
      verbose: this.settings.verboseMode,
    };

    await this.transport.start(cliPath, launchOpts);

    const sessionId = opts.sessionId || this.generateSessionId();
    this.state.sessionId = sessionId;

    this.currentSession = new SessionHandleImpl(
      sessionId,
      this.transport,
      this.promptCompiler,
      this.approvalManager,
    );

    // Wire up approval requests
    this.transport.on('approval', (event: SessionEvent) => {
      this.handleApprovalEvent(event);
    });

    return this.currentSession;
  }

  getActiveSession(): SessionHandle | null {
    return this.currentSession;
  }

  getState(): CodebuddyProviderState {
    return { ...this.state };
  }

  async dispose(): Promise<void> {
    await this.transport.stop();
    this.currentSession = null;
  }

  private async resolveCliPath(): Promise<string> {
    // User-configured path takes priority
    if (this.settings.cliPath) {
      return this.settings.cliPath;
    }

    if (this.settings.autoDetectCli) {
      const detected = await this.cliDetector.detect();
      if (detected) {
        this.state.cliPath = detected;
        this.state.isInstalled = true;
        this.state.cliVersion = await this.cliDetector.getVersion(detected);
        return detected;
      }
    }

    throw new Error(
      'CodeBuddy CLI not found. Please install it or set the path in Settings.\n' +
      'Install: npm install -g @tencent-ai/codebuddy-code\n' +
      'Or set the path manually in Codebuddian settings.'
    );
  }

  private async handleApprovalEvent(event: SessionEvent): Promise<void> {
    const data = event.data as { id?: string; tool?: string; args?: Record<string, unknown>; description?: string };
    if (!data.id) return;

    const result = await this.approvalManager.requestApproval({
      id: data.id,
      tool: data.tool || 'unknown',
      args: data.args || {},
      description: data.description || `Allow ${data.tool}?`,
      riskLevel: this.assessRisk(data.tool),
    });

    // Send approval response back to CLI
    this.transport.sendNotification('approval/response', {
      id: data.id,
      approved: result.approved,
      modifiedArgs: result.modifiedArgs,
    });
  }

  private assessRisk(tool?: string): 'low' | 'medium' | 'high' {
    if (!tool) return 'medium';
    const highRisk = ['Bash', 'Write', 'Edit'];
    const mediumRisk = ['WebFetch', 'WebSearch', 'ImageGen'];
    if (highRisk.includes(tool)) return 'high';
    if (mediumRisk.includes(tool)) return 'medium';
    return 'low';
  }

  private generateSessionId(): string {
    return `cb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

class SessionHandleImpl implements SessionHandle {
  private _status: RuntimeStatus = 'running';
  private unsubscribeFns: (() => void)[] = [];

  constructor(
    public readonly sessionId: string,
    private transport: AcpTransport,
    private promptCompiler: PromptCompiler,
    private approvalManager: ApprovalManager,
  ) {}

  get status(): RuntimeStatus {
    return this._status;
  }

  async send(input: UserInput): Promise<void> {
    const compiledPrompt = this.promptCompiler.compile(input);
    this.transport.sendNotification('user/message', {
      content: compiledPrompt,
      mentions: input.mentions,
      attachments: input.attachments,
      permissionMode: input.permissionMode,
    });
  }

  async cancel(): Promise<void> {
    this.transport.sendNotification('session/cancel');
    this._status = 'idle';
  }

  async resume(sessionId: string): Promise<void> {
    this.transport.sendNotification('session/resume', { sessionId });
    this._status = 'running';
  }

  async fork(): Promise<string> {
    const newId = `cb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.transport.sendNotification('session/fork', { newSessionId: newId });
    return newId;
  }

  async rewind(): Promise<void> {
    this.transport.sendNotification('session/rewind');
  }

  on(evt: string, cb: (e: SessionEvent) => void): () => void {
    const unsub = this.transport.on(evt, cb);
    this.unsubscribeFns.push(unsub);
    return unsub;
  }

  async close(): Promise<void> {
    for (const unsub of this.unsubscribeFns) {
      unsub();
    }
    this.unsubscribeFns = [];
    this._status = 'idle';
  }
}
