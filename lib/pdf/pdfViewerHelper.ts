// PDF.js Client-Side Dynamic Loader & Render Helper

let pdfjsLib: any = null;

export async function getPdfJs() {
  if (typeof window === 'undefined') return null;
  if (!pdfjsLib) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '4.10.38'}/pdf.worker.min.mjs`;
    pdfjsLib = pdfjs;
  }
  return pdfjsLib;
}

export async function loadPdfDocument(source: string | ArrayBuffer | Uint8Array) {
  const pdfjs = await getPdfJs();
  if (!pdfjs) throw new Error('PDF.js not available in this environment');

  const loadingTask = pdfjs.getDocument(source);
  return await loadingTask.promise;
}

export async function renderPdfPageToCanvas(
  pdfDoc: any,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');
  if (!context) return;

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
}
