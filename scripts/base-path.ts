// BASE_PATH: the folder the site is served from ("/" at the domain root, "/for-fun/guru/" in a sub-folder).
// It sets Vite's `base` and React Router's `basename`.
export function basePath(): string {
  const raw = process.env.BASE_PATH || "/";
  const withLead = raw.startsWith("/") ? raw : `/${raw}`;
  return withLead.endsWith("/") ? withLead : `${withLead}/`;
}
