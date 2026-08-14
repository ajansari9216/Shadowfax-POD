import Tesseract from "tesseract.js";

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export const extractWordsFromImage = async (
  imageFile: File,
  onProgress?: (progress: number) => void,
): Promise<OcrWord[]> => {
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(m.progress);
      }
    },
  });

  const ret = await worker.recognize(imageFile);
  await worker.terminate();

  return (ret.data as any).words.map((w: any) => ({
    text: w.text,
    confidence: w.confidence,
    bbox: w.bbox,
  }));
};

export const detectAwbsInImage = async (
  imageFile: File,
  onProgress?: (progress: number) => void,
): Promise<string[]> => {
  const words = await extractWordsFromImage(imageFile, onProgress);

  const isAwbFormat = (text: string) => {
    const clean = text.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    // AWBs are typically long alphanumeric strings.
    if (clean.length < 8 || clean.length > 20) return false;
    // Ensure it contains both letters and numbers to avoid extracting pure numbers like dates/phones
    if (!/[0-9]/.test(clean)) return false; 
    if (!/[A-Z]/.test(clean)) return false; 
    return true;
  };

  // 1. Try to find the AWB column header ("AWB Ref No")
  const awbHeader = words.find((w) =>
    w.text.toUpperCase().includes("AWB")
  );

  let candidates: OcrWord[] = [];

  if (awbHeader) {
    const colCenter = (awbHeader.bbox.x0 + awbHeader.bbox.x1) / 2;
    const colWidth = awbHeader.bbox.x1 - awbHeader.bbox.x0;
    // Give it a wide horizontal berth to catch long AWBs extending past the header
    const searchWidth = Math.max(colWidth * 6, 400);

    candidates = words.filter((w) => {
      // Must be physically below the header (allowing a little fuzziness for skewed scans)
      if (w.bbox.y0 < awbHeader.bbox.y1 - 30) return false;
      // Must be roughly horizontally aligned with the header column
      const wCenter = (w.bbox.x0 + w.bbox.x1) / 2;
      if (Math.abs(wCenter - colCenter) > searchWidth) return false;
      return true;
    });
  }

  // Map and clean candidates
  let parsedAwbs = candidates
    .map((w) => w.text.replace(/[^A-Z0-9]/gi, "").toUpperCase())
    .filter(isAwbFormat);

  // 2. Fallback: If no column header found, or strict column geometry failed to find anything,
  // scan the entire image for strings that match the strict AWB alphanumeric pattern.
  if (parsedAwbs.length === 0) {
    parsedAwbs = words
      .map((w) => w.text.replace(/[^A-Z0-9]/gi, "").toUpperCase())
      .filter(isAwbFormat);
  }

  // Return unique AWBs
  return Array.from(new Set(parsedAwbs));
};
