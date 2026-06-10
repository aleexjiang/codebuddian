/**
 * CodeBuddy Chat Runtime — Agent SDK implementation
 *
 * Uses @tencent-ai/agent-sdk to communicate with CodeBuddy CLI,
 * mirroring Claudian's ClaudeChatRuntime architecture:
 *
 * - Persistent session for active chat (createSession / resumeSession)
 * - Cold-start query for inline edit, title generation
 * - Dynamic model/permission mode/effect updates via SDK control requests
 * - canUseTool callback for permission handling
 * - Streaming via AsyncGenerator<Message>
 */

import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type { StartOptions, SessionHandle, RuntimeStatus } from '../../../core/runtime/types';
import type { ProviderDescriptor, UserInput, SessionEvent, PermissionMode } from '../../../core/types';
import type { CodebuddianSettings } from '../../../core/types/settings';
import type { ApprovalManager } from '../../../core/security/ApprovalManager';
import {
  unstable_v2_createSession as createSdkSession,
  unstable_v2_resumeSession as resumeSdkSession,
  query,
  type Session,
  type Message,
  type AssistantMessage,
  type PartialAssistantMessage,
  type ResultMessage,
  type SystemMessage,
  type ToolProgressMessage,
  type TopicMessage,
  type AiTitleMessage,
  type CanUseTool,
  type PermissionResult,
  type PermissionMode as SDKPermissionMode,
  type Options,
  type SessionOptions,
} from '@tencent-ai/agent-sdk';
import { CODEBUDDY_PROVIDER } from '../index';
import type { CodebuddyProviderState } from '../types';
import { logger } from '../../../utils/logger';

// ---------------------------------------------------------------------------
// SDK PermissionMode → our PermissionMode mapping
// ---------------------------------------------------------------------------
function toSDKPermissionMode(mode?: PermissionMode): SDKPermissionMode | undefined {
  switch (mode) {
    case 'default': return 'default';
    case 'acceptEdits': return 'acceptEdits';
    case 'bypassPermissions': return 'bypassPermissions';
    case 'plan': return 'plan';
    default: return undefined;
  }
}

// ---------------------------------------------------------------------------
// CodebuddyChatRuntime
// ---------------------------------------------------------------------------
export class CodebuddyChatRuntime implements ChatRuntime {
  readonly descriptor: ProviderDescriptor = CODEBUDDY_PROVIDER;
  private settings: CodebuddianSettings;
  private approvalManager: ApprovalManager;
  private vaultPath: string;

  private currentSessionHandle: SdkSessionHandle | null = null;
  private state: CodebuddyProviderState;

  constructor(settings: CodebuddianSettings, approvalManager: ApprovalManager, vaultPath: string) {
    this.settings = settings;
    this.approvalManager = approvalManager;
    this.vaultPath = vaultPath;
    this.state = {
      cliPath: '',
      cliVersion: '',
      isInstalled: false,
      model: settings.model,
      sessionId: null,
    };
  }

  async start(opts: StartOptions): Promise<SessionHandle> {
    const sessionOpts = this.buildSessionOptions(opts);
    const canUseTool = this.createCanUseTool();

    sessionOpts.canUseTool = canUseTool;

    let sdkSession: Session;
    if (opts.resume) {
      logger.debug(`[Runtime] Resuming session: ${opts.resume}`);
      sdkSession = resumeSdkSession(opts.resume, sessionOpts);
    } else {
      logger.debug(`[Runtime] Creating new session`);
      sdkSession = createSdkSession(sessionOpts);
    }

    // Connect the session (spawns CLI subprocess)
    await sdkSession.connect();

    const sessionId = sdkSession.sessionId;
    this.state.sessionId = sessionId;

    this.currentSessionHandle = new SdkSessionHandle(sessionId, sdkSession, this);
    logger.info(`[Runtime] Session started: ${sessionId}`);

    return this.currentSessionHandle;
  }

  getActiveSession(): SessionHandle | null {
    return this.currentSessionHandle;
  }

  getState(): CodebuddyProviderState {
    return { ...this.state };
  }

  async dispose(): Promise<void> {
    if (this.currentSessionHandle) {
      await this.currentSessionHandle.close();
      this.currentSessionHandle = null;
    }
  }

  // -------------------------------------------------------------------------
  // Build SDK SessionOptions from our settings + start opts
  // -------------------------------------------------------------------------
  private buildSessionOptions(opts: StartOptions): SessionOptions {
    const options: SessionOptions = {
      cwd: opts.cwd || this.vaultPath,
      permissionMode: toSDKPermissionMode(opts.permissionMode || this.settings.permissionMode as PermissionMode),
      includePartialMessages: true,
      pathToCodebuddyCode: this.settings.cliPath || undefined,
      settingSources: ['user'],
    };

    // Set stderr callback via the query() Options type (SessionOptions doesn't have it)
    // Instead, we'll rely on the SDK's built-in logging

    if (opts.model || this.settings.model) {
      options.model = opts.model || this.settings.model;
    }

    if (opts.effort || this.settings.effort) {
      options.effort = (opts.effort || this.settings.effort) as 'low' | 'medium' | 'high' | 'xhigh';
    }

    if (opts.maxTurns || this.settings.maxTurns) {
      options.maxTurns = opts.maxTurns || this.settings.maxTurns;
    }

    if (this.settings.systemPromptFile) {
      options.systemPrompt = { append: this.settings.systemPromptFile };
    }

    if (this.settings.appendSystemPrompt) {
      options.systemPrompt = options.systemPrompt
        ? { append: `${(options.systemPrompt as { append: string }).append}\n${this.settings.appendSystemPrompt}` }
        : { append: this.settings.appendSystemPrompt };
    }

    if (opts.addDirs && opts.addDirs.length > 0) {
      // Handled via additionalDirectories in query() or setConfig
    }

    return options;
  }

  // -------------------------------------------------------------------------
  // canUseTool — delegate to ApprovalManager
  // -------------------------------------------------------------------------
  private createCanUseTool(): CanUseTool {
    return async (toolName: string, input: Record<string, unknown>, options): Promise<PermissionResult> => {
      logger.debug(`[canUseTool] ${toolName}`);

      const result = await this.approvalManager.requestApproval({
        id: options.toolUseID || `tool-${Date.now()}`,
        tool: toolName,
        args: input,
        description: `Allow ${toolName} to execute?`,
        riskLevel: this.assessRisk(toolName),
      });

      if (result.approved) {
        return {
          behavior: 'allow',
          updatedInput: result.modifiedArgs,
          toolUseID: options.toolUseID,
        };
      } else {
        return {
          behavior: 'deny',
          message: 'User denied this tool call',
          toolUseID: options.toolUseID,
        };
      }
    };
  }

  private assessRisk(tool?: string): 'low' | 'medium' | 'high' {
    if (!tool) return 'medium';
    const highRisk = ['Bash', 'Write', 'Edit'];
    const mediumRisk = ['WebFetch', 'WebSearch', 'ImageGen'];
    if (highRisk.includes(tool)) return 'high';
    if (mediumRisk.includes(tool)) return 'medium';
    return 'low';
  }
}

// ---------------------------------------------------------------------------
// SdkSessionHandle — wraps the SDK Session
// ---------------------------------------------------------------------------
class SdkSessionHandle implements SessionHandle {
  private _status: RuntimeStatus = 'running';
  private eventListeners = new Map<string, Set<(e: SessionEvent) => void>>();
  private consumerRunning = false;
  private consumerPromise: Promise<void> | null = null;
  private abortController = new AbortController();

  constructor(
    public readonly sessionId: string,
    private sdkSession: Session,
    private runtime: CodebuddyChatRuntime,
  ) {}

  get status(): RuntimeStatus {
    return this._status;
  }

  async send(input: UserInput): Promise<void> {
    this._status = 'running';

    // Build user message content
    const messageText = input.text;

    await this.sdkSession.send(messageText);

    // Start consuming messages if not already running
    this.ensureConsumer();
  }

  async cancel(): Promise<void> {
    this.abortController.abort();
    try {
      await this.sdkSession.interrupt();
    } catch (e) {
      logger.warn('[Session] Interrupt failed:', e);
    }
    this._status = 'idle';
  }

  async resume(sessionId: string): Promise<void> {
    // Resume is handled at the runtime level (creating a new runtime with resumeSession)
    this._status = 'running';
  }

  async fork(): Promise<string> {
    // Fork creates a new session from the current point
    // This is handled by creating a new runtime with resumeSession + fork
    return `cb-fork-${Date.now()}`;
  }

  async rewind(): Promise<void> {
    // Rewind support — for now, no-op
    // Could be implemented via session/resume with a specific message ID
  }

  on(evt: string, cb: (e: SessionEvent) => void): () => void {
    if (!this.eventListeners.has(evt)) {
      this.eventListeners.set(evt, new Set());
    }
    this.eventListeners.get(evt)!.add(cb);
    return () => {
      this.eventListeners.get(evt)?.delete(cb);
    };
  }

  async close(): Promise<void> {
    this.abortController.abort();
    try {
      this.sdkSession.close();
    } catch (e) {
      // Ignore close errors
    }
    this._status = 'idle';
    this.eventListeners.clear();
  }

  // -------------------------------------------------------------------------
  // Message consumer — reads from SDK session stream and emits events
  // -------------------------------------------------------------------------
  private ensureConsumer(): void {
    if (this.consumerRunning) return;
    this.consumerRunning = true;
    this.consumerPromise = this.consumeMessages();
  }

  private async consumeMessages(): Promise<void> {
    try {
      const stream = this.sdkSession.stream();

      for await (const msg of stream) {
        if (this.abortController.signal.aborted) break;

        this.handleSDKMessage(msg);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes('abort')) {
        // Normal cancellation
      } else {
        logger.error('[Session] Consumer error:', e);
        this.emit('error', { type: 'error', data: { error: e }, timestamp: Date.now() });
      }
    } finally {
      this.consumerRunning = false;
      this._status = 'idle';
    }
  }

  private handleSDKMessage(msg: Message): void {
    const now = Date.now();

    switch (msg.type) {
      case 'system': {
        const sys = msg as SystemMessage;
        logger.debug(`[Session] System init: model=${sys.model}, session=${sys.session_id}`);

        // Update runtime state with session info
        if (sys.model) {
          this.runtime.getState().model = sys.model;
        }

        this.emit('message', {
          type: 'message',
          data: {
            role: 'system',
            content: `Session initialized (model: ${sys.model}, mode: ${sys.permissionMode})`,
            sessionId: sys.session_id,
          },
          timestamp: now,
        });
        break;
      }

      case 'assistant': {
        const asst = msg as AssistantMessage;
        // Full assistant message (non-streaming or final)

        let text = '';
        const toolCalls: Array<{ id: string; tool: string; args: Record<string, unknown>; status: string }> = [];

        for (const block of asst.message.content) {
          if (block.type === 'text') {
            text += block.text;
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              tool: block.name,
              args: block.input,
              status: 'completed',
            });
          }
        }

        this.emit('message', {
          type: 'message',
          data: {
            role: 'assistant',
            content: text,
            toolCalls,
            isStreaming: false,
          },
          timestamp: now,
        });
        break;
      }

      case 'stream_event': {
        // Partial/streaming assistant message
        const partial = msg as PartialAssistantMessage;
        const event = partial.event;

        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            this.emit('message', {
              type: 'message',
              data: {
                role: 'assistant',
                content: delta.text,
                isStreaming: true,
              },
              timestamp: now,
            });
          } else if (delta.type === 'input_json_delta') {
            // Tool call input streaming
            this.emit('tool_use', {
              type: 'tool_use',
              data: {
                streaming: true,
                partialJson: delta.partial_json,
                index: event.index,
              },
              timestamp: now,
            });
          } else if (delta.type === 'thinking_delta') {
            this.emit('thinking', {
              type: 'thinking',
              data: { content: delta.thinking },
              timestamp: now,
            });
          }
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            this.emit('tool_use', {
              type: 'tool_use',
              data: {
                id: event.content_block.id,
                tool: event.content_block.name,
                args: event.content_block.input,
                status: 'pending',
                isStreaming: true,
              },
              timestamp: now,
            });
          } else if (event.content_block.type === 'thinking') {
            this.emit('thinking', {
              type: 'thinking',
              data: { content: event.content_block.thinking },
              timestamp: now,
            });
          }
        } else if (event.type === 'message_delta') {
          // End of message — stop reason
          if (event.delta?.stop_reason === 'tool_use') {
            // Agent is about to use a tool, will get more events
          }
        }
        break;
      }

      case 'result': {
        const result = msg as ResultMessage;
        if (result.subtype === 'success') {
          this.emit('turn_end', {
            type: 'turn_end',
            data: {
              result: result.result,
              cost: result.total_cost_usd,
              turns: result.num_turns,
            },
            timestamp: now,
          });
        } else {
          this.emit('error', {
            type: 'error',
            data: {
              errors: result.errors || ['Unknown error during execution'],
            },
            timestamp: now,
          });
        }
        this._status = 'idle';
        break;
      }

      case 'error': {
        const err = msg as Extract<Message, { type: 'error' }>;
        this.emit('error', {
          type: 'error',
          data: { error: err.error },
          timestamp: now,
        });
        break;
      }

      case 'tool_progress': {
        const prog = msg as ToolProgressMessage;
        this.emit('tool_use', {
          type: 'tool_use',
          data: {
            toolUseId: prog.tool_use_id,
            tool: prog.tool_name,
            status: 'running',
            elapsedSeconds: prog.elapsed_time_seconds,
          },
          timestamp: now,
        });
        break;
      }

      case 'topic': {
        const topic = msg as TopicMessage;
        this.emit('message', {
          type: 'message',
          data: { role: 'system', content: `Topic: ${topic.topic}` },
          timestamp: now,
        });
        break;
      }

      case 'ai-title': {
        const title = msg as AiTitleMessage;
        this.emit('message', {
          type: 'message',
          data: { role: 'system', content: `Title: ${title.aiTitle}`, aiTitle: title.aiTitle },
          timestamp: now,
        });
        break;
      }

      default:
        // Ignore unknown message types
        logger.debug(`[Session] Unhandled message type: ${(msg as any).type}`);
    }
  }

  private emit(evt: string, event: SessionEvent): void {
    const listeners = this.eventListeners.get(evt);
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb(event);
        } catch (e) {
          logger.error('[Session] Event listener error:', e);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cold-start query — for inline edit, title generation, etc.
// ---------------------------------------------------------------------------
export async function coldStartQuery(
  prompt: string,
  options: Options,
): Promise<string> {
  let result = '';
  const q = query({ prompt, options });

  for await (const msg of q) {
    if (msg.type === 'assistant') {
      const asst = msg as AssistantMessage;
      for (const block of asst.message.content) {
        if (block.type === 'text') {
          result += block.text;
        }
      }
    } else if (msg.type === 'result') {
      const r = msg as ResultMessage;
      if (r.subtype === 'success' && r.result) {
        result = r.result;
      }
    }
  }

  return result;
}
