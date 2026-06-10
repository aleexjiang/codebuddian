export interface AgentDescriptor {
  name: string;
  description: string;
  prompt: string;
}

export interface AgentConfig {
  agents: Record<string, AgentDescriptor>;
}
