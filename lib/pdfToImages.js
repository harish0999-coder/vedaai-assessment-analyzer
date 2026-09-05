'use client';

// Renders every page of a File (PDF or image) into compressed JPEG data URLs
// entirely in the browser. Keeping this client-side avoids needing native
// PDF-rasterizing dependencies (poppler/canvas) on the server, which don't
// play well with serverless deploy targets like Vercel.
//
// Images are exported as JPEG (not PNG) and capped in resolution because the
// finished payload — question paper pages + answer sheet pages, all base64
// encoded together in one JSON request — has to fit under Vercel's request
// body limit (4.5 MB on Serverless Functions, a hard cap that isn't
// configurable). Uncompressed PNGs at high DPI blow past that with just a
// couple of pages.

const MAX_DIMENSION = 1600; // px, long edge — plenty for OCR + bounding boxes
const JPEG_QUALITY = 0.82;

let pdfjsLibPromise = null;
async function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist/build/pdf').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      return pdfjs;
    });
  }
  return pdfjsLibPromise;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasToCompressedJpeg(canvas) {
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

// Scales a width/height pair down so the longer edge is at most MAX_DIMENSION.
function fitDimensions(w, h) {
  const longEdge = Math.max(w, h);
  if (longEdge <= MAX_DIMENSION) return { w, h };
  const scale = MAX_DIMENSION / longEdge;
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

async function imageFileToJpeg(file) {
  const dataUrl = await fileToDataUrl(file);
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });
  const { w, h } = fitDimensions(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return [canvasToCompressedJpeg(canvas)];
}

async function pdfFileToJpegs(file, onProgress) {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const { w, h } = fitDimensions(unscaledViewport.width, unscaledViewport.height);
    const scale = w / unscaledViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    // White background first — JPEG has no transparency, and PDF canvases
    // can otherwise render transparent areas as black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(canvasToCompressedJpeg(canvas));
    if (onProgress) onProgress(pageNum, pdf.numPages);
  }
  return pages;
}

/**
 * Convert an uploaded File into an array of compressed JPEG data URLs, one
 * per page, capped at MAX_DIMENSION on the long edge.
 */
export async function fileToPageImages(file, onProgress) {
  if (file.type === 'application/pdf') {
    return pdfFileToJpegs(file, onProgress);
  }
  if (file.type.startsWith('image/')) {
    return imageFileToJpeg(file);
  }
  throw new Error(`Unsupported file type: ${file.type || 'unknown'}. Upload a PDF or an image.`);
}
