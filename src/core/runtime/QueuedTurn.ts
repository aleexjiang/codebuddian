import type { UserInput } from '../types';

interface QueuedItem {
  input: UserInput;
  resolve: () => void;
  reject: (err: Error) => void;
}

export class QueuedTurn {
  private queue: QueuedItem[] = [];
  private processing = false;

  async enqueue(input: UserInput): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ input, resolve, reject });
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const item = this.queue.shift()!;
    try {
      // The actual processing is done by the caller who listens to events
      // Here we just manage the queue order
      item.resolve();
    } catch (err) {
      item.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.processing = false;
      this.processNext();
    }
  }

  clear(): void {
    const remaining = this.queue.splice(0);
    remaining.forEach(item => item.reject(new Error('Queue cleared')));
  }

  get isProcessing(): boolean {
    return this.processing;
  }

  get length(): number {
    return this.queue.length;
  }
}
