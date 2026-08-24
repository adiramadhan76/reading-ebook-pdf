export function createFileKey(file) {
  if (!file) return null;
  return [file.name, file.size, file.lastModified].join(':');
}
