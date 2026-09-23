import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

async function generateLogo() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Error: GEMINI_API_KEY environment variable is not set.");
        process.exit(1);
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `A premium, modern logo for a healthcare management application called 'Neurogestor'. 
    The design should be minimalist, sleek, and highly professional. 
    It should incorporate a subtle nod to a brain or neural network intertwining with a shield, checkmark, or growth chart to signify management and trust. 
    The color palette should feature deep medical blue and vibrant cyan or teal, conveying technology, care, and precision. 
    The text 'Neurogestor' should be written in a clean, modern, sans-serif font below or beside the icon. 
    Clean background, high resolution, suitable for a modern web application dashboard.`;

        console.log("Generating image with Gemini 3 Pro Image...");

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: prompt,
            config: {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    imageSize: '1K',
                    aspectRatio: '1:1'
                }
            }
        });

        const outputDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const imgPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imgPart && imgPart.inlineData) {
            const buffer = Buffer.from(imgPart.inlineData.data, 'base64');
            const outputPath = path.join(outputDir, 'neurogestor-logo.jpg');
            fs.writeFileSync(outputPath, buffer);
            console.log(`Logo successfully generated and saved to ${outputPath}`);
        } else {
            console.log("No image data returned from API.");
            console.dir(response, { depth: null });
        }

    } catch (error) {
        console.error(`Error generating logo:`, error);
        process.exit(1);
    }
}

generateLogo();
