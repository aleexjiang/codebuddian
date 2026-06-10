import type { ChatStateManager } from '../state/ChatState';
import type { SessionEvent, ChatMessage } from '../../../core/types';

export class StreamController {
  private currentAssistantContent = '';

  constructor(private stateManager: ChatStateManager) {}

  handleEvent(tabId: string, event: SessionEvent): void {
    switch (event.type) {
      case 'message': {
        const data = event.data as { content?: string; role?: string; delta?: string };
        if (data.role === 'assistant' || data.delta) {
          // Stream token
          if (data.delta) {
            this.currentAssistantContent += data.delta;
          } else if (data.content) {
            this.currentAssistantContent = data.content;
          }
          this.stateManager.updateLastAssistantMessage(tabId, this.currentAssistantContent);
        } else if (data.role === 'user' && data.content) {
          // Echo of user message (if any)
          const userMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: data.content,
            timestamp: event.timestamp,
          };
          this.stateManager.addMessage(tabId, userMsg);
        }
        break;
      }

      case 'thinking': {
        const data = event.data as { content?: string };
        // Update thinking content on last assistant message
        const tab = this.stateManager.getActiveTab();
        if (tab) {
          const lastAssistant = [...tab.messages].reverse().find(m => m.role === 'assistant');
          if (lastAssistant) {
            lastAssistant.thinkingContent = data.content || '';
            this.stateManager.updateTab(tabId, {});
          }
        }
        break;
      }

      case 'tool_use': {
        const data = event.data as { id?: string; tool?: string; args?: Record<string, unknown> };
        if (data.id && data.tool) {
          const tab = this.stateManager.getActiveTab();
          if (tab && tab.messages.length > 0) {
            const lastMsg = tab.messages[tab.messages.length - 1];
            if (!lastMsg.toolCalls) lastMsg.toolCalls = [];
            lastMsg.toolCalls.push({
              id: data.id,
              tool: data.tool,
              args: data.args || {},
              status: 'running',
            });
            this.stateManager.updateTab(tabId, {});
          }
        }
        break;
      }

      case 'tool_result': {
        const data = event.data as { id?: string; ok?: boolean; result?: string; error?: string };
        if (data.id) {
          const tab = this.stateManager.getActiveTab();
          if (tab && tab.messages.length > 0) {
            const lastMsg = tab.messages[tab.messages.length - 1];
            if (lastMsg.toolCalls) {
              const toolCall = lastMsg.toolCalls.find(tc => tc.id === data.id);
              if (toolCall) {
                toolCall.status = data.ok ? 'completed' : 'error';
                toolCall.result = data.result;
                toolCall.error = data.error;
                this.stateManager.updateTab(tabId, {});
              }
            }
          }
        }
        break;
      }

      case 'approval': {
        this.stateManager.updateTab(tabId, { status: 'waiting_approval' });
        break;
      }

      case 'turn_end':
      case 'end': {
        if (this.currentAssistantContent) {
          this.stateManager.finalizeLastAssistantMessage(tabId);
          this.currentAssistantContent = '';
        }
        break;
      }

      case 'error': {
        const data = event.data as { message?: string; stderr?: string };
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'system',
          content: `❌ Error: ${data.message || data.stderr || 'Unknown error'}`,
          timestamp: event.timestamp,
        };
        this.stateManager.addMessage(tabId, errorMsg);
        this.stateManager.updateTab(tabId, { status: 'error' });
        break;
      }
    }
  }

  startNewTurn(): void {
    this.currentAssistantContent = '';
  }
}
