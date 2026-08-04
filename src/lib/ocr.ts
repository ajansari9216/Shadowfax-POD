import Tesseract from "tesseract.js";

export const extractTrackingNumbers = (text: string): string[] => {
  const numbers = new Set<string>();

  // SF Number
  const sfRegex = /SF[\s\-]*[A-Z0-9]{8,15}\b/gi;
  // RT Number
  const rtRegex = /RT[\s\-]*[A-Z0-9]{7,12}\b/gi;
  // R Number (starts with R, not RT)
  const rRegex = /R(?![T])[\s\-]*[A-Z0-9]{9,15}\b/gi;

  const extract = (regex: RegExp) => {
    const matches = text.match(regex);
    if (matches) {
      matches.forEach((m) => {
        // Clean up spaces and hyphens before storing
        const cleanNumber = m.replace(/[\s\-]/g, "").toUpperCase();
        numbers.add(cleanNumber);
      });
    }
  };

  extract(sfRegex);
  extract(rtRegex);
  extract(rRegex);

  return Array.from(numbers);
};

export const performOCR = async (
  imageFile: File,
  onProgress?: (progress: number) => void,
): Promise<{ text: string; numbers: string[] }> => {
  try {
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) {
          onProgress(m.progress);
        }
      },
    });

    const ret = await worker.recognize(imageFile);
    await worker.terminate();

    const text = ret.data.text;
    const numbers = extractTrackingNumbers(text);

    return { text, numbers };
  } catch (error) {
    console.error("OCR Error:", error);
    throw error;
  }
};
