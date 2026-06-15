import { execFileSync } from 'child_process';

/**
 * Synchronously probe whether the Postgres database referenced by DATABASE_URL
 * accepts TCP connections.
 *
 * Integration suites use this to skip themselves (via `describe.skip`) rather
 * than fail when no database is running — e.g. on a dev machine that hasn't run
 * `docker compose up -d postgres`. When the database IS up, the suites run for
 * real against it. This keeps the default `npm test` green without infra while
 * preserving the integration tests as genuine end-to-end checks.
 *
 * The check must be synchronous because it runs at describe-collection time to
 * decide between `describe` and `describe.skip`. Node has no synchronous TCP
 * API, so we run the probe in a short-lived child `node` process via
 * execFileSync (no shell, so no cross-platform quoting issues).
 *
 * @param timeoutMs how long to wait for a connection before giving up
 * @returns true if a TCP connection to the DB host:port succeeds
 */
export function isDatabaseReachable(timeoutMs = 1000): boolean {
  if (!process.env.DATABASE_URL) return false;

  const probe = `
    const net = require('net');
    const u = new URL(process.env.DATABASE_URL);
    const s = net.connect(Number(u.port) || 5432, u.hostname, () => { s.end(); process.exit(0); });
    s.on('error', () => process.exit(1));
    s.setTimeout(${timeoutMs}, () => { s.destroy(); process.exit(1); });
  `;

  try {
    execFileSync(process.execPath, ['-e', probe], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
