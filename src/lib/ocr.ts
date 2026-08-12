import Tesseract from "tesseract.js";

type PreprocessVariant = "enhanced" | "high-contrast" | "binarized";

const preprocessImage = async (file: File, variant: PreprocessVariant): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_DIM = 2048;
      let w = img.width;
      let h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w *= ratio;
        h *= ratio;
      }
      
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(URL.createObjectURL(file));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      
      let contrast = 0;
      if (variant === "enhanced") contrast = 40;
      else if (variant === "high-contrast") contrast = 100;
      else if (variant === "binarized") contrast = 120;
      
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        
        let val = gray;
        if (variant !== "enhanced") {
            val = factor * (gray - 128) + 128;
            val = Math.max(0, Math.min(255, val));
        }
        
        if (variant === "binarized") {
            val = val > 140 ? 255 : 0;
        }

        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = URL.createObjectURL(file);
  });
};

export interface ExtractedNumber {
  value: string;
  type: string;
  confidence: number;
}

export const extractTrackingNumbersWithConfidence = (text: string): ExtractedNumber[] => {
  const sfRegex = /(?:SF|S F|5F|S5)[ \t\-]*([A-Z0-9 \t\-]{7,20})/gi;
  const rtRegex = /(?:RT|R T)[ \t\-]*([A-Z0-9 \t\-]{6,15})/gi;
  const rRegex = /R[ \t\-]*([A-Z0-9 \t\-]{8,20})/gi;

  const forbiddenWords = [
    "RETURN", "RECEIVED", "SHADOW", "MUMBAI", "DELHI", "DELIVERY", "RVP", "RTO", "ADDRESS",
    "MANIFEST", "DATE", "CARRIER", "TABLE", "SR", "NO", "AWB", "SHIPMENT"
  ];
  
  const processMatch = (prefix: string, matchStr: string): { clean: string, conf: number } | null => {
    let clean = matchStr.replace(/[ \t\-]/g, "").toUpperCase();
    for (let f of forbiddenWords) {
      if (clean.includes(f)) {
        clean = clean.split(f)[0];
      }
    }
    const wordMatch = clean.match(/[A-Z]{3,}/);
    if (wordMatch) {
        clean = clean.substring(0, wordMatch.index);
    }
    
    clean = clean.replace(/O/g, "0").replace(/I/g, "1").replace(/S/g, "5").replace(/Z/g, "2").replace(/B/g, "8");

    let conf = 80;
    if (!clean.match(/[A-Z]/)) conf += 10;
    
    if (prefix === "SF" && clean.length >= 8 && clean.length <= 15) {
      if ((clean.match(/\d/g) || []).length >= 5) {
        if (clean.length === 8) conf += 10;
        return { clean: "SF" + clean, conf };
      }
    }
    if (prefix === "RT" && clean.length >= 7 && clean.length <= 12) {
      if ((clean.match(/\d/g) || []).length >= 5) {
        return { clean: "RT" + clean, conf };
      }
    }
    if (prefix === "R" && clean.length >= 9 && clean.length <= 15) {
      if ((clean.match(/\d/g) || []).length >= 5) {
        return { clean: "R" + clean, conf };
      }
    }
    return null;
  };

  const results = new Map<string, ExtractedNumber>();
  
  let m;
  while ((m = sfRegex.exec(text)) !== null) {
    const res = processMatch("SF", m[1]);
    if (res && (!results.has(res.clean) || results.get(res.clean)!.confidence < res.conf)) {
      results.set(res.clean, { value: res.clean, type: "Shipment No", confidence: Math.min(99, res.conf) });
    }
  }
  while ((m = rtRegex.exec(text)) !== null) {
    const res = processMatch("RT", m[1]);
    if (res && (!results.has(res.clean) || results.get(res.clean)!.confidence < res.conf)) {
      results.set(res.clean, { value: res.clean, type: "Return ID", confidence: Math.min(99, res.conf) });
    }
  }
  while ((m = rRegex.exec(text)) !== null) {
    const res = processMatch("R", m[1]);
    if (res && (!results.has(res.clean) || results.get(res.clean)!.confidence < res.conf)) {
      results.set(res.clean, { value: res.clean, type: "AWB Ref No", confidence: Math.min(99, res.conf) });
    }
  }

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    if (line.includes("AWB")) {
        const nextWords = (line + " " + (lines[i+1]||"")).split(/\s+/);
        for (let w of nextWords) {
            if (w.startsWith("R") && w.length > 8 && (w.match(/\d/g)||[]).length > 5) {
                const clean = w.replace(/O/g, "0").replace(/I/g, "1").replace(/S/g, "5");
                results.set(clean, { value: clean, type: "AWB Ref No", confidence: 95 });
            }
        }
    }
  }

  return Array.from(results.values());
};

// Also export the original function for backwards compatibility if something uses it, 
// though we can just map it
export const extractTrackingNumbers = (text: string): string[] => {
  return extractTrackingNumbersWithConfidence(text).map(x => x.value);
};

export const performOCR = async (
  imageFile: File,
  onProgress?: (progress: number) => void,
): Promise<{ text: string; numbers: string[] }> => {
  try {
    let allNumbers: ExtractedNumber[] = [];
    let combinedText = "";

    const worker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) {
          onProgress(m.progress * 0.33); 
        }
      },
    });

    const variants: PreprocessVariant[] = ["enhanced", "high-contrast", "binarized"];
    
    for (let i = 0; i < variants.length; i++) {
      const processedImageData = await preprocessImage(imageFile, variants[i]);
      const ret = await worker.recognize(processedImageData);
      const text = ret.data.text;
      combinedText += text + "\n---\n";
      
      const nums = extractTrackingNumbersWithConfidence(text);
      nums.forEach(n => {
        const existing = allNumbers.find(x => x.value === n.value);
        if (existing) {
            existing.confidence = Math.min(99, existing.confidence + 5); 
        } else {
            allNumbers.push(n);
        }
      });
      
      const highConf = allNumbers.filter(n => n.confidence >= 90);
      if (highConf.length > 0) {
        break;
      }
      
      if (onProgress) onProgress((i + 1) * 0.33);
    }

    await worker.terminate();
    
    const finalNumbers = allNumbers.filter(n => n.confidence >= 80).map(n => n.value);
    const resultNums = finalNumbers.length > 0 ? finalNumbers : allNumbers.map(n => n.value);
    
    return { text: combinedText, numbers: Array.from(new Set(resultNums)) };
  } catch (error) {
    console.error("OCR Error:", error);
    throw error;
  }
};
