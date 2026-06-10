import type { ToolApprovalRequest, ToolApprovalResult } from '../types';

export type ApprovalCallback = (req: ToolApprovalRequest) => Promise<ToolApprovalResult>;

export class ApprovalManager {
  private callback: ApprovalCallback | null = null;
  private pendingApprovals = new Map<string, {
    request: ToolApprovalRequest;
    resolve: (result: ToolApprovalResult) => void;
  }>();

  setCallback(cb: ApprovalCallback): void {
    this.callback = cb;
  }

  async requestApproval(req: ToolApprovalRequest): Promise<ToolApprovalResult> {
    // Auto-approve if no callback set (shouldn't happen in production)
    if (!this.callback) {
      return { id: req.id, approved: true };
    }

    return new Promise<ToolApprovalResult>((resolve) => {
      this.pendingApprovals.set(req.id, { request: req, resolve });
      const cb = this.callback;
      if (cb) {
        cb(req).then(result => {
          this.pendingApprovals.delete(req.id);
          resolve(result);
        });
      }
    });
  }

  cancelAll(): void {
    for (const [id, { resolve }] of this.pendingApprovals) {
      resolve({ id, approved: false });
    }
    this.pendingApprovals.clear();
  }

  get pendingCount(): number {
    return this.pendingApprovals.size;
  }
}
