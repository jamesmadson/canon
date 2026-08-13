const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix an absolute site path with the configured base. Pass paths starting with "/". */
export function withBase(path: string): string {
  return `${base}${path}`;
}
