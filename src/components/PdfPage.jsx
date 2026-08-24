import { useEffect, useRef, useState } from 'react';

export default function PdfPage({ pdf, pageNumber, scale, onPageRatioChange }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;

    async function renderPage() {
      setStatus('loading');

      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      onPageRatioChange(viewport.width / viewport.height);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { alpha: false });
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = 'auto';

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderTask = page.render({ canvasContext: context, viewport });

      await renderTask.promise;
      if (!cancelled) setStatus('ready');
    }

    renderPage().catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, scale]);

  return (
    <>
      <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-normal text-stone-500">
        <span>Page {pageNumber}</span>
        {status === 'loading' && <span>Rendering</span>}
        {status === 'error' && <span>Unable to render</span>}
      </div>
      <canvas className="mx-auto max-w-full rounded border border-stone-200 bg-white shadow-sm" ref={canvasRef} />
    </>
  );
}
