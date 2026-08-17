import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process image" });
  }
}
