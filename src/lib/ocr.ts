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
  
  // AWB Format: 'R' followed by 10-12 alphanumeric characters
  const awbRegex = /R[A-Z0-9]{10,12}/i;

    // 1. Identify table headers to define the vertical and horizontal column range
  const awbHeader = words.find((w) => w.text.toUpperCase().includes("AWB") || w.text.toUpperCase() === "REF");
  
  let leftBound = -Infinity;
  let rightBound = Infinity;
  let topBound = -Infinity;

  if (awbHeader) {
    topBound = awbHeader.bbox.y1 - 20; // Vertical coordinate range starts just below the header
    const colCenter = (awbHeader.bbox.x0 + awbHeader.bbox.x1) / 2;
    
    // Narrow horizontal bounds strictly around the center of the AWB header
    // to completely ignore Sr No on the left and Shipment No on the right
    // A standard column width gives plenty of room for 13-char text without bleeding into adjacent columns.
    const colWidth = awbHeader.bbox.x1 - awbHeader.bbox.x0;
    
    leftBound = colCenter - (colWidth * 4); // Extremely tight left bound
    rightBound = colCenter + (colWidth * 5); // Tight right bound
  }

  // 2. Filter words to ONLY those within the AWB column's vertical & horizontal range
  const columnWords = words.filter((w) => {
    if (w.bbox.y0 < topBound) return false;
    const wCenter = (w.bbox.x0 + w.bbox.x1) / 2;
    return wCenter > leftBound && wCenter < rightBound;
  });

  const uniqueAwbs: OcrWord[] = [];
  const seen = new Set<string>();

  // Helper to add if valid
  const tryAddAwb = (text: string, bbox: any, confidence: number) => {
    const cleanText = text.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const match = cleanText.match(/R[A-Z0-9]{10,14}/); // Allow slightly longer if artifacts got merged
    if (match) {
      const exactAwb = match[0];
      if (!seen.has(exactAwb)) {
        seen.add(exactAwb);
        uniqueAwbs.push({
          text: exactAwb,
          confidence,
          bbox: { ...bbox }
        });
      }
    }
  };

  // 3. Iterate through all detected text nodes (single tokens) and apply the filter
  columnWords.forEach(word => {
    tryAddAwb(word.text, word.bbox, word.confidence);
  });

  // 4. Fallback: Reconstruct from adjacent tokens if Tesseract fragmented the AWB
  // Group remaining words by line (vertical proximity) and merge horizontally
  const lines: OcrWord[][] = [];
  const sortedWords = [...columnWords].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  
  for (const word of sortedWords) {
    const wordCenterY = (word.bbox.y0 + word.bbox.y1) / 2;
    let foundLine = false;
    for (const line of lines) {
      const lineCenterY = line.reduce((sum, w) => sum + (w.bbox.y0 + w.bbox.y1) / 2, 0) / line.length;
      if (Math.abs(wordCenterY - lineCenterY) < (word.bbox.y1 - word.bbox.y0) * 0.8) { 
        line.push(word);
        foundLine = true;
        break;
      }
    }
    if (!foundLine) {
      lines.push([word]);
    }
  }

  for (const line of lines) {
    line.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const combinedText = line.map(w => w.text).join("");
    const bbox = {
      x0: Math.min(...line.map(w => w.bbox.x0)),
      y0: Math.min(...line.map(w => w.bbox.y0)),
      x1: Math.max(...line.map(w => w.bbox.x1)),
      y1: Math.max(...line.map(w => w.bbox.y1))
    };
    const confidence = Math.min(...line.map(w => w.confidence));
    tryAddAwb(combinedText, bbox, confidence);
  }

  // Debug log required by the user
  console.log("=== INTERNAL DEBUG: AWB DETECTION ===");
  console.log("Number of AWBs detected:", uniqueAwbs.length);
  uniqueAwbs.forEach((awb, i) => {
    console.log(`AWB ${i + 1}: ${awb.text}`);
    console.log(`   Bounding Box: x0=${awb.bbox.x0}, y0=${awb.bbox.y0}, x1=${awb.bbox.x1}, y1=${awb.bbox.y1}`);
  });
  console.log("=====================================");

  return uniqueAwbs;
};
