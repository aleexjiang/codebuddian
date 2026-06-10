import type { CodebuddyLaunchOptions } from './types';

const ENV_PASSTHROUGH = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'NODE_EXTRA_CA_CERTS',
  'NODE_OPTIONS',
  'LANG',
  'TERM',
  'SHELL',
  'TMPDIR',
  'TEMP',
  'TMP',
];

export function buildChildEnv(opts: CodebuddyLaunchOptions): NodeJS.ProcessEnv {
  const env: Record<string, string> = {};

  // Pass through essential env vars
  for (const key of ENV_PASSTHROUGH) {
    const val = process.env[key];
    if (val !== undefined) {
      env[key] = val;
    }
  }

  // Pass through any CODEBUDDY_* or WORKBUDDY_* vars
  for (const [key, val] of Object.entries(process.env)) {
    if ((key.startsWith('CODEBUDDY_') || key.startsWith('WORKBUDDY_')) && val !== undefined) {
      env[key] = val;
    }
  }

  return env as NodeJS.ProcessEnv;
}
