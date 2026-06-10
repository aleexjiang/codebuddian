/**
 * Environment utilities for CodeBuddy SDK.
 * Builds environment variables for the SDK CLI subprocess.
 */

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

export function buildChildEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};

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

  return env;
}

/**
 * Get enhanced PATH including common Node.js locations.
 */
export function getEnhancedPath(): string {
  const pathEnv = process.env.PATH || '';
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const extraPaths: string[] = [];

  // Common nvm paths
  if (home) {
    // Try to find nvm node versions
    extraPaths.push(`${home}/.nvm/versions/node/v25.8.1/bin`);
    extraPaths.push(`${home}/.nvm/versions/node/v22.22.2/bin`);
    extraPaths.push(`${home}/.nvm/versions/node/v20.19.0/bin`);
  }

  // Common global paths
  extraPaths.push('/usr/local/bin');

  // Merge, removing duplicates
  const existingPaths = new Set(pathEnv.split(':'));
  const newPaths = extraPaths.filter(p => !existingPaths.has(p));

  return [...newPaths, pathEnv].join(':');
}
