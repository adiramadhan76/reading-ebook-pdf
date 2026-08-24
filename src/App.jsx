import { useCallback, useEffect, useMemo, useState } from 'react';
import EmptyReader from './components/EmptyReader.jsx';
import PdfReader from './components/PdfReader.jsx';
import ReaderToolbar from './components/ReaderToolbar.jsx';
import { localLibrary } from './data/library.js';
import { useReadingProgress } from './hooks/useReadingProgress.js';
import { createFileKey } from './utils/fileKey.js';
import { loadLastFileKey } from './services/progressStorage.js';

const defaultReaderState = {
  pageNumber: 1,
  pageCount: 0,
  pageScrollRatio: 0,
};

export default function App() {
  const [file, setFile] = useState(localLibrary.currentFile);
  const [readerState, setReaderState] = useState(defaultReaderState);
  const [pageCommand, setPageCommand] = useState(null);
  const fileKey = useMemo(() => createFileKey(file), [file]);
  const { progress, rememberProgress } = useReadingProgress(fileKey);
  const pageCount = readerState.pageCount;
  const pageNumber = readerState.pageNumber;
  const pagePercent = Math.round((readerState.pageScrollRatio || 0) * 100);
  const hasSavedProgress = Boolean(loadLastFileKey());

  useEffect(() => {
    setReaderState({
      pageNumber: progress?.pageNumber || 1,
      pageCount: progress?.pageCount || 0,
      pageScrollRatio: progress?.pageScrollRatio || 0,
    });
  }, [fileKey, progress?.pageNumber, progress?.pageCount, progress?.pageScrollRatio]);

  const handleFileSelected = useCallback((nextFile) => {
    localLibrary.currentFile = nextFile;
    // A command belongs to the document that issued it. Keeping it would make
    // the newly mounted reader jump to a page from the previous PDF.
    setPageCommand(null);
    setReaderState(defaultReaderState);
    setFile(nextFile);
  }, []);

  const handleProgressChange = useCallback((nextProgress) => {
    setReaderState({
      pageNumber: nextProgress.pageNumber || 1,
      pageCount: nextProgress.pageCount || 0,
      pageScrollRatio: nextProgress.pageScrollRatio || 0,
    });
    rememberProgress(nextProgress);
  }, [rememberProgress]);

  const requestPage = useCallback((page) => {
    const targetPage = Math.min(Math.max(Number(page) || 1, 1), pageCount || 1);
    setPageCommand({ pageNumber: targetPage, id: Date.now() });
  }, [pageCount]);

  return (
    <div className="flex h-screen flex-col bg-stone-100 font-reader text-stone-900">
      <ReaderToolbar
        fileName={file?.name}
        pageNumber={pageNumber}
        pageCount={pageCount}
        pagePercent={pagePercent}
        hasSavedProgress={hasSavedProgress}
        canGoPrevious={pageNumber > 1}
        canGoNext={Boolean(pageCount) && pageNumber < pageCount}
        onFileSelected={handleFileSelected}
        onPreviousPage={() => requestPage(pageNumber - 1)}
        onNextPage={() => requestPage(pageNumber + 1)}
        onGoToPage={requestPage}
      />

      <section className="min-h-0 flex-1">
        {file ? (
          <PdfReader
            key={fileKey}
            file={file}
            savedProgress={progress}
            pageCommand={pageCommand}
            onProgressChange={handleProgressChange}
          />
        ) : (
          <EmptyReader hasSavedProgress={hasSavedProgress} />
        )}
      </section>
    </div>
  );
}
