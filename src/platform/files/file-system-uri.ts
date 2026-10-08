const URI_SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:/;

/**
 * Expo SQLite returns native database paths as absolute filesystem paths, while
 * Expo FileSystem's File and Directory classes require URI-shaped paths.
 */
export function toFileSystemUri(path: string): string {
  if (URI_SCHEME.test(path) || !path.startsWith('/')) return path;
  return `file://${path}`;
}
