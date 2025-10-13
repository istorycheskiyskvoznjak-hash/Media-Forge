

import React, { useState, useEffect } from 'react';
import { Project, ProjectScene } from '../types';
import * as geminiService from '../services/geminiService';
import Spinner from '../components/Spinner';

// --- WAV Conversion Helpers (adapted for browser from user's example) ---

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function parseMimeType(mimeType: string): WavConversionOptions {
    const defaultOptions = {
        numChannels: 1,
        sampleRate: 24000, // A common default for TTS
        bitsPerSample: 16, // L16 is common
    };

    const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
    const [_, format] = fileType.split('/');

    const options: Partial<WavConversionOptions> = {
        numChannels: 1,
    };

    if (format && format.toUpperCase().startsWith('L')) {
        const bits = parseInt(format.slice(1), 10);
        if (!isNaN(bits)) {
            options.bitsPerSample = bits;
        }
    }

    for (const param of params) {
        const [key, value] = param.split('=').map(s => s.trim());
        if (key.toLowerCase() === 'rate') {
            const rate = parseInt(value, 10);
            if (!isNaN(rate)) {
                options.sampleRate = rate;
            }
        }
    }
    return { ...defaultOptions, ...options } as WavConversionOptions;
}

function createWavHeader(dataLength: number, options: WavConversionOptions): ArrayBuffer {
    const { numChannels, sampleRate, bitsPerSample } = options;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;

    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    // "fmt " sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size for PCM
    view.setUint16(20, 1, true); // AudioFormat 1 for PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // "data" sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    return buffer;
}


interface VoiceoverTestPageProps {
  project: Project;
}

const availableVoices = [
    'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe', 
    'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome', 'Fenrir', 'Gacrux', 
    'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Puck', 'Pulcherrima', 
    'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel', 
    'Vindemiatrix', 'Zephyr', 'Zubenelgenubi'
];

const VoiceoverTestPage: React.FC<VoiceoverTestPageProps> = ({ project }) => {
    const [activeScene, setActiveScene] = useState<ProjectScene | null>(project.scenes[0] || null);
    
    // UI State
    const [scriptText, setScriptText] = useState(project.scenes[0]?.script || '');
    const [selectedVoice, setSelectedVoice] = useState(availableVoices[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (activeScene) {
            setScriptText(activeScene.script);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
            setError(null);
            setIsLoading(false);
        }
    }, [activeScene]);

    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const handleSceneSelect = (scene: ProjectScene) => {
        setActiveScene(scene);
    };

    const handleGenerate = async () => {
        if (!scriptText) return;

        setIsLoading(true);
        setError(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);

        const audioChunks: Uint8Array[] = [];
        let audioMimeType: string | null = null;
        let totalLength = 0;

        try {
            // FIX: Corrected function name from generateSpeechFromTextTest to generateSpeechFromText
            await geminiService.generateSpeechFromText(
                scriptText,
                selectedVoice,
                (data, mimeType) => {
                    if (!audioMimeType) audioMimeType = mimeType;
                    audioChunks.push(data);
                    totalLength += data.length;
                }
            );

            if (audioChunks.length > 0 && audioMimeType) {
                let finalBlob: Blob;
                const mimeTypeLower = audioMimeType.toLowerCase();

                // Check if the mime type indicates raw PCM audio that needs a WAV header
                if (mimeTypeLower.includes('audio/l16') || mimeTypeLower.includes('audio/l24') || mimeTypeLower.includes('audio/pcm')) {
                    const combinedData = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const chunk of audioChunks) {
                        combinedData.set(chunk, offset);
                        offset += chunk.length;
                    }
                    const options = parseMimeType(audioMimeType);
                    const header = createWavHeader(combinedData.length, options);
                    finalBlob = new Blob([header, combinedData], { type: 'audio/wav' });
                } else {
                    // For standard formats like audio/mpeg, just create a blob directly
                    finalBlob = new Blob(audioChunks, { type: audioMimeType });
                }
                const url = URL.createObjectURL(finalBlob);
                setAudioUrl(url);
            } else {
                 throw new Error("AI did not return any audio data.");
            }

        } catch (err) {
            console.error("Voiceover test generation failed:", err);
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(`Failed to generate voiceover: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-100 border-b-2 border-purple-500/30 pb-2">Студия озвучки (Тестовая страница)</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Scene List */}
                <div className="lg:col-span-1 p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700 h-fit">
                    <h3 className="text-xl font-semibold mb-4 text-purple-300">Сцены</h3>
                    <div className="space-y-2">
                        {project.scenes.map(scene => (
                            <div
                                key={scene.id}
                                onClick={() => handleSceneSelect(scene)}
                                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${activeScene?.id === scene.id ? 'bg-purple-800/50' : 'hover:bg-gray-700/50'}`}
                            >
                                <p className="font-bold text-gray-200">Сцена {project.scenes.indexOf(scene) + 1}</p>
                                <p className="text-sm text-gray-400 mt-1 truncate">{scene.script}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Voiceover Studio */}
                <div className="lg:col-span-2 p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700 space-y-6">
                    <div className="flex gap-6">
                        {/* Main Content */}
                        <div className="flex-grow space-y-4 flex flex-col">
                             <div className="flex-grow flex flex-col">
                                <label className="text-sm font-medium text-gray-400 mb-1 block">Текст для озвучки</label>
                                <textarea
                                    value={scriptText}
                                    onChange={(e) => setScriptText(e.target.value)}
                                    className="w-full p-2 bg-gray-900/50 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 flex-grow"
                                    placeholder="Начните писать или вставьте текст для озвучки"
                                    rows={10}
                                />
                            </div>
                             <div className="flex flex-wrap gap-4 items-center pt-4 border-t border-gray-700/60">
                                <button onClick={handleGenerate} disabled={!scriptText || isLoading} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    {isLoading ? <><Spinner /> Генерируем...</> : 'Сгенерировать (Тест)'}
                                </button>
                            </div>
                            <div className="h-24">
                                {error && <p className="text-red-400 text-sm">{error}</p>}
                                {audioUrl && !isLoading && (
                                    <div className="mt-4">
                                        <h4 className="text-md font-semibold text-gray-300 mb-2">Результат:</h4>
                                        <audio controls src={audioUrl} className="w-full" />
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Settings Sidebar */}
                        <aside className="w-64 flex-shrink-0 space-y-6">
                             <div>
                                <label className="text-sm font-medium text-gray-400 mb-2 block">Настройки голоса</label>
                                <div className="p-4 bg-gray-900/50 rounded-md border border-gray-600 space-y-4">
                                     <div>
                                        <label htmlFor="voice-select" className="block text-sm text-gray-300 mb-1">Голос</label>
                                        <select 
                                            id="voice-select"
                                            value={selectedVoice}
                                            onChange={e => setSelectedVoice(e.target.value)}
                                            className="w-full p-2 bg-gray-700 rounded-md border border-gray-500 focus:ring-2 focus:ring-purple-500"
                                            disabled={isLoading}
                                        >
                                            {availableVoices.map(voice => <option key={voice} value={voice}>{voice}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceoverTestPage;
