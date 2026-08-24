import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import PdfPage from './PdfPage.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const DEFAULT_SCALE = 1;
const PAGE_PRELOAD_MARGIN = '900px 0px';
const DEFAULT_PAGE_RATIO = 612 / 792;
const SCROLL_TOP_OFFSET = 24;

function LazyPdfPage({ pdf, pageNumber, scale, scrollRoot, registerPage, forceRender }) {
  const pageRef = useRef(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [pageRatio, setPageRatio] = useState(DEFAULT_PAGE_RATIO);

  useEffect(() => {
    const element = pageRef.current;
    registerPage(pageNumber, element);

    return () => registerPage(pageNumber, null);
  }, [pageNumber, registerPage]);

  useEffect(() => {
    const element = pageRef.current;
    if (!element) return undefined;

    // Older browsers keep the reader usable by rendering pages normally.
    if (!('IntersectionObserver' in window)) {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      {
        root: scrollRoot,
        rootMargin: PAGE_PRELOAD_MARGIN,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRoot]);

  return (
    <article
      ref={pageRef}
      data-page-number={pageNumber}
      className="mx-auto mb-6 flex w-full max-w-full flex-col items-center scroll-mt-6"
      style={{ width: `min(100%, ${Math.floor(612 * scale)}px)` }}
    >
      {isNearViewport || forceRender ? (
        <PdfPage
          pdf={pdf}
          pageNumber={pageNumber}
          scale={scale}
          onPageRatioChange={setPageRatio}
        />
      ) : (
        <>
          <div className="mb-2 h-4" aria-hidden="true" />
          <div
            className="rounded border border-stone-200 bg-white shadow-sm"
            style={{ aspectRatio: pageRatio }}
            aria-label={`Page ${pageNumber} placeholder`}
          />
        </>
      )}
    </article>
  );
}

export default function PdfReader({ file, savedProgress, pageCommand, onProgressChange }) {
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [scrollRoot, setScrollRoot] = useState(null);
  const [navigationTarget, setNavigationTarget] = useState(null);
  const containerRef = useRef(null);
  const pageRefs = useRef(new Map());
  const navigationRef = useRef(null);
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
    container.scrollTo({ top: Math.max(offset - SCROLL_TOP_OFFSET, 0), behavior });
    return true;
  }, []);

  const alignNavigationTarget = useCallback(() => {
    const navigation = navigationRef.current;
    if (navigation) {
      scrollToPage(navigation.pageNumber, navigation.pageScrollRatio || 0, 'auto');
    }
  }, [scrollToPage]);

  const setContainerRef = useCallback((element) => {
    containerRef.current = element;
    setScrollRoot(element);
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
    if (element) {
      pageRefs.current.set(pageNumber, element);
    } else {
      pageRefs.current.delete(pageNumber);
    }
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

    let animationFrame = null;
    let settleTimer = null;
    const timer = window.setTimeout(() => {
      const targetPage = Math.min(savedProgress.pageNumber || 1, pdf.numPages);
      const restoration = {
        pageNumber: targetPage,
        pageScrollRatio: savedProgress.pageScrollRatio || 0,
      };

      // Keep restoration pinned while nearby placeholders become canvases.
      // Without this, browser scroll anchoring can replace the saved page with
      // the following page before the first progress snapshot is recorded.
      navigationRef.current = restoration;
      setNavigationTarget(targetPage);

      if (!scrollToPage(targetPage, savedProgress.pageScrollRatio || 0, 'auto')) {
        navigationRef.current = null;
        setNavigationTarget(null);
        return;
      }
      restoredRef.current = true;
      trackingReadyRef.current = true;

      animationFrame = window.requestAnimationFrame(alignNavigationTarget);
      settleTimer = window.setTimeout(() => {
        if (navigationRef.current !== restoration) return;

        alignNavigationTarget();
        navigationRef.current = null;
        setNavigationTarget(null);
      }, 500);
    }, 450);

    return () => {
      window.clearTimeout(timer);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
    };
  }, [pdf, scrollToPage, alignNavigationTarget]);

  useEffect(() => {
    if (!pdf || !pageCommand) return;

    const targetPage = Math.min(Math.max(pageCommand.pageNumber, 1), pdf.numPages);
    const navigation = { pageNumber: targetPage, pageScrollRatio: 0, id: pageCommand.id };
    navigationRef.current = navigation;
    setNavigationTarget(targetPage);
    trackingReadyRef.current = true;
    latestProgressRef.current = {
      pageNumber: targetPage,
      pageScrollRatio: 0,
      zoomScale: scale,
    };
    saveCurrentSnapshot({ pageNumber: targetPage, pageScrollRatio: 0, zoomScale: scale });

    // Jump first, then correct after React mounts the target canvas and it changes size.
    alignNavigationTarget();
    const animationFrame = window.requestAnimationFrame(alignNavigationTarget);
    const settleTimer = window.setTimeout(() => {
      if (navigationRef.current !== navigation) return;

      alignNavigationTarget();
      navigationRef.current = null;
      setNavigationTarget(null);
    }, 500);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(settleTimer);
    };
  }, [pdf, pageCommand, scale, saveCurrentSnapshot, alignNavigationTarget]);

  useEffect(() => {
    if (!navigationTarget || !('ResizeObserver' in window)) return undefined;

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(alignNavigationTarget);
    });

    // Nearby pages may replace their placeholders at the same time as the target.
    // Watching their sizes keeps the target's offset correct during that short transition.
    pageRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [navigationTarget, alignNavigationTarget]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdf) return;

    const onScroll = () => {
      if (!trackingReadyRef.current) return;

      const containerTop = container.getBoundingClientRect().top;
      let currentPage = 1;
      let pageScrollRatio = 0;

      if (navigationRef.current) {
        currentPage = navigationRef.current.pageNumber;
      } else {
        for (const [pageNumber, element] of pageRefs.current.entries()) {
          const rect = element.getBoundingClientRect();
          // A page becomes current only when it reaches the same visual offset
          // used by scrollToPage. The former 80px threshold saved the next page
          // while the reader was still on the previous one.
          if (rect.top - containerTop <= SCROLL_TOP_OFFSET) {
            currentPage = pageNumber;
            pageScrollRatio = Math.min(Math.max((container.scrollTop - element.offsetTop) / element.offsetHeight, 0), 1);
          }
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
    <main ref={setContainerRef} className="h-full overflow-y-auto bg-stone-100 px-3 py-6">
      {pageNumbers.map((pageNumber) => (
        <LazyPdfPage
          key={`${pageNumber}-${scale}`}
          pdf={pdf}
          pageNumber={pageNumber}
          scale={scale}
          scrollRoot={scrollRoot}
          registerPage={registerPage}
          forceRender={pageNumber === navigationTarget}
        />
      ))}
    </main>
  );
}
