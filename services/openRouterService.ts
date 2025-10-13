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

type OpenRouterContent = {
    type?: string;
    text?: string;
    data?: string;
    mime_type?: string;
    mimeType?: string;
    url?: string;
    image_url?: {
        url?: string;
    };
    b64_json?: string;
    base64?: string;
    audio?: {
        data: string;
        mime_type: string;
    };
    [key: string]: unknown;
};

type OpenRouterResponse = {
    output?: Array<{
        content?: OpenRouterContent[];
    }>;
    data?: Array<{
        content?: OpenRouterContent[];
    }>;
    choices?: Array<{
        message?: {
            content?: OpenRouterContent[] | string;
        };
    }>;
    error?: { message?: string };
    [key: string]: unknown;
};

const getOpenRouterHeaders = (): HeadersInit => {
    if (!openRouterApiKey) {
        throw new Error(
            'OpenRouter API key is not configured. Please set VITE_OPENROUTER_API_KEY in your environment.'
        );
    }

    const headers: Record<string, string> = {
        Authorization: `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
    };

    if (openRouterReferer) {
        headers['HTTP-Referer'] = openRouterReferer;
    } else if (typeof window !== 'undefined' && window.location) {
        headers['HTTP-Referer'] = window.location.origin;
    }

    if (openRouterTitle) {
        headers['X-Title'] = openRouterTitle;
    }

    return headers;
};

const ensureOk = async (response: Response): Promise<Response> => {
    if (response.ok) {
        return response;
    }

    let detail = '';
    try {
        detail = await response.text();
    } catch (error) {
        console.warn('Failed to read OpenRouter error response', error);
    }

    throw new Error(
        `OpenRouter request failed with status ${response.status}. ${detail || response.statusText}`
    );
};

const rethrowNetworkError = (error: unknown): never => {
    if (error instanceof TypeError) {
        throw new Error(
            'Failed to reach OpenRouter. Please verify your network connection, API key, and that browser requests to the OpenRouter endpoint are allowed.'
        );
    }

    throw error instanceof Error ? error : new Error(String(error));
};

const streamOpenRouterChat = async (
    body: Record<string, unknown>,
    onDelta: (text: string) => void
): Promise<void> => {
    let rawResponse: Response;
    try {
        rawResponse = await fetch(`${openRouterBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: getOpenRouterHeaders(),
            body: JSON.stringify({ ...body, stream: true }),
        });
    } catch (error) {
        rethrowNetworkError(error);
    }

    const response = await ensureOk(rawResponse);

    if (!response.body) {
        throw new Error('OpenRouter response did not include a streaming body.');
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

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
    const raw = await response.text();
    try {
        return JSON.parse(raw) as T;
    } catch {
        const snippet = raw.trim().slice(0, 200);
        throw new Error(
            snippet
                ? `OpenRouter returned a non-JSON response: ${snippet}`
                : 'OpenRouter returned an empty response.'
        );
    }
};

const callOpenRouterResponses = async (body: Record<string, unknown>): Promise<OpenRouterResponse> => {
    let rawResponse: Response;
    try {
        rawResponse = await fetch(`${openRouterBaseUrl}/responses`, {
            method: 'POST',
            headers: getOpenRouterHeaders(),
            body: JSON.stringify(body),
        });
    } catch (error) {
        rethrowNetworkError(error);
    }

    const response = await ensureOk(rawResponse);

    return parseJsonResponse<OpenRouterResponse>(response);
};

const callOpenRouterChat = async (body: Record<string, unknown>): Promise<OpenRouterResponse> => {
    let rawResponse: Response;
    try {
        rawResponse = await fetch(`${openRouterBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: getOpenRouterHeaders(),
            body: JSON.stringify(body),
        });
    } catch (error) {
        rethrowNetworkError(error);
    }

    const response = await ensureOk(rawResponse);

    return parseJsonResponse<OpenRouterResponse>(response);
};

const collectContent = (payload: OpenRouterResponse): OpenRouterContent[] => {
    const buckets: OpenRouterContent[] = [];

    const pushContent = (items: OpenRouterContent[] | string | undefined) => {
        if (!items) {
            return;
        }

        if (typeof items === 'string') {
            buckets.push({ type: 'output_text', text: items });
            return;
        }

        for (const item of items) {
            if (item) {
                if (item.image_url?.url) {
                    buckets.push({
                        type: item.type ?? 'output_image',
                        url: item.image_url.url,
                    });
                    continue;
                }
                buckets.push(item);
            }
        }
    };

    if (Array.isArray(payload.output)) {
        for (const entry of payload.output) {
            pushContent(entry?.content);
        }
    }

    if (Array.isArray(payload.data)) {
        for (const entry of payload.data) {
            pushContent(entry?.content);
        }
    }

    if (Array.isArray(payload.choices)) {
        for (const choice of payload.choices) {
            pushContent(choice?.message?.content);
        }
    }

    return buckets;
};

export const structureScriptFromText = async (
    text: string,
    onStream: (chunk: string) => void
): Promise<void> => {
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
};

export const editImage = async (
    base64Data: string,
    mimeType: string,
    prompt: string
): Promise<string> => {
    const imageModel =
        import.meta.env.VITE_OPENROUTER_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image';

    const response = await callOpenRouterChat({
        model: imageModel,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image_url',
                        image_url: { url: `data:${mimeType};base64,${base64Data}` },
                    },
                ],
            },
        ],
    });

    const contents = collectContent(response);

    for (const part of contents) {
        const imageBase64 =
            typeof part?.data === 'string'
                ? part.data
                : part?.b64_json ??
                  part?.base64 ??
                  (typeof part?.url === 'string' && part.url.startsWith('data:')
                      ? part.url.split(',')[1]
                      : undefined);

        const partMimeType = part?.mimeType ?? part?.mime_type ?? mimeType;

        if (part?.type === 'output_image' || part?.type === 'image' || imageBase64) {
            if (part?.url && part.url.startsWith('http')) {
                return part.url;
            }

            if (imageBase64) {
                return `data:${partMimeType};base64,${imageBase64}`;
            }
        }
    }

    const textResponse = contents.find((part) => typeof part?.text === 'string')?.text;
    if (textResponse) {
        throw new Error(`Model did not return an image. Response: ${textResponse}`);
    }

    throw new Error('Model did not return an image.');
};

export const generateVideoForScene = async (
    prompt: string,
    imageBase64: string,
    mimeType: string
): Promise<string> => {
    const response = await callOpenRouterResponses({
        model:
            import.meta.env.VITE_OPENROUTER_VIDEO_MODEL ??
            import.meta.env.VITE_OPENROUTER_MODEL ??
            'google/gemini-2.0-flash-lite-preview',
        input: [
            {
                role: 'user',
                content: [
                    { type: 'input_text', text: prompt },
                    { type: 'input_image', image: `data:${mimeType};base64,${imageBase64}` },
                ],
            },
        ],
    });

    const contents = collectContent(response);

    for (const part of contents) {
        if (part?.type === 'output_video' || part?.type === 'video') {
            if (typeof part?.url === 'string') {
                return part.url;
            }

            const videoBase64 = part?.data ?? part?.b64_json ?? part?.base64;
            const partMimeType = part?.mimeType ?? part?.mime_type ?? 'video/mp4';
            if (videoBase64) {
                return `data:${partMimeType};base64,${videoBase64}`;
            }
        }
    }

    const textResponse = contents.find((part) => typeof part?.text === 'string')?.text;
    if (textResponse) {
        throw new Error(`Model did not return a video. Response: ${textResponse}`);
    }

    throw new Error('Model did not return a video.');
};

export const generateSpeechFromText = async (
    scriptText: string,
    voiceName: string,
    onAudioChunk: (base64Data: string, mimeType: string) => void
): Promise<void> => {
    const response = await callOpenRouterResponses({
        model:
            import.meta.env.VITE_OPENROUTER_TTS_MODEL ??
            import.meta.env.VITE_OPENROUTER_MODEL ??
            'google/gemini-2.0-flash-lite-preview',
        input: [
            {
                role: 'user',
                content: [
                    { type: 'input_text', text: scriptText },
                    { type: 'input_text', text: `Voice: ${voiceName}` },
                ],
            },
        ],
    });

    const contents = collectContent(response);
    let emitted = false;

    for (const part of contents) {
        const audio = part?.audio;
        if (audio?.data && audio?.mime_type) {
            emitted = true;
            onAudioChunk(audio.data, audio.mime_type);
            continue;
        }

        const audioBase64 = part?.data ?? part?.b64_json ?? part?.base64;
        const partMimeType = part?.mimeType ?? part?.mime_type;
        if ((part?.type === 'output_audio' || part?.type === 'audio') && audioBase64 && partMimeType) {
            emitted = true;
            onAudioChunk(audioBase64, partMimeType);
        }
    }

    if (!emitted) {
        const textResponse = contents.find((part) => typeof part?.text === 'string')?.text;
        throw new Error(
            textResponse
                ? `Model did not return audio. Response: ${textResponse}`
                : 'Model did not return audio.'
        );
    }
};
