
import { GoogleGenAI, Modality, Type } from "@google/genai";

const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ??
    import.meta.env.VITE_API_KEY ??
    import.meta.env.PUBLIC_GEMINI_API_KEY ??
    '';

let client: GoogleGenAI | null = null;

const getClient = (): GoogleGenAI => {
    if (!apiKey) {
        throw new Error(
            'Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment.'
        );
    }

    if (!client) {
        client = new GoogleGenAI({ apiKey });
    }

    return client;
};

export const structureScriptFromText = async (
    text: string,
    onStream: (chunk: string) => void
): Promise<void> => {
    const ai = getClient();

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

export const editImage = async (
  base64Data: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType: mimeType } },
                { text: prompt },
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
    throw new Error(`Model did not return an image. Response: ${textPart || 'No text response.'}`);
};

export const generateVideoForScene = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    const ai = getClient();
    let operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: prompt,
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
    return `${downloadLink}&key=${apiKey}`;
};


export const generateSpeechFromText = async (
    scriptText: string,
    voiceName: string,
    onAudioChunk: (base64Data: string, mimeType: string) => void
): Promise<void> => {
    const ai = getClient();
    const result = await ai.models.generateContentStream({
        model: 'gemini-2.5-pro-preview-tts',
        contents: [{
            role: 'user',
            parts: [{ text: scriptText }],
        }],
        config: {
            responseModalities: ['audio'],
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
            onAudioChunk(inlineData.data, inlineData.mimeType);
        }
    }
};
