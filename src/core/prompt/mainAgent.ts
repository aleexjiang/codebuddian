import type { UserInput, Mention } from '../types';
import type { CodebuddianSettings } from '../types/settings';

export class PromptCompiler {
  constructor(private settings: CodebuddianSettings, private vaultPath: string) {}

  compile(input: UserInput): string {
    const parts: string[] = [];

    // Append system prompt if configured
    if (this.settings.appendSystemPrompt) {
      parts.push(this.settings.appendSystemPrompt);
    }

    // Append instruction mode (#)
    if (input.instruction) {
      parts.push(`\n[Instruction]: ${input.instruction}`);
    }

    // Process @mentions - resolve file references
    if (input.mentions && input.mentions.length > 0) {
      const mentionParts: string[] = [];
      for (const mention of input.mentions) {
        mentionParts.push(this.resolveMention(mention));
      }
      if (mentionParts.length > 0) {
        parts.push(`\n[Referenced files]:\n${mentionParts.join('\n')}`);
      }
    }

    // Append the main user text
    parts.push(input.text);

    return parts.join('\n');
  }

  private resolveMention(mention: Mention): string {
    switch (mention.type) {
      case 'file':
        return `- @${mention.ref}`;
      case 'mcp':
        return `- @mcp:${mention.ref}`;
      case 'agent':
        return `- @agent:${mention.ref}`;
      case 'extDir':
        return `- @dir:${mention.ref}`;
      default:
        return `- @${mention.ref}`;
    }
  }
}
