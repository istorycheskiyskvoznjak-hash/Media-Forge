
import React, { useState, useEffect, useCallback } from 'react';
import { Project, ProjectScene } from '../types';
import * as geminiService from '../services/geminiService';
import Spinner from '../components/Spinner';

// --- WAV Conversion Helpers ---
// (These helpers are kept as they are essential for audio processing)
interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function parseMimeType(mimeType: string): WavConversionOptions {
    const defaultOptions = { numChannels: 1, sampleRate: 24000, bitsPerSample: 16 };
    const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
    const [_, format] = fileType.split('/');
    const options: Partial<WavConversionOptions> = { numChannels: 1 };
    if (format && format.toUpperCase().startsWith('L')) {
        const bits = parseInt(format.slice(1), 10);
        if (!isNaN(bits)) options.bitsPerSample = bits;
    }
    for (const param of params) {
        const [key, value] = param.split('=').map(s => s.trim());
        if (key.toLowerCase() === 'rate') {
            const rate = parseInt(value, 10);
            if (!isNaN(rate)) options.sampleRate = rate;
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
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    return buffer;
}


// --- MOCK DATA & CONFIG ---
type ScenarioStatus = 'Опубликовано' | 'В работе' | 'В ящик';
const mockScenarios: { id: string; title: string; status: ScenarioStatus }[] = [
    { id: 'scen-001', title: 'Сценарий №001: Project 001: Neon City', status: 'В работе' },
    { id: 'scen-002', title: 'Сценарий №002: Forgotten Kingdom', status: 'В ящик' },
    { id: 'scen-003', title: 'Сценарий №003: Deep Space Anomaly', status: 'Опубликовано' },
    { id: 'scen-004', title: 'Сценарий №004: Steampunk Detective', status: 'В работе' },
    { id: 'scen-005', title: 'Сценарий №005: Whispering Forest', status: 'В работе' },
];
const statusColors: Record<ScenarioStatus, string> = {
    'Опубликовано': 'bg-green-500/20 text-green-300 border border-green-500/30',
    'В работе': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    'В ящик': 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};
const availableVoices = ['Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe', 'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome', 'Fenrir', 'Gacrux', 'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Puck', 'Pulcherrima', 'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel', 'Vindemiatrix', 'Zephyr', 'Zubenelgenubi'];
const emotionPrompts = [
    { label: 'Грубо', value: '(говорит грубо) ' },
    { label: 'Нервно', value: '(говорит нервничая) ' },
    { label: 'Тараторит', value: '(говорит быстро, тараторит) ' },
    { label: 'Шепотом', value: '(говорит шепотом) ' },
    { label: 'Восторженно', value: '(говорит восторженно) ' },
    { label: 'Устало', value: '(говорит устало) ' },
    { label: 'Зловеще', value: '(говорит зловеще) ' },
];

// --- PAGE PROPS ---
interface VoiceoverPageProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

const VoiceoverPage: React.FC<VoiceoverPageProps> = ({ project, onUpdateProject }) => {
    // State
    const [activeScenarioId, setActiveScenarioId] = useState<string>(mockScenarios[0].id);
    const [activeExcerptId, setActiveExcerptId] = useState<string | null>(null);
    
    const [scriptText, setScriptText] = useState('');
    const [selectedVoice, setSelectedVoice] = useState(availableVoices[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [isMarkingStress, setIsMarkingStress] = useState(false);
    const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const activeScenario = mockScenarios.find(s => s.id === activeScenarioId);
    const activeExcerpt = project.scenes.find(s => s.id === activeExcerptId);

    // Revoke object URLs on cleanup
    useEffect(() => {
        return () => {
            if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
            // Also revoke history URLs when component unmounts
            project.scenes.forEach(scene => {
                scene.voiceoverHistory.forEach(h => URL.revokeObjectURL(h.url));
            });
        };
    }, [currentAudioUrl, project.scenes]);

    const handleSelectExcerpt = useCallback((scene: ProjectScene) => {
        setActiveExcerptId(scene.id);
        setScriptText(scene.script);
        setCurrentAudioUrl(null);
        setError(null);
    }, []);

    const handleAddEmotion = (prompt: string) => {
        // Remove existing prompts before adding a new one
        const cleanText = scriptText.replace(/^\([\s\S]*?\)\s*/, '');
        setScriptText(prompt + cleanText);
    };
    
    const handleStressMarking = async () => {
        if (!scriptText) return;
        setIsMarkingStress(true);
        setError(null);
        try {
            const textWithStress = await geminiService.addStressMarksToText(scriptText);
            setScriptText(textWithStress);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка при расстановке ударений.";
            setError(`Ошибка ударений: ${errorMessage}`);
        } finally {
            setIsMarkingStress(false);
        }
    };


    const handleGenerate = async () => {
        if (!scriptText || !activeExcerpt) return;

        setIsLoading(true);
        setError(null);
        if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
        setCurrentAudioUrl(null);

        const audioChunks: Uint8Array[] = [];
        let audioMimeType: string | null = null;
        let totalLength = 0;

        try {
            await geminiService.generateSpeechFromText(scriptText, selectedVoice, (data, mimeType) => {
                if (!audioMimeType) audioMimeType = mimeType;
                audioChunks.push(data);
                totalLength += data.length;
            });

            if (audioChunks.length > 0 && audioMimeType) {
                const mimeTypeLower = audioMimeType.toLowerCase();
                let finalBlob: Blob;
                if (mimeTypeLower.includes('audio/l16') || mimeTypeLower.includes('audio/l24') || mimeTypeLower.includes('audio/pcm')) {
                    const combinedData = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const chunk of audioChunks) combinedData.set(chunk, offset), offset += chunk.length;
                    const options = parseMimeType(audioMimeType);
                    const header = createWavHeader(combinedData.length, options);
                    finalBlob = new Blob([header, combinedData], { type: 'audio/wav' });
                } else {
                    finalBlob = new Blob(audioChunks, { type: audioMimeType });
                }
                const url = URL.createObjectURL(finalBlob);
                setCurrentAudioUrl(url);

                // --- UPDATE PROJECT HISTORY ---
                const newHistoryItem = {
                    id: Date.now().toString(),
                    url: url,
                    timestamp: new Date().toISOString(),
                    voice: selectedVoice,
                };

                const updatedHistory = [newHistoryItem, ...activeExcerpt.voiceoverHistory].slice(0, 5);
                
                // Revoke URL of the oldest item if it's being removed
                if (activeExcerpt.voiceoverHistory.length >= 5) {
                    URL.revokeObjectURL(activeExcerpt.voiceoverHistory[4].url);
                }

                const updatedScene = { ...activeExcerpt, voiceoverHistory: updatedHistory };
                const updatedScenes = project.scenes.map(s => s.id === updatedScene.id ? updatedScene : s);
                onUpdateProject({ ...project, scenes: updatedScenes });
                // --- END UPDATE ---

            } else {
                throw new Error("AI не вернул аудиоданные.");
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            try {
                const parsedError = JSON.parse(errorMessage);
                setError(`Ошибка: ${parsedError?.error?.message || "Не удалось разобрать ошибку."}`);
            } catch {
                setError(`Ошибка: ${errorMessage}`);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-100 border-b-2 border-purple-500/30 pb-2">Студия озвучки</h1>
            <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
                {/* Scenarios Column */}
                <div className="col-span-3 bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4 flex flex-col">
                    <h3 className="text-xl font-semibold text-purple-300 mb-4 flex-shrink-0">Сценарии</h3>
                    <div className="space-y-2 overflow-y-auto pr-2 -mr-2">
                        {[...mockScenarios].reverse().map(scenario => (
                            <div key={scenario.id} onClick={() => { setActiveScenarioId(scenario.id); setActiveExcerptId(null); }} className={`p-3 rounded-lg cursor-pointer transition-colors ${activeScenarioId === scenario.id ? 'bg-purple-900/70' : 'hover:bg-gray-700/50 bg-gray-900/50'}`}>
                                <div className="flex justify-between items-center">
                                    <p className="font-bold text-gray-200 truncate pr-2">{scenario.title}</p>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${statusColors[scenario.status]}`}>{scenario.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Excerpts & History Column */}
                <div className="col-span-4 bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4 flex flex-col">
                    <h3 className="text-xl font-semibold text-purple-300 mb-4 flex-shrink-0">Отрывки из "{activeScenario?.title}"</h3>
                    <div className="space-y-4 overflow-y-auto pr-2 -mr-2">
                        {(activeScenarioId === 'scen-001' ? project.scenes : []).map((scene, index) => (
                            <div key={scene.id} className={`p-3 rounded-lg transition-colors ${activeExcerptId === scene.id ? 'bg-gray-900/80 border border-purple-500/50' : 'bg-gray-900/50'}`}>
                                <div onClick={() => handleSelectExcerpt(scene)} className="cursor-pointer">
                                    <p className="font-bold text-gray-200">Отрывок #{index + 1}</p>
                                    <p className="text-sm text-gray-400 mt-1 truncate">{scene.script}</p>
                                </div>
                                {scene.voiceoverHistory.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase">Последние 5 дублей</h4>
                                        {scene.voiceoverHistory.map(h => (
                                            <div key={h.id} className="flex items-center gap-2">
                                                <audio src={h.url} controls className="w-full h-8" />
                                                <div className="text-xs text-gray-400 whitespace-nowrap w-12 text-right" title={new Date(h.timestamp).toLocaleString()}>{h.voice.substring(0,3)}...</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Workspace Column */}
                <div className="col-span-5 bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4 flex flex-col space-y-4">
                    {!activeExcerpt ? (
                        <div className="flex-grow flex items-center justify-center text-gray-500">Выберите отрывок для начала работы</div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Инструменты</label>
                                <div className="flex flex-wrap gap-2">
                                    {emotionPrompts.map(p => (
                                        <button key={p.label} onClick={() => handleAddEmotion(p.value)} className="px-2 py-1 bg-gray-700 hover:bg-purple-700 rounded-md text-xs font-medium transition-colors">{p.label}</button>
                                    ))}
                                    <button
                                        onClick={handleStressMarking}
                                        disabled={isLoading || isMarkingStress || !scriptText}
                                        className="px-3 py-1 bg-gray-700 hover:bg-indigo-700 rounded-md text-xs font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isMarkingStress ? <><Spinner size="h-4 w-4" />Обработка...</> : 'Поставить ударения (+)'}
                                    </button>
                                </div>
                            </div>
                            <div className="flex-grow flex flex-col">
                                <label className="text-sm font-medium text-gray-400 mb-1 block">Текст для озвучки</label>
                                <textarea
                                    value={scriptText}
                                    onChange={(e) => setScriptText(e.target.value)}
                                    className="w-full p-2 bg-gray-900/50 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 flex-grow"
                                    rows={8}
                                />
                            </div>
                             <div className="flex items-center gap-4">
                                <div>
                                    <label htmlFor="voice-select" className="block text-sm text-gray-300 mb-1">Голос</label>
                                    <select id="voice-select" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)} className="w-full p-2 bg-gray-700 rounded-md border border-gray-500 focus:ring-2 focus:ring-purple-500" disabled={isLoading}>
                                        {availableVoices.map(voice => <option key={voice} value={voice}>{voice}</option>)}
                                    </select>
                                </div>
                                <div className="flex-grow pt-6">
                                    <button onClick={handleGenerate} disabled={!scriptText || isLoading} className="w-full px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                        {isLoading ? <><Spinner size="h-5 w-5" /> Генерируем...</> : 'Сгенерировать'}
                                    </button>
                                </div>
                            </div>
                            <div className="h-24">
                                {error && <p className="text-red-400 text-sm p-2 bg-red-900/20 rounded-md">{error}</p>}
                                {currentAudioUrl && !isLoading && (
                                    <div className="mt-2">
                                        <h4 className="text-md font-semibold text-gray-300 mb-2">Текущий результат:</h4>
                                        <audio controls autoPlay src={currentAudioUrl} className="w-full" />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VoiceoverPage;