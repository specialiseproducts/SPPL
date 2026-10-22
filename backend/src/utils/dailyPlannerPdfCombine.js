/**
 * Daily Planner: combine multiple employee documents into a single PDF.
 *
 * Supported: PDF (pages merged), JPG/JPEG/PNG (embedded as pages).
 * Office formats (.doc/.docx/.xls/.xlsx/.ppt/.pptx) are rejected — no conversion
 * engine is available in this deployment.
 */

import { PDFDocument } from 'pdf-lib';

const OFFICE_EXT = /\.(doc|docx|xls|xlsx|ppt|pptx)$/i;
const PDF_EXT = /\.pdf$/i;
const JPEG_EXT = /\.(jpg|jpeg)$/i;
const PNG_EXT = /\.png$/i;

// A4 in PDF points
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 24;

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function sniffKind(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer.slice(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  return null;
}

function detectKind({ buffer, originalName, mimetype }) {
  const name = String(originalName || '');
  const mime = String(mimetype || '').toLowerCase();

  if (OFFICE_EXT.test(name) || /officedocument|msword|ms-excel|ms-powerpoint/.test(mime)) {
    throw badRequest(
      `Office document conversion is not available in this deployment ("${name || 'file'}"). ` +
        'Please convert it to PDF, JPG, or PNG before uploading.',
    );
  }

  const sniffed = sniffKind(buffer);
  if (sniffed) return sniffed;

  if (PDF_EXT.test(name) || mime === 'application/pdf') return 'pdf';
  if (JPEG_EXT.test(name) || mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (PNG_EXT.test(name) || mime === 'image/png') return 'png';

  throw badRequest(
    `Unsupported file type for "${name || 'file'}". Only PDF, JPG, JPEG and PNG can be combined.`,
  );
}

function addImagePage(pdf, image) {
  const maxW = A4_WIDTH - PAGE_MARGIN * 2;
  const maxH = A4_HEIGHT - PAGE_MARGIN * 2;
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const w = image.width * scale;
  const h = image.height * scale;
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawImage(image, {
    x: (A4_WIDTH - w) / 2,
    y: (A4_HEIGHT - h) / 2,
    width: w,
    height: h,
  });
}

function buildCombinedFileName(files) {
  const first = String(files?.[0]?.originalName || '').trim();
  const base = first.replace(/\.[^.]+$/, '').replace(/[^\w.\-()+ ]+/g, '_').trim();
  return `${base || 'document'}-combined.pdf`;
}

/**
 * @param {Array<{ buffer: Buffer, originalName?: string, mimetype?: string }>} files
 * @returns {Promise<{ buffer: Buffer, fileName: string, contentType: 'application/pdf' }>}
 */
export async function combineDocumentsToPdf(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (list.length === 0) {
    throw badRequest('At least one file is required');
  }

  // Validate all types first so Office files fail fast before any heavy work.
  const kinds = list.map((f) => detectKind(f));

  const out = await PDFDocument.create();
  for (let i = 0; i < list.length; i += 1) {
    const { buffer, originalName } = list[i];
    const label = String(originalName || `file ${i + 1}`);
    try {
      if (kinds[i] === 'pdf') {
        const src = await PDFDocument.load(buffer);
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      } else if (kinds[i] === 'jpg') {
        addImagePage(out, await out.embedJpg(buffer));
      } else {
        addImagePage(out, await out.embedPng(buffer));
      }
    } catch (error) {
      if (error?.statusCode) throw error;
      throw badRequest(
        `Could not read "${label}". The file may be corrupted or password-protected.`,
      );
    }
  }

  if (out.getPageCount() === 0) {
    throw badRequest('The combined document has no pages');
  }

  // useObjectStreams compresses cross-reference/object data for smaller output.
  const bytes = await out.save({ useObjectStreams: true });
  return {
    buffer: Buffer.from(bytes),
    fileName: buildCombinedFileName(list),
    contentType: 'application/pdf',
  };
}
