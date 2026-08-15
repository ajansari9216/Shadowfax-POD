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

  const ret = await worker.recognize(imageFile, {}, { blocks: true });
  await worker.terminate();

  const words: OcrWord[] = [];
  if (ret.data.blocks) {
    for (const block of ret.data.blocks) {
      if (block.paragraphs) {
        for (const paragraph of block.paragraphs) {
          if (paragraph.lines) {
            for (const line of paragraph.lines) {
              if (line.words) {
                for (const word of line.words) {
                  words.push({
                    text: word.text,
                    confidence: word.confidence,
                    bbox: word.bbox,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return words;
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

  let parsedAwbs: string[] = [];

  if (awbHeader) {
    const colCenter = (awbHeader.bbox.x0 + awbHeader.bbox.x1) / 2;
    const colWidth = awbHeader.bbox.x1 - awbHeader.bbox.x0;
    // Give it a wide horizontal berth to catch long AWBs extending past the header
    const searchWidth = Math.max(colWidth * 6, 400);

    const candidates = words.filter((w) => {
      // Must be physically below the header (allowing a little fuzziness for skewed scans)
      if (w.bbox.y0 < awbHeader.bbox.y1 - 10) return false;
      // Must be roughly horizontally aligned with the header column
      const wCenter = (w.bbox.x0 + w.bbox.x1) / 2;
      if (Math.abs(wCenter - colCenter) > searchWidth) return false;
      return true;
    });

    // Sort candidates left to right to preserve order when concatenating
    candidates.sort((a, b) => a.bbox.x0 - b.bbox.x0);

    // Group words into lines by y-coordinate proximity
    const lines: { [y: number]: string } = {};
    candidates.forEach((c) => {
      // find an existing line within 20 pixels vertical distance
      const yKey = Object.keys(lines).find(
        (y) => Math.abs(Number(y) - c.bbox.y0) < 20
      );
      if (yKey) {
        lines[Number(yKey)] += c.text;
      } else {
        lines[c.bbox.y0] = c.text;
      }
    });

    // Map and clean candidate lines
    parsedAwbs = Object.values(lines)
      .map((text) => text.replace(/[^A-Z0-9]/gi, "").toUpperCase())
      .filter(isAwbFormat);
  }

  // 2. Fallback: If no column header found, or strict column geometry failed to find anything,
  // group ALL words into lines, then filter by strict AWB pattern.
  if (parsedAwbs.length === 0) {
    const allWords = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const lines: { [y: number]: string } = {};
    allWords.forEach((c) => {
      const yKey = Object.keys(lines).find(
        (y) => Math.abs(Number(y) - c.bbox.y0) < 20
      );
      if (yKey) {
        lines[Number(yKey)] += c.text;
      } else {
        lines[c.bbox.y0] = c.text;
      }
    });

    parsedAwbs = Object.values(lines)
      .map((text) => text.replace(/[^A-Z0-9]/gi, "").toUpperCase())
      .filter(isAwbFormat);
  }

  // Return unique AWBs
  return Array.from(new Set(parsedAwbs));
};
