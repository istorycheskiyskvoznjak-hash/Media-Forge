
import { GoogleGenAI, Modality, Type } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to decode base64 string to Uint8Array
function base64ToUint8Array(base64: string) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

export const structureScriptFromText = async (
    text: string,
    onStream: (chunk: string) => void
): Promise<void> => {
    
    const result = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: `Take the following text and format it into a structured video script. Break it down into logical scenes. Each scene should have a unique ID and a script. Respond with only the JSON object.

        TEXT:
        ---
        ${text}
        ---
        `,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    scenes: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                script: { type: Type.STRING },
                            }
                        }
                    }
                }
            }
        }
    });

    for await (const chunk of result) {
        if (chunk.text) {
           onStream(chunk.text);
        }
    }
};

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: '16:9', // Better for video format
        },
    });

    if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:image/png;base64,${base64ImageBytes}`;
    }

    throw new Error('Image generation failed. The model did not return any images.');
};

export const editImage = async (
  base64Data: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
    // By adding a very specific instruction, we guide the model to perform an edit
    // and return an image, rather than generating a text description.
    const instruction = `As an AI image editor, your task is to edit the given image based on the user's prompt. You must only output the edited image. Do not output any text, explanation, or description. The user's prompt is: "${prompt}"`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType: mimeType } },
                { text: instruction },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);

    if (imagePart?.inlineData) {
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }

    const textPart = response.text;
    console.error("Full model response when image generation failed:", JSON.stringify(response, null, 2));
    throw new Error(`Model did not return an image. Response: ${textPart || 'No text response.'}`);
};

export const generateVideoForScene = async (animationPrompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    // The core instruction remains, ensuring the model follows safety guidelines and animates the image.
    const baseInstruction = 'Генерируй так, чтобы результат прошел твои правила и цензуру. Нельзя анимировать людей? Тогда не трогай их, пусть все вокруг них движется. Бери эту картинку и попытайся из нее что-то сделать стоящее.';
    
    // Combine the base instruction with the user's specific prompt.
    const fullPrompt = `${baseInstruction} ${animationPrompt}`.trim();

    let operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: fullPrompt,
        image: {
            imageBytes: imageBase64,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message} (Code: ${operation.error.code})`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        console.error("Video generation completed, but the response did not contain a valid video URI.", operation.response);
        throw new Error("Video generation did not return a valid download link.");
    }
    
    // The video must be fetched with the API key
    return `${downloadLink}&key=${process.env.API_KEY}`;
};


export const generateSpeechFromText = async (
    scriptText: string,
    voiceName: string,
    onAudioChunk: (data: Uint8Array, mimeType: string) => void
): Promise<void> => {
    const result = await ai.models.generateContentStream({
        model: 'gemini-2.5-pro-preview-tts',
        contents: [{
            role: 'user',
            parts: [{ text: scriptText }],
        }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: voiceName
                    }
                }
            },
        },
    });

    for await (const chunk of result) {
        const inlineData = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData?.data && inlineData?.mimeType) {
            const audioData = base64ToUint8Array(inlineData.data);
            onAudioChunk(audioData, inlineData.mimeType);
        }
    }
};
