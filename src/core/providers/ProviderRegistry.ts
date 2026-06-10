import type { ProviderDescriptor } from '../types';
import type { ChatRuntime } from '../runtime/ChatRuntime';

export class ProviderRegistry {
  private providers = new Map<string, {
    descriptor: ProviderDescriptor;
    factory: () => ChatRuntime;
  }>();
  private instances = new Map<string, ChatRuntime>();
  private activeProviderId: string | null = null;

  register(descriptor: ProviderDescriptor, factory: () => ChatRuntime): void {
    this.providers.set(descriptor.id, { descriptor, factory });
    if (!this.activeProviderId) {
      this.activeProviderId = descriptor.id;
    }
  }

  get(id: string): ChatRuntime | undefined {
    if (!this.instances.has(id)) {
      const entry = this.providers.get(id);
      if (entry) {
        this.instances.set(id, entry.factory());
      }
    }
    return this.instances.get(id);
  }

  getDescriptor(id: string): ProviderDescriptor | undefined {
    return this.providers.get(id)?.descriptor;
  }

  getAllDescriptors(): ProviderDescriptor[] {
    return Array.from(this.providers.values()).map(e => e.descriptor);
  }

  getActive(): ChatRuntime | null {
    return this.activeProviderId ? this.get(this.activeProviderId) ?? null : null;
  }

  getActiveId(): string | null {
    return this.activeProviderId;
  }

  setActive(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider not found: ${id}`);
    }
    this.activeProviderId = id;
  }

  async disposeAll(): Promise<void> {
    for (const runtime of this.instances.values()) {
      await runtime.dispose();
    }
    this.instances.clear();
  }
}
