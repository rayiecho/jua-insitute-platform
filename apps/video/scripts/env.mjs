import fs from 'node:fs';

// Local CLI usage (this developer's machine) reads credentials from the
// sibling apps' .env.local files, same as always. The deployed Railway
// service has no sibling apps checked out — only apps/video itself — so
// it needs these as real environment variables instead. This helper tries
// process.env first (how Railway injects config) and only falls back to
// the local file convention when that's absent.
export function getEnvVar(name, localFilePath) {
  if (process.env[name]) return process.env[name];
  if (localFilePath && fs.existsSync(localFilePath)) {
    const content = fs.readFileSync(localFilePath, 'utf-8');
    const line = content.split('\n').find((l) => l.startsWith(name + '='));
    if (line) return line.slice(name.length + 1).trim();
  }
  throw new Error(`${name} not set (checked process.env and ${localFilePath ?? '(no local file)'})`);
}
