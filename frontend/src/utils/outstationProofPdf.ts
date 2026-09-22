import { jsPDF } from 'jspdf';

const SCREENSHOT_EXT = /\.(jpe?g|png)$/i;

export function isOutstationScreenshotFile(file: File | null | undefined): boolean {
  if (!file) return false;
  return SCREENSHOT_EXT.test(file.name);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read screenshot'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load screenshot image'));
    img.src = dataUrl;
  });
}

/**
 * Combine arrival + departure screenshots into a single 2-page PDF
 * (page 1 = arrival, page 2 = departure). Filename is provisional;
 * the backend assigns the authoritative employee_month(n).pdf name on save.
 */
export async function buildOutstationScreenshotsPdf(
  arrivalFile: File,
  departureFile: File,
  provisionalFileName = 'outstation-proof.pdf',
): Promise<File> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 24;

  const addImagePage = async (file: File, isFirst: boolean) => {
    if (!isFirst) doc.addPage();
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    const format = /\.png$/i.test(file.name) ? 'PNG' : 'JPEG';
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;
    doc.addImage(dataUrl, format, x, y, w, h, undefined, 'FAST');
  };

  await addImagePage(arrivalFile, true);
  await addImagePage(departureFile, false);

  const blob = doc.output('blob');
  return new File([blob], provisionalFileName, { type: 'application/pdf' });
}
