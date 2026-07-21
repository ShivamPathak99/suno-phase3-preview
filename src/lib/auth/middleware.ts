import { safeNextPath } from "./redirects";

export function isPublicAppPath(pathname: string) {
  return pathname === "/login" || pathname === "/why";
}

export function loginRedirectPath(pathname: string, search = "") {
  return `/login?next=${encodeURIComponent(safeNextPath(pathname + search))}`;
}
