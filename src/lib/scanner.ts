import { solveHomography } from "./homography";

export type Point = { x: number; y: number };

// Simple fallback corner detection (just a 10% inset bounding box)
// A real auto-detect would use OpenCV (Canny edge + Hough transform), 
// but we'll provide a decent initial guess for manual adjustment.
export const detectCorners = async (imageSrc: string): Promise<Point[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      
      // Let's do a very basic thresholding to guess document bounds
      const canvas = document.createElement("canvas");
      // Scale down for speed
      const scale = Math.min(1, 400 / Math.max(w, h));
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve([{x: w*0.1, y: h*0.1}, {x: w*0.9, y: h*0.1}, {x: w*0.9, y: h*0.9}, {x: w*0.1, y: h*0.9}]);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Calculate average brightness
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i+1] + data[i+2]) / 3;
      }
      const avg = totalBrightness / (data.length / 4);
      
      // Find bounding box of pixels differing from average (assume document contrasts with background)
      let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          const brightness = (data[idx] + data[idx+1] + data[idx+2]) / 3;
          if (Math.abs(brightness - avg) > 30) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      
      // Convert back to original scale
      if (maxX > minX && maxY > minY) {
        // Add a bit of padding or use the tight bounds
        const padX = (maxX - minX) * 0.05;
        const padY = (maxY - minY) * 0.05;
        minX = Math.max(0, minX - padX);
        maxX = Math.min(canvas.width, maxX + padX);
        minY = Math.max(0, minY - padY);
        maxY = Math.min(canvas.height, maxY + padY);
        
        resolve([
          { x: minX / scale, y: minY / scale },
          { x: maxX / scale, y: minY / scale },
          { x: maxX / scale, y: maxY / scale },
          { x: minX / scale, y: maxY / scale },
        ]);
      } else {
        resolve([{x: w*0.1, y: h*0.1}, {x: w*0.9, y: h*0.1}, {x: w*0.9, y: h*0.9}, {x: w*0.1, y: h*0.9}]);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for detection"));
    img.src = imageSrc;
  });
};

export const applyPerspectiveTransform = async (
  imageSrc: string,
  pts: Point[] // [tl, tr, br, bl]
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate distance between points to find target dimensions
      const tl = pts[0], tr = pts[1], br = pts[2], bl = pts[3];
      const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
      const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
      const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
      const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
      
      const targetW = Math.max(widthTop, widthBottom);
      const targetH = Math.max(heightLeft, heightRight);
      
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(imageSrc);
        return;
      }
      
      // Draw source image to an offscreen canvas to get pixel data
      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = img.width;
      srcCanvas.height = img.height;
      const srcCtx = srcCanvas.getContext("2d");
      if (!srcCtx) {
        resolve(imageSrc);
        return;
      }
      srcCtx.drawImage(img, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, img.width, img.height);
      
      const destData = ctx.createImageData(targetW, targetH);
      
      // Target points (a flat rectangle)
      const targetPts = [
        { x: 0, y: 0 },
        { x: targetW, y: 0 },
        { x: targetW, y: targetH },
        { x: 0, y: targetH }
      ];
      const sourcePts = [
        tl, tr, br, bl
      ];
      
      // Map Target -> Source so we can iterate over target pixels
      const transform = solveHomography(targetPts, sourcePts);
      
      for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
          const [srcX, srcY] = transform(x, y);
          const sx = Math.round(srcX);
          const sy = Math.round(srcY);
          
          if (sx >= 0 && sx < img.width && sy >= 0 && sy < img.height) {
            const destIdx = (y * targetW + x) * 4;
            const srcIdx = (sy * img.width + sx) * 4;
            destData.data[destIdx] = srcData.data[srcIdx];
            destData.data[destIdx+1] = srcData.data[srcIdx+1];
            destData.data[destIdx+2] = srcData.data[srcIdx+2];
            destData.data[destIdx+3] = srcData.data[srcIdx+3];
          }
        }
      }
      
      ctx.putImageData(destData, 0, 0);
      resolve(canvas.toDataURL("image/png", 0.9));
    };
    img.onerror = () => reject(new Error("Failed to load image for transform"));
    img.src = imageSrc;
  });
};
