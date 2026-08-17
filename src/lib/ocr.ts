import imageCompression from 'browser-image-compression';

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export const detectAwbBoxesInImage = async (
  imageFile: File,
  onProgress?: (progress: number) => void,
): Promise<OcrWord[]> => {
  if (onProgress) {
    onProgress(0.1);
  }

  // Compress image to avoid payload limits and speed up upload
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1200,
    useWebWorker: true
  };
  
  let compressedFile = imageFile;
  try {
    compressedFile = await imageCompression(imageFile, options);
  } catch (error) {
    console.error("Compression error:", error);
  }

  if (onProgress) {
    onProgress(0.3);
  }

  // Convert File to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(compressedFile);
    reader.onload = () => {
      if (reader.result) {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      } else {
        reject(new Error("Failed to read image file"));
      }
    };
    reader.onerror = error => reject(error);
  });

  if (onProgress) {
    onProgress(0.5);
  }

  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ imageBase64: base64 })
  });

  if (!response.ok) {
    throw new Error("Failed to process image with Gemini OCR");
  }

  const data = await response.json();
  
  if (onProgress) {
    onProgress(1.0);
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const mappedWords = data.map((item: any) => ({
        text: item.text,
        confidence: 1,
        bbox: {
          x0: (item.bbox.x0 / 1000) * nw,
          y0: (item.bbox.y0 / 1000) * nh,
          x1: (item.bbox.x1 / 1000) * nw,
          y1: (item.bbox.y1 / 1000) * nh,
        }
      }));
      resolve(mappedWords);
    };
    img.onerror = reject;
    // VERY IMPORTANT: Use original imageFile to get original dimensions, NOT compressed!
    img.src = URL.createObjectURL(imageFile);
  });
};