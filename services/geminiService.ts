
import { GoogleGenAI, Modality, Type } from "@google/genai";

const geminiApiKey =
    import.meta.env.VITE_GEMINI_API_KEY ??
    import.meta.env.VITE_API_KEY ??
    import.meta.env.PUBLIC_GEMINI_API_KEY ??
    '';

const openRouterApiKey =
    import.meta.env.VITE_OPENROUTER_API_KEY ??
    import.meta.env.VITE_OPENROUTER_KEY ??
    import.meta.env.PUBLIC_OPENROUTER_API_KEY ??
    '';

const openRouterBaseUrl =
    (import.meta.env.VITE_OPENROUTER_BASE_URL as string | undefined) ??
    'https://openrouter.ai/api/v1';

const openRouterReferer =
    (import.meta.env.VITE_OPENROUTER_REFERRER ?? import.meta.env.VITE_OPENROUTER_REFERER) as
        | string
        | undefined;

const openRouterTitle = import.meta.env.VITE_OPENROUTER_TITLE as string | undefined;

let client: GoogleGenAI | null = null;

const ensureGeminiClient = (): GoogleGenAI => {
    if (!geminiApiKey) {
        throw new Error(
            'Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment.'
        );
    }

    if (!client) {
        client = new GoogleGenAI({ apiKey: geminiApiKey });
    }

    return client;
};

const getOpenRouterHeaders = (): HeadersInit => {
    if (!openRouterApiKey) {
        throw new Error(
            'OpenRouter API key is not configured. Please set VITE_OPENROUTER_API_KEY in your environment.'
        );
    }

    const headers: Record<string, string> = {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
    };

    if (openRouterReferer) {
        headers["HTTP-Referer"] = openRouterReferer;
    } else if (typeof window !== 'undefined' && window.location) {
        headers["HTTP-Referer"] = window.location.origin;
    }

    if (openRouterTitle) {
        headers["X-Title"] = openRouterTitle;
    }

    return headers;
};

const streamOpenRouterChat = async (
    body: Record<string, unknown>,
    onDelta: (text: string) => void
): Promise<void> => {
    const response = await fetch(`${openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: getOpenRouterHeaders(),
        body: JSON.stringify({ ...body, stream: true }),
    });

    if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
            `OpenRouter request failed with status ${response.status}. ${errorText || response.statusText}`
        );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) {
                continue;
            }

            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
                return;
            }

            try {
                const parsed = JSON.parse(payload);
                const content = parsed?.choices?.[0]?.delta?.content;
                if (Array.isArray(content)) {
                    for (const segment of content) {
                        if (segment?.type === 'output_text' && typeof segment?.text === 'string') {
                            onDelta(segment.text);
                        }
                    }
                } else if (typeof content === 'string') {
                    onDelta(content);
                }
            } catch (error) {
                console.warn('Failed to parse OpenRouter stream chunk', error);
            }
        }
    }
};

export const structureScriptFromText = async (
    text: string,
    onStream: (chunk: string) => void
): Promise<void> => {
    if (openRouterApiKey) {
        await streamOpenRouterChat(
            {
                model: import.meta.env.VITE_OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-lite-preview',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are an assistant that restructures raw narrative text into JSON for video production. ' +
                            'Return ONLY valid JSON following the provided schema and do not include explanations.',
                    },
                    {
                        role: 'user',
                        content: `Take the following text and format it into a structured video script. Break it down into logical scenes. Each scene should have a unique ID and a script. Respond with only the JSON object.\n\nTEXT:\n---\n${text}\n---`,
                    },
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'video_script',
                        schema: {
                            type: 'object',
                            properties: {
                                scenes: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            script: { type: 'string' },
                                        },
                                        required: ['id', 'script'],
                                    },
                                },
                            },
                            required: ['scenes'],
                        },
                    },
                },
            },
            onStream
        );
        return;
    }

    const ai = ensureGeminiClient();

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
    if (!geminiApiKey) {
        throw new Error(
            'Image editing currently requires the Gemini API key. Please configure VITE_GEMINI_API_KEY.'
        );
    }

    const ai = ensureGeminiClient();
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
    if (!geminiApiKey) {
        throw new Error(
            'Video generation currently requires the Gemini API key. Please configure VITE_GEMINI_API_KEY.'
        );
    }

    const ai = ensureGeminiClient();
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
    return `${downloadLink}&key=${geminiApiKey}`;
};


export const generateSpeechFromText = async (
    scriptText: string,
    voiceName: string,
    onAudioChunk: (base64Data: string, mimeType: string) => void
): Promise<void> => {
    if (!geminiApiKey) {
        throw new Error(
            'Text-to-speech currently requires the Gemini API key. Please configure VITE_GEMINI_API_KEY.'
        );
    }

    const ai = ensureGeminiClient();
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
