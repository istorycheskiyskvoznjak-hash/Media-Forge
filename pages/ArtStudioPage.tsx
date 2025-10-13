import React, { useState, useEffect, useCallback } from 'react';
import { Project, ProjectScene } from '../types';
import * as geminiService from '../services/geminiService';
import Spinner from '../components/Spinner';

// --- ICONS ---
const ArrowLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
);
const TransferIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
);
const SaveIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
);


// --- MOCK DATA ---
type ScenarioStatus = 'Опубликовано' | 'В работе' | 'В ящик';
const mockScenarios: { id: string; title: string; excerpts: any[]; status: ScenarioStatus }[] = [
    {
        id: 'scen-001',
        title: 'Сценарий №001: Project 001: Neon City',
        status: 'В работе',
        excerpts: [{
            id: 'ex-1-1',
            title: 'Отрывок #1',
            scenes: [
                { id: 'scene-1', script: 'A solitary figure stands on a neon-lit rooftop, cinematic shot...' },
                { id: 'scene-2', script: 'Close up on the figure pulling up their collar, face hidden in shadow...' },
                { id: 'scene-3', script: 'Wide shot of a flying vehicle zipping past in the distance...' },
            ]
        }]
    },
    {
        id: 'scen-002',
        title: 'Сценарий №002: Forgotten Kingdom',
        status: 'В ящик',
        excerpts: [
            { id: 'ex-2-1', title: 'Отрывок #1', scenes: [{ id: 'scene-2-1-1', script: 'Ancient ruins overgrown with glowing flora...' }] },
            { id: 'ex-2-2', title: 'Отрывок #2', scenes: [{ id: 'scene-2-2-1', script: 'A lone explorer discovers a hidden artifact...' }] },
        ]
    },
    {
        id: 'scen-003',
        title: 'Сценарий №003: Deep Space Anomaly',
        status: 'Опубликовано',
        excerpts: [{
            id: 'ex-3-1',
            title: 'Отрывок #1',
            scenes: [
                { id: 'scene-3-1-1', script: 'The spaceship approaches a swirling nebula...' },
                { id: 'scene-3-1-2', script: 'Interior shot, the crew looks at the viewscreen in awe...' },
            ]
        }]
    },
    {
        id: 'scen-004',
        title: 'Сценарий №004: Steampunk Detective',
        status: 'В работе',
        excerpts: [
            { id: 'ex-4-1', title: 'Отрывок #1', scenes: [{ id: 'scene-4-1-1', script: 'A cobblestone street shrouded in fog, gaslights flickering...' }] },
            { id: 'ex-4-2', title: 'Отрывок #2', scenes: [{ id: 'scene-4-2-1', script: 'The detective examines a clue with a magnifying glass...' }] },
        ]
    },
    {
        id: 'scen-005',
        title: 'Сценарий №005: Whispering Forest',
        status: 'В работе',
        excerpts: [{
            id: 'ex-5-1',
            title: 'Отрывок #1',
            scenes: [
                { id: 'scene-5-1-1', script: 'Sunlight filtering through a dense, magical forest canopy...' },
                { id: 'scene-5-1-2', script: 'A mythical creature peeks from behind an ancient tree...' },
            ]
        }]
    }
];
const statusColors: Record<ScenarioStatus, string> = {
    'Опубликовано': 'bg-green-500/20 text-green-300 border border-green-500/30',
    'В работе': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    'В ящик': 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};


// --- PROMPT FILTERS ---
type PromptFilterOption = { name: string; value: string };
const promptFilters: { category: string; options: PromptFilterOption[] }[] = [
    { category: 'Освещение', options: [{ name: 'Кино', value: ', cinematic lighting' }, { name: 'Неон', value: ', neon ambiance' }, { name: 'Драма', value: ', dramatic lighting' }] },
    { category: 'Ракурс', options: [{ name: 'Широкий', value: ', wide angle shot' }, { name: 'Крупный план', value: ', close-up shot' }, { name: 'Сверху', value: ', overhead shot' }] },
    { category: 'Погода', options: [{ name: 'Дождь', value: ', heavy rain' }, { name: 'Туман', value: ', dense fog' }, { name: 'Снег', value: ', gentle snowfall' }] },
    { category: 'Настроение', options: [{ name: 'Мрачное', value: ', moody atmosphere' }, { name: 'Эпичное', value: ', epic and grand' }, { name: 'Нуар', value: ', film noir style' }] }
];

const PromptFilters: React.FC<{ onSelect: (value: string) => void }> = ({ onSelect }) => (
    <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">Фильтры промпта</label>
        <div className="space-y-3">
            {promptFilters.map(filter => (
                <div key={filter.category}>
                    <p className="text-xs text-gray-500 uppercase font-semibold">{filter.category}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {filter.options.map(opt => (
                            <button key={opt.name} onClick={() => onSelect(opt.value)} className="px-2 py-1 bg-gray-700 hover:bg-purple-700 rounded-md text-xs font-medium transition-colors">
                                {opt.name}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);


// --- VIDEO PREVIEW ---
const videoLoadingMessages = ["Choreographing pixels...", "Rendering digital starlight...", "This can take a few minutes...", "The creative AI is deep in thought..."];

interface VideoPreviewProps {
    scene: ProjectScene | undefined;
    onGenerate: () => void;
    onSave: () => void;
    animationPrompt: string;
    setAnimationPrompt: (prompt: string) => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ scene, onGenerate, onSave, animationPrompt, setAnimationPrompt }) => {
    const [loadingMessage, setLoadingMessage] = useState(videoLoadingMessages[0]);
    
    useEffect(() => {
        let interval: number;
        if (scene?.isProcessingVideo) {
            interval = window.setInterval(() => {
                setLoadingMessage(prev => {
                    const nextIndex = (videoLoadingMessages.indexOf(prev) + 1) % videoLoadingMessages.length;
                    return videoLoadingMessages[nextIndex];
                });
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [scene?.isProcessingVideo]);

    const canSave = !!scene?.generatedImage && !!scene?.generatedVideoUrl;

    return (
        <div className="pt-6 border-t border-gray-700/60">
            <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-semibold text-purple-300">Анимация сцены</h3>
                 <button
                    onClick={onSave}
                    disabled={!canSave || scene?.isProcessingVideo}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold transition-all text-white disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                    <SaveIcon className="w-5 h-5" />
                    Сохранить и продолжить
                </button>
            </div>
            
            <div className="w-full max-w-lg mx-auto aspect-video bg-gray-900/50 rounded-lg flex items-center justify-center border-2 border-gray-700 overflow-hidden relative mb-4">
                {scene?.isProcessingVideo ? (
                    <div className="text-center">
                        <Spinner />
                        <p className="text-gray-400 mt-4 animate-pulse">{loadingMessage}</p>
                    </div>
                ) : scene?.generatedVideoUrl ? (
                    <video src={scene.generatedVideoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                ) : (
                     <p className="text-gray-500 px-4 text-center">Сгенерируйте изображение, чтобы его анимировать.</p>
                )}
            </div>

             {scene?.generatedImage && (
                <div className="max-w-lg mx-auto space-y-3">
                    <label htmlFor="animation-prompt" className="block text-sm font-medium text-gray-400">Дополнение к промпту анимации</label>
                    <textarea 
                        id="animation-prompt"
                        value={animationPrompt}
                        onChange={(e) => setAnimationPrompt(e.target.value)}
                        rows={2}
                        className="w-full p-2 bg-gray-900/50 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500"
                        placeholder="e.g., subtle camera pan to the right, falling rain..."
                        disabled={scene.isProcessingVideo || scene.isProcessingImage}
                    />
                    <button 
                        onClick={onGenerate} 
                        disabled={scene.isProcessingVideo || scene.isProcessingImage} 
                        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold transition-colors text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {scene.isProcessingVideo ? 'Создание...' : 'Анимировать сцену'}
                    </button>
                </div>
            )}
        </div>
    );
};

// --- ART STUDIO PAGE ---
interface ArtStudioPageProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

const ArtStudioPage: React.FC<ArtStudioPageProps> = ({ project, onUpdateProject }) => {
    const [activeSceneId, setActiveSceneId] = useState<string | null>(project.scenes[0]?.id || null);
    const [imagePrompt, setImagePrompt] = useState('');
    const [animationPrompt, setAnimationPrompt] = useState('');
    const [sidebarView, setSidebarView] = useState<'details' | 'list'>('list');
    const [activeScenarioId, setActiveScenarioId] = useState<string>(mockScenarios[0].id);

    const activeScenario = mockScenarios.find(s => s.id === activeScenarioId);
    const activeScene = project.scenes.find(s => s.id === activeSceneId);

    useEffect(() => {
        // Find the script from mock data if the active scene exists in the mock scenario
        // This is a bridge between the prop data (project) and local mock data
        const sceneFromMock = activeScenario?.excerpts.flatMap(e => e.scenes).find(s => s.id === activeSceneId);
        setImagePrompt(sceneFromMock?.script || activeScene?.script || 'A beautiful, detailed image.');
    }, [activeSceneId, activeScenario, activeScene]);
    
    const updateScene = useCallback((updatedScene: ProjectScene) => {
        const updatedScenes = project.scenes.map(s => s.id === updatedScene.id ? updatedScene : s);
        onUpdateProject({ ...project, scenes: updatedScenes });
    }, [project, onUpdateProject]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!activeScene) return;
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                updateScene({ 
                    ...activeScene, 
                    baseImage: { dataUrl: event.target?.result as string, mimeType: file.type },
                    generatedImage: null,
                    generatedVideoUrl: null,
                });
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleGenerateImage = async () => {
        if (!activeScene || !imagePrompt) return;

        updateScene({ ...activeScene, isProcessingImage: true, generatedImage: null, generatedVideoUrl: null });
        try {
            let generatedDataUrl: string;

            if (activeScene.baseImage) {
                // Edit mode: use the reference image
                const base64Data = activeScene.baseImage.dataUrl.split(',')[1];
                generatedDataUrl = await geminiService.editImage(base64Data, activeScene.baseImage.mimeType, imagePrompt);
            } else {
                // Generation mode: use only the prompt
                generatedDataUrl = await geminiService.generateImageFromPrompt(imagePrompt);
            }

            updateScene({ ...activeScene, generatedImage: generatedDataUrl, isProcessingImage: false });
        } catch (error) {
            console.error("Image generation failed:", error);
            alert(`Image generation failed: ${error instanceof Error ? error.message : String(error)}`);
            updateScene({ ...activeScene, isProcessingImage: false });
        }
    };
    
    const handleTransferImage = () => {
        if (!activeScene || !activeScene.generatedImage) return;
        const mimeType = activeScene.generatedImage.substring(5, activeScene.generatedImage.indexOf(';'));
        updateScene({
            ...activeScene,
            baseImage: { dataUrl: activeScene.generatedImage, mimeType: mimeType},
            generatedImage: null,
        });
    }

    const handleGenerateVideo = async () => {
        if (!activeScene || !activeScene.generatedImage) return;
        updateScene({ ...activeScene, isProcessingVideo: true });
        try {
            const base64Data = activeScene.generatedImage.split(',')[1];
            const mimeType = activeScene.generatedImage.substring(5, activeScene.generatedImage.indexOf(';'));
            const videoUrl = await geminiService.generateVideoForScene(animationPrompt, base64Data, mimeType);
            updateScene({ ...activeScene, generatedVideoUrl: videoUrl, isProcessingVideo: false });
        } catch (error) {
            console.error("Video generation failed:", error);
            alert(`Video generation failed: ${error instanceof Error ? error.message : String(error)}`);
            updateScene({ ...activeScene, isProcessingVideo: false });
        }
    }
    
    const handleSaveAndContinue = () => {
        if (!activeScene) return;

        const currentSceneIndex = project.scenes.findIndex(s => s.id === activeScene.id);
        alert(`Сцена ${currentSceneIndex + 1} сохранена!`);

        const nextSceneIndex = currentSceneIndex + 1;
        if (nextSceneIndex < project.scenes.length) {
            setActiveSceneId(project.scenes[nextSceneIndex].id);
            setAnimationPrompt(''); // Reset animation prompt for next scene
        } else {
            alert('Все сцены обработаны. Проект завершен!');
            setActiveSceneId(null);
        }
    };

    const handleSceneClick = (sceneId: string) => {
        // Only allow selecting scenes from the first (active) project for now
        if (activeScenarioId === 'scen-001') {
             setActiveSceneId(sceneId);
        } else {
            alert("Editing for this scenario is not connected yet. Please select a scene from 'Project 001'.");
        }
    }


    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-100 border-b-2 border-purple-500/30 pb-2">Художественный отдел</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* --- SIDEBAR --- */}
                <div className="lg:col-span-1 p-4 bg-gray-800 rounded-xl shadow-lg border border-gray-700 h-fit">
                    {sidebarView === 'details' && activeScenario ? (
                        <>
                            <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => setSidebarView('list')}>
                                <button className="p-1 text-purple-400 hover:text-purple-300">
                                    <ArrowLeftIcon className="w-5 h-5" />
                                </button>
                                <h3 className="font-semibold text-purple-300 list-none truncate">{activeScenario.title}</h3>
                            </div>
                            <div className="pl-4 space-y-2 border-l-2 border-gray-700">
                                {activeScenario.excerpts.map(excerpt => (
                                     <details key={excerpt.id}>
                                        <summary className="font-medium text-gray-300 list-none cursor-pointer text-sm">{excerpt.title}</summary>
                                        <div className="pl-4 mt-1 space-y-1 border-l-2 border-gray-600">
                                            {excerpt.scenes.map((scene, index) => (
                                                <div key={scene.id} onClick={() => handleSceneClick(scene.id)} className={`p-2 rounded-md cursor-pointer text-xs transition-colors ${activeSceneId === scene.id ? 'bg-purple-800/50' : 'hover:bg-gray-700/50'}`}>
                                                    <p className="font-bold">Сцена #{index + 1}</p>
                                                    <p className="text-gray-400 truncate">{scene.script}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                ))}
                                 <details>
                                    <summary className="font-medium text-gray-300 list-none cursor-pointer text-sm">Обложка</summary>
                                    <div className="pl-4 mt-1 flex gap-2 pt-1">
                                       <button onClick={() => setImagePrompt(`${activeScenario?.title} cover art, variant A, cinematic movie poster, high detail`)} className="flex-1 text-sm py-1 bg-gray-700 hover:bg-purple-700 rounded-md transition-colors">А</button>
                                       <button onClick={() => setImagePrompt(`${activeScenario?.title} cover art, variant B, minimalist design, key visual`)} className="flex-1 text-sm py-1 bg-gray-700 hover:bg-purple-700 rounded-md transition-colors">Б</button>
                                       <button onClick={() => setImagePrompt(`${activeScenario?.title} cover art, variant C, epic illustration, dynamic composition`)} className="flex-1 text-sm py-1 bg-gray-700 hover:bg-purple-700 rounded-md transition-colors">В</button>
                                    </div>
                                </details>
                            </div>
                        </>
                    ) : (
                         <>
                            <div className="flex justify-between items-center mb-4">
                               <h3 className="text-xl font-semibold text-purple-300">Сценарии</h3>
                               <button className="px-3 py-1 bg-indigo-600 text-sm rounded-md">Создать новый</button>
                            </div>
                            <div className="space-y-2">
                               {[...mockScenarios].reverse().map(scenario => (
                                <div key={scenario.id} onClick={() => { setActiveScenarioId(scenario.id); setSidebarView('details'); }} className="p-3 rounded-lg cursor-pointer hover:bg-gray-700/50 bg-gray-900/50">
                                   <div className="flex justify-between items-center">
                                       <p className="font-bold text-gray-200 truncate pr-2">{scenario.title}</p>
                                       <span className={`px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${statusColors[scenario.status]}`}>
                                           {scenario.status}
                                       </span>
                                   </div>
                                </div>
                               ))}
                            </div>
                         </>
                    )}
                </div>
                {/* --- WORKSPACE --- */}
                <div className="lg:col-span-2 p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700 space-y-6">
                    {activeScene ? (
                        <>
                            <div>
                                <h3 className="text-xl font-semibold text-purple-300 mb-4">Редактор: Сцена {project.scenes.findIndex(s => s.id === activeScene.id) + 1}</h3>
                                <div className="flex flex-col md:flex-row gap-4 items-center">
                                    {/* Reference Image */}
                                    <div className="w-full">
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Референс</label>
                                        <div className="w-full aspect-video bg-gray-900/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600 relative">
                                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                            {activeScene.baseImage ? <img src={activeScene.baseImage.dataUrl} alt="Base" className="w-full h-full object-cover rounded-md"/> : <span className="text-gray-500 text-center px-4">Загрузить</span>}
                                        </div>
                                    </div>

                                    <div className="p-2">
                                        <button onClick={handleTransferImage} title="Использовать результат как референс" disabled={!activeScene.generatedImage} className="p-2 rounded-full bg-gray-700 hover:bg-purple-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors">
                                           <TransferIcon className="w-6 h-6 transform rotate-180" />
                                        </button>
                                    </div>
                                    
                                    {/* Generated Image */}
                                    <div className="w-full">
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Результат</label>
                                        <div className="w-full aspect-video border-2 border-gray-700 bg-gray-900/50 rounded-lg flex items-center justify-center overflow-hidden">
                                            {activeScene.isProcessingImage ? <Spinner /> : activeScene.generatedImage ? <img src={activeScene.generatedImage} alt="Generated" className="w-full h-full object-cover"/> : <span className="text-gray-500">Результат AI</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-3">
                                    <label htmlFor="image-prompt" className="block text-sm font-medium text-gray-400">{activeScene.baseImage ? 'Промпт для редактирования' : 'Промпт для генерации'}</label>
                                    <textarea id="image-prompt" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} rows={4} className="w-full p-2 bg-gray-900/50 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500" placeholder="e.g., make the sky purple"/>
                                    <button onClick={handleGenerateImage} disabled={activeScene.isProcessingImage || activeScene.isProcessingVideo || !imagePrompt} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                                        {activeScene.isProcessingImage ? 'Генерация...' : (activeScene.baseImage ? 'Редактировать' : 'Сгенерировать')}
                                    </button>
                                </div>
                                <div>
                                    <PromptFilters onSelect={(value) => setImagePrompt(p => p + value)} />
                                </div>
                            </div>

                            <VideoPreview 
                                scene={activeScene} 
                                onGenerate={handleGenerateVideo}
                                onSave={handleSaveAndContinue}
                                animationPrompt={animationPrompt}
                                setAnimationPrompt={setAnimationPrompt}
                            />
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full min-h-[400px]">
                            <p className="text-gray-500">Выберите сцену для начала работы.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ArtStudioPage;