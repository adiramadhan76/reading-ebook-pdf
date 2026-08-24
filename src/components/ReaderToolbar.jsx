import FileUploader from './FileUploader.jsx';
import { useEffect, useState } from 'react';

export default function ReaderToolbar({
  fileName,
  pageNumber,
  pageCount,
  pagePercent,
  hasSavedProgress,
  canGoPrevious,
  canGoNext,
  onFileSelected,
  onPreviousPage,
  onNextPage,
  onGoToPage,
}) {
  const [pageInput, setPageInput] = useState('1');

  useEffect(() => {
    setPageInput(String(pageNumber || 1));
  }, [pageNumber]);

  function submitPage(event) {
    event.preventDefault();
    onGoToPage(pageInput);
  }

  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-stone-950">
          {fileName || 'PDF Reader'}
        </h1>
        <p className="text-sm text-stone-500">
          {pageCount ? `Page ${pageNumber} of ${pageCount} - ${pagePercent}%` : 'Reader-focused ebook workspace'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-md border border-stone-300 bg-white">
          <button
            className="h-9 px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300"
            type="button"
            disabled={!canGoPrevious}
            onClick={onPreviousPage}
          >
            Previous
          </button>
          <button
            className="h-9 border-l border-stone-300 px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300"
            type="button"
            disabled={!canGoNext}
            onClick={onNextPage}
          >
            Next
          </button>
        </div>

        <form className="flex items-center gap-2" onSubmit={submitPage}>
          <input
            className="h-9 w-20 rounded-md border border-stone-300 px-3 text-sm outline-none transition focus:border-stone-600"
            type="number"
            min="1"
            max={pageCount || 1}
            value={pageInput}
            disabled={!pageCount}
            onChange={(event) => setPageInput(event.target.value)}
            aria-label="Go to page"
          />
          <button
            className="h-9 rounded-md border border-stone-300 px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300"
            type="submit"
            disabled={!pageCount}
          >
            Go
          </button>
        </form>

        <FileUploader
          currentFileName={fileName}
          hasSavedProgress={hasSavedProgress}
          onFileSelected={onFileSelected}
        />
      </div>
    </header>
  );
}
