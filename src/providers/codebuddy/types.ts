export interface CodebuddyProviderState {
  cliPath: string;
  cliVersion: string;
  isInstalled: boolean;
  model: string;
  sessionId: string | null;
  accountInfo?: {
    userId?: string;
    userName?: string;
    userNickname?: string;
  };
}
