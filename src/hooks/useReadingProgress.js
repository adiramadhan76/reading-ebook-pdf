import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadLastFileKey, loadProgress, saveProgress } from '../services/progressStorage';

const SAVE_DELAY = 250;

export function useReadingProgress(fileKey) {
  const [state, setState] = useState({ fileKey, progress: loadProgress(fileKey) });
  const saveTimer = useRef(null);

  useEffect(() => {
    setState({ fileKey, progress: loadProgress(fileKey) });
  }, [fileKey]);

  useEffect(() => {
    return () => window.clearTimeout(saveTimer.current);
  }, []);

  const rememberProgress = useCallback(
    (nextProgress) => {
      if (!fileKey) return;

      setState({ fileKey, progress: nextProgress });
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveProgress(fileKey, nextProgress);
      }, SAVE_DELAY);
    },
    [fileKey],
  );

  return useMemo(
    () => ({
      progress: state.fileKey === fileKey ? state.progress : loadProgress(fileKey),
      rememberProgress,
      lastFileKey: loadLastFileKey(),
    }),
    [fileKey, state, rememberProgress],
  );
}
