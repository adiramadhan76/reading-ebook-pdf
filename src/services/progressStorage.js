const STORAGE_KEY = 'ebook-reader:progress:v1';
const LAST_FILE_KEY = 'ebook-reader:last-file-key:v1';

export function loadAllProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function loadProgress(fileKey) {
  if (!fileKey) return null;
  return loadAllProgress()[fileKey] || null;
}

export function saveProgress(fileKey, progress) {
  if (!fileKey) return;

  const nextProgress = {
    ...loadAllProgress(),
    [fileKey]: {
      ...progress,
      updatedAt: new Date().toISOString(),
    },
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProgress));
  localStorage.setItem(LAST_FILE_KEY, fileKey);
}

export function loadLastFileKey() {
  return localStorage.getItem(LAST_FILE_KEY);
}
