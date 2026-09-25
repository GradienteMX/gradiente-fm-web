/**
 * The development preview: with `GRADIENTE_DEV_OPEN=1` in
 * `.env.development.local`, `next dev` lets anonymous requests through the
 * invite gate (proxy.ts) and the root layout serves the public world with
 * nobody signed in — the real data can be looked at without an account.
 *
 * Impossible in production twice over: NODE_ENV is inlined as 'production'
 * at build time, so this is constant-false there whatever the variable says;
 * and the variable only lives in a gitignored development env file.
 */
export function isDevOpen(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.GRADIENTE_DEV_OPEN === '1'
}
