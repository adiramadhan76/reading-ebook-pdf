import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import PdfPage from './PdfPage.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const DEFAULT_SCALE = 1;

export default function PdfReader({ file, savedProgress, pageCommand, onProgressChange }) {
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const containerRef = useRef(null);
  const pageRefs = useRef(new Map());
  const restoredRef = useRef(false);
  const trackingReadyRef = useRef(false);
  const latestProgressRef = useRef({
    pageNumber: savedProgress?.pageNumber || 1,
    pageScrollRatio: savedProgress?.pageScrollRatio || 0,
    zoomScale: DEFAULT_SCALE,
  });

  const scrollToPage = useCallback((targetPage, pageScrollRatio = 0, behavior = 'smooth') => {
    const pageElement = pageRefs.current.get(targetPage);
    const container = containerRef.current;

    if (!pageElement || !container) return false;

    const offset = pageElement.offsetTop + pageElement.offsetHeight * pageScrollRatio;
    container.scrollTo({ top: Math.max(offset - 24, 0), behavior });
    return true;
  }, []);

  const saveCurrentSnapshot = useCallback(
    (overrides = {}) => {
      if (!pdf || !containerRef.current) return;

      const container = containerRef.current;
      const snapshot = {
        pageNumber: latestProgressRef.current.pageNumber || 1,
        pageScrollRatio: latestProgressRef.current.pageScrollRatio || 0,
        scrollTop: container.scrollTop,
        totalScroll: container.scrollHeight - container.clientHeight,
        pageCount: pdf.numPages,
        zoomScale: scale,
        ...overrides,
      };

      latestProgressRef.current = {
        pageNumber: snapshot.pageNumber,
        pageScrollRatio: snapshot.pageScrollRatio,
        zoomScale: snapshot.zoomScale,
      };

      onProgressChange(snapshot);
    },
    [pdf, scale, onProgressChange],
  );

  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;

    async function openPdf() {
      setError('');
      setPdf(null);
      pageRefs.current.clear();
      restoredRef.current = false;
      trackingReadyRef.current = false;
      latestProgressRef.current = {
        pageNumber: savedProgress?.pageNumber || 1,
        pageScrollRatio: savedProgress?.pageScrollRatio || 0,
        zoomScale: DEFAULT_SCALE,
      };
      setScale(DEFAULT_SCALE);

      const buffer = await file.arrayBuffer();
      loadingTask = pdfjsLib.getDocument({ data: buffer });
      const loadedPdf = await loadingTask.promise;

      if (!cancelled) setPdf(loadedPdf);
    }

    openPdf().catch(() => {
      if (!cancelled) setError('Unable to open this PDF.');
    });

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [file]);

  const registerPage = useCallback((pageNumber, element) => {
    if (element) pageRefs.current.set(pageNumber, element);
  }, []);

  const pageNumbers = useMemo(() => {
    if (!pdf?.numPages) return [];
    return Array.from({ length: pdf.numPages }, (_, index) => index + 1);
  }, [pdf]);

  useEffect(() => {
    if (!pdf || restoredRef.current) return;

    if (!savedProgress) {
      restoredRef.current = true;
      trackingReadyRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      const targetPage = Math.min(savedProgress.pageNumber || 1, pdf.numPages);

      if (!scrollToPage(targetPage, savedProgress.pageScrollRatio || 0, 'auto')) return;
      restoredRef.current = true;
      trackingReadyRef.current = true;
    }, 450);

    return () => window.clearTimeout(timer);
  }, [pdf, savedProgress, scale, scrollToPage]);

  useEffect(() => {
    if (!pdf || !pageCommand) return;

    const targetPage = Math.min(Math.max(pageCommand.pageNumber, 1), pdf.numPages);
    trackingReadyRef.current = true;
    scrollToPage(targetPage, 0, 'smooth');
  }, [pdf, pageCommand, scrollToPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdf) return;

    const onScroll = () => {
      if (!trackingReadyRef.current) return;

      const containerTop = container.getBoundingClientRect().top;
      let currentPage = 1;
      let pageScrollRatio = 0;

      for (const [pageNumber, element] of pageRefs.current.entries()) {
        const rect = element.getBoundingClientRect();
        if (rect.top - containerTop <= 80) {
          currentPage = pageNumber;
          pageScrollRatio = Math.min(Math.max((container.scrollTop - element.offsetTop) / element.offsetHeight, 0), 1);
        }
      }

      latestProgressRef.current = {
        pageNumber: currentPage,
        pageScrollRatio,
        zoomScale: scale,
      };

      saveCurrentSnapshot({
        pageNumber: currentPage,
        pageScrollRatio,
        zoomScale: scale,
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => container.removeEventListener('scroll', onScroll);
  }, [pdf, scale, saveCurrentSnapshot]);

  if (error) {
    return <div className="grid h-full place-items-center text-sm text-red-700">{error}</div>;
  }

  if (!pdf) {
    return <div className="grid h-full place-items-center text-sm text-stone-500">Loading PDF</div>;
  }

  return (
    <main ref={containerRef} className="h-full overflow-y-auto bg-stone-100 px-3 py-6">
      {pageNumbers.map((pageNumber) => (
        <PdfPage
          key={`${pageNumber}-${scale}`}
          pdf={pdf}
          pageNumber={pageNumber}
          scale={scale}
          registerPage={registerPage}
        />
      ))}
    </main>
  );
}
