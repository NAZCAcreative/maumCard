const DEFAULT_ADMIN_EMAILS = ["dkpark55@gmail.com"];

export function getAdminEmails() {
  const configured = process.env.ADMIN_EMAILS?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : DEFAULT_ADMIN_EMAILS;
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export type AdminRole = "superadmin" | "admin" | "operator" | "content" | "ai" | "viewer";

export function getAdminRole(user?: { email?: string | null; app_metadata?: Record<string, unknown> | null }) {
  if (!user) return null;
  const rawRole = user.app_metadata?.admin_role;
  if (typeof rawRole === "string" && rawRole.trim()) return rawRole.trim().toLowerCase();
  return isAdminEmail(user.email) ? "superadmin" : null;
}

export function isAdminUser(user?: { email?: string | null; app_metadata?: Record<string, unknown> | null }) {
  const role = getAdminRole(user);
  return role !== null;
}

export function canManageAdminRoles(user?: { email?: string | null; app_metadata?: Record<string, unknown> | null }) {
  if (!user) return false;
  return isAdminEmail(user.email) || getAdminRole(user) === "superadmin";
}
