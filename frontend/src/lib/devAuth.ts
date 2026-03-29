/** Dev-only session cookie (replaces Auth0 until you wire it back). */
export const DEV_SESSION_COOKIE = "desk_dev_session";
export const DEV_SESSION_VALUE = "1";

export function isDevSessionValue(v: string | undefined): boolean {
  return v === DEV_SESSION_VALUE;
}
