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

export interface ExtractedAWB {
  value: string;
  confidence: number;
}

export const extractAWBWithConfidence = (text: string): ExtractedAWB[] => {
  const lines = text.split("\n");
  const results = new Map<string, ExtractedAWB>();
  
  // Clean up text
  const cleanWord = (w: string) => w.replace(/O/g, "0").replace(/I/g, "1").replace(/S/g, "5").replace(/[^A-Z0-9]/gi, "").toUpperCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    
    // Check if the line contains AWB
    const isAWBLine = line.includes("AWB");
    
    // Look for alphanumeric words in this line and the next few lines
    // AWB numbers are typically 8-20 chars long, containing both letters and numbers, or just numbers (but not typical phone numbers)
    const scanLines = [line, (lines[i+1]||"").toUpperCase(), (lines[i+2]||"").toUpperCase()];
    
    scanLines.forEach((scanLine, lineOffset) => {
      const words = scanLine.split(/[\s|]+/) || [];
      for (let w of words) {
        const clean = cleanWord(w);
        
        // Basic validation: length between 8 and 20
        if (clean.length >= 8 && clean.length <= 20) {
          // Must contain at least 4 digits
          const digitCount = (clean.match(/\d/g) || []).length;
          // Must not be just a date (like 11082026)
          const isDate = /^\d{8}$/.test(clean) || /^\d{4}202\d$/.test(clean);
          // Must not be a typical phone number (10 digits starting with 6-9)
          const isPhone = /^[6-9]\d{9}$/.test(clean);
          // Ignore typical "Shipment No" prefixes if we strictly want AWB?
          // Sometimes Shipment No is different. Let's just avoid words like RECEIVED.
          const isKeyword = ["RECEIVED", "RETURN", "SHADOW", "MANIFEST", "DELIVERY", "RUNSHEET"].some(k => clean.includes(k));

          if (digitCount >= 4 && !isDate && !isPhone && !isKeyword) {
            let conf = 50; // Base confidence
            
            // Boost if it contains both letters and numbers
            if (/[A-Z]/.test(clean) && /[0-9]/.test(clean)) conf += 20;
            
            // Boost if it's on the same line as AWB, or the line immediately after
            if (isAWBLine) {
              if (lineOffset === 0) conf += 30; // Same line
              if (lineOffset === 1) conf += 20; // Next line
            }
            
            // Boost if it matches the 'R' prefix format we saw in Shadowfax AWBs
            if (clean.startsWith("R") && clean.length >= 10) conf += 15;

            // Cap at 99
            conf = Math.min(99, conf);

            if (conf >= 60) { // Only keep reasonable candidates
              if (!results.has(clean) || results.get(clean)!.confidence < conf) {
                results.set(clean, { value: clean, confidence: conf });
              }
            }
          }
        }
      }
    });
  }
  
  return Array.from(results.values()).sort((a, b) => b.confidence - a.confidence);
};

export const performOCR = async (
  imageFile: File,
  onProgress?: (progress: number) => void,
): Promise<{ text: string; numbers: string[] }> => {
  return new Promise(async (resolve, reject) => {
    let timeoutId: NodeJS.Timeout;
    let isDone = false;
    
    // Max timeout of 30 seconds for OCR
    timeoutId = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        reject(new Error("OCR timeout exceeded"));
      }
    }, 30000);

    try {
      console.log("OCR START");
      let allAWBs: ExtractedAWB[] = [];
      let combinedText = "";
      const worker = await Tesseract.createWorker("eng", 1, {
        logger: (m) => {
          if (!isDone && m.status === "recognizing text" && onProgress) {
            onProgress(m.progress * 0.33); 
          }
        },
      });

      const variants: PreprocessVariant[] = ["enhanced", "high-contrast", "binarized"];
      
      for (let i = 0; i < Math.min(3, variants.length); i++) {
        if (isDone) break;
        
        const processedImageData = await preprocessImage(imageFile, variants[i]);
        if (isDone) break;
        
        const ret = await worker.recognize(processedImageData);
        const text = ret.data.text;
        combinedText += text + "\n---\n";
        
        const foundAWBs = extractAWBWithConfidence(text);
        foundAWBs.forEach(n => {
          const existing = allAWBs.find(x => x.value === n.value);
          if (existing) {
              existing.confidence = Math.min(99, Math.max(existing.confidence, n.confidence + 5)); 
          } else {
              allAWBs.push(n);
          }
        });
        
        allAWBs.sort((a, b) => b.confidence - a.confidence);
        const bestConf = allAWBs.length > 0 ? allAWBs[0].confidence : 0;
        
        if (onProgress) onProgress((i + 1) * 0.33);

        if (bestConf >= 85) {
          console.log(`AWB DETECTED early with confidence ${bestConf}`);
          break; // Good enough, stop
        }
      }
      
      if (!isDone) {
        await worker.terminate();
      }
      
      if (isDone) return;
      isDone = true;
      clearTimeout(timeoutId);

      allAWBs.sort((a, b) => b.confidence - a.confidence);
      
      // We only return the best AWB if it meets a reasonable threshold
      const finalAWBs = allAWBs.filter(a => a.confidence >= 65).map(a => a.value);
      
      console.log("OCR COMPLETE", finalAWBs);
      
      resolve({ text: combinedText, numbers: finalAWBs.length > 0 ? [finalAWBs[0]] : [] });
    } catch (error) {
      if (!isDone) {
        isDone = true;
        clearTimeout(timeoutId);
        console.error("OCR Error:", error);
        reject(error);
      }
    }
  });
};
