/**
 * Dev-only switch to short-circuit the auth gate. Set
 *   NEXT_PUBLIC_DISABLE_AUTH=true
 * in .env.local to bypass login during development. Leave it unset (or
 * `false`) in production.
 *
 * When this is true:
 * - The proxy/middleware skips the user check and does not redirect.
 * - The (app) layout renders a placeholder email in the sidebar.
 * - Mutations that would stamp `created_by`/`edited_by` with the auth user
 *   send `null` instead.
 */
export const AUTH_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

export const DEV_USER_EMAIL = "dev@local";
