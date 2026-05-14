/**
 * Admin gate.
 *
 * Hardcoded allowlist of operator emails. Lives in code, not in the
 * database, because the admin set is small and changes rarely. If
 * the list grows past 2-3 people, move to a Supabase table.
 */

export const ADMIN_EMAILS: readonly string[] = [
  "tortillabarllc@gmail.com",
];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized);
}
