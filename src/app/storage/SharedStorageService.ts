import { PluginStorage } from '../../core/bootstrap/storage';

export class SharedStorageService {
  private storage: PluginStorage | null = null;

  init(vaultPath: string): void {
    this.storage = new PluginStorage(vaultPath);
  }

  get(): PluginStorage | null {
    return this.storage;
  }

  async ensureInit(): Promise<PluginStorage> {
    if (!this.storage) throw new Error('SharedStorageService not initialized');
    await this.storage.init();
    return this.storage;
  }
}
