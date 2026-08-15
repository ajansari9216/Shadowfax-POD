import Tesseract from "tesseract.js";

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

export const extractWordsFromImage = async (
  imageFile: File,
  onProgress?: (progress: number) => void,
): Promise<OcrWord[]> => {
  // Load the image to natively process EXIF orientation
  const img = await loadImage(imageFile);
  
  // Create a canvas to downscale (prevents WASM OOM) and bake in EXIF orientation
  const canvas = document.createElement("canvas");
  const MAX_DIM = 1500;
  let scale = 1;
  if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM) {
    scale = MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight);
  }
  
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(m.progress);
      }
    },
  });

  // Run Tesseract on the EXIF-corrected, downscaled canvas
  const ret = await worker.recognize(canvas, {}, { blocks: true });
  await worker.terminate();
  URL.revokeObjectURL(img.src);

  const words: OcrWord[] = [];
  if (ret.data.blocks) {
    for (const block of ret.data.blocks) {
      if (block.paragraphs) {
        for (const paragraph of block.paragraphs) {
          if (paragraph.lines) {
            for (const line of paragraph.lines) {
              if (line.words) {
                for (const word of line.words) {
                  // Scale coordinates BACK up to match the original natural dimensions!
                  words.push({
                    text: word.text,
                    confidence: word.confidence,
                    bbox: {
                      x0: word.bbox.x0 / scale,
                      y0: word.bbox.y0 / scale,
                      x1: word.bbox.x1 / scale,
                      y1: word.bbox.y1 / scale,
                    },
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

export const detectAwbBoxesInImage = async (
  imageFile: File,
  onProgress?: (progress: number) => void,
): Promise<OcrWord[]> => {
  const words = await extractWordsFromImage(imageFile, onProgress);

  const isAwbFormat = (text: string) => {
    const clean = text.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (clean.length < 8 || clean.length > 20) return false;
    if (!/[0-9]/.test(clean)) return false; 
    if (!/[A-Z]/.test(clean)) return false; 
    return true;
  };

  const awbHeader = words.find((w) =>
    w.text.toUpperCase().includes("AWB")
  );

  let parsedAwbs: OcrWord[] = [];

  const groupWordsIntoAwbs = (candidates: OcrWord[]): OcrWord[] => {
    // 1. Group words into text lines based on Y-overlap / proximity
    const lines: OcrWord[][] = [];
    const sortedWords = [...candidates].sort((a, b) => a.bbox.y0 - b.bbox.y0);
    
    for (const word of sortedWords) {
      const wordCenterY = (word.bbox.y0 + word.bbox.y1) / 2;
      let foundLine = false;
      for (const line of lines) {
        const lineCenterY = line.reduce((sum, w) => sum + (w.bbox.y0 + w.bbox.y1) / 2, 0) / line.length;
        if (Math.abs(wordCenterY - lineCenterY) < (word.bbox.y1 - word.bbox.y0) * 0.7) { 
          line.push(word);
          foundLine = true;
          break;
        }
      }
      if (!foundLine) {
        lines.push([word]);
      }
    }

    // 2. For each line, sort words left-to-right, then merge adjacent words
    const candidateBlocks: OcrWord[] = [];
    
    for (const line of lines) {
      line.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      let currentBlock: OcrWord | null = null;
      
      for (const word of line) {
        if (!currentBlock) {
          currentBlock = { ...word, bbox: { ...word.bbox } };
        } else {
          const textHeight = currentBlock.bbox.y1 - currentBlock.bbox.y0;
          const gap = word.bbox.x0 - currentBlock.bbox.x1;
          
          // Merge if gap is small (e.g. less than 2.5x the height of the text)
          if (gap < textHeight * 2.5) { 
            currentBlock.text += word.text; // preserve no space for format check
            currentBlock.bbox.x1 = Math.max(currentBlock.bbox.x1, word.bbox.x1);
            currentBlock.bbox.y0 = Math.min(currentBlock.bbox.y0, word.bbox.y0);
            currentBlock.bbox.y1 = Math.max(currentBlock.bbox.y1, word.bbox.y1);
            currentBlock.confidence = Math.min(currentBlock.confidence, word.confidence);
          } else {
            candidateBlocks.push(currentBlock);
            currentBlock = { ...word, bbox: { ...word.bbox } };
          }
        }
      }
      if (currentBlock) {
        candidateBlocks.push(currentBlock);
      }
    }

    // 3. Filter blocks by AWB format
    return candidateBlocks
      .map(block => ({
        ...block,
        text: block.text.replace(/[^A-Z0-9]/gi, "").toUpperCase()
      }))
      .filter(block => isAwbFormat(block.text));
  };

  if (awbHeader) {
    const colCenter = (awbHeader.bbox.x0 + awbHeader.bbox.x1) / 2;
    const colWidth = awbHeader.bbox.x1 - awbHeader.bbox.x0;
    const searchWidth = colWidth * 6;

    const candidates = words.filter((w) => {
      if (w.bbox.y0 < awbHeader.bbox.y1 - 10) return false;
      const wCenter = (w.bbox.x0 + w.bbox.x1) / 2;
      if (Math.abs(wCenter - colCenter) > searchWidth) return false;
      return true;
    });

    parsedAwbs = groupWordsIntoAwbs(candidates);
  }

  if (parsedAwbs.length === 0) {
    parsedAwbs = groupWordsIntoAwbs([...words]);
  }

  // Remove duplicates by text
  const uniqueAwbs: OcrWord[] = [];
  const seen = new Set<string>();
  for (const awb of parsedAwbs) {
    if (!seen.has(awb.text)) {
      seen.add(awb.text);
      uniqueAwbs.push(awb);
    }
  }

  return uniqueAwbs;
};
