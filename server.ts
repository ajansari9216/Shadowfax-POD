import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse large JSON bodies for images
  app.use(express.json({ limit: "50mb" }));

  // API route for Gemini Vision
  app.post("/api/ocr", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            text: "Extract ALL exact AWB text values strictly from the 'AWB Ref No' column in this image. Ignore other columns like Shipment No or Return No. Also provide their bounding boxes. Treat the image dimensions as 1000x1000 for coordinates. ymin/xmin/ymax/xmax should be scaled to a 1000x1000 grid. Provide the response as JSON."
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64
            }
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: {
                  type: Type.STRING,
                  description: "The exact AWB number text."
                },
                bbox: {
                  type: Type.OBJECT,
                  description: "Bounding box coordinates on a 1000x1000 grid.",
                  properties: {
                    x0: { type: Type.NUMBER, description: "Left (xmin)" },
                    y0: { type: Type.NUMBER, description: "Top (ymin)" },
                    x1: { type: Type.NUMBER, description: "Right (xmax)" },
                    y1: { type: Type.NUMBER, description: "Bottom (ymax)" }
                  },
                  required: ["x0", "y0", "x1", "y1"]
                }
              },
              required: ["text", "bbox"]
            }
          }
        }
      });
      
      const result = JSON.parse(response.text || "[]");
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
