import type { UserInput } from '../../core/types';

export function encodeUserMessage(input: UserInput): string {
  const parts: string[] = [];

  if (input.instruction) {
    parts.push(`<instruction>${input.instruction}</instruction>`);
  }

  if (input.mentions && input.mentions.length > 0) {
    const mentionStr = input.mentions
      .map(m => {
        switch (m.type) {
          case 'file': return `@${m.ref}`;
          case 'mcp': return `@mcp:${m.ref}`;
          case 'agent': return `@agent:${m.ref}`;
          case 'extDir': return `@dir:${m.ref}`;
          default: return `@${m.ref}`;
        }
      })
      .join(' ');
    parts.push(mentionStr);
  }

  parts.push(input.text);

  return parts.join('\n');
}
