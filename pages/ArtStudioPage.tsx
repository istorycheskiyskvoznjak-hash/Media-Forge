import React, { useState, useEffect } from 'react';
import { Project, ProjectScene } from '../types';
import * as geminiService from '../services/geminiService';
import Spinner from '../components/Spinner';

interface ArtStudioPageProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

const loadingMessages = [
    "Warming up the AI director...",
    "Choreographing pixels into motion...",
    "Rendering digital starlight...",
    "Teaching the sprites their lines...",
    "This can take a few minutes, hang tight!",
    "The creative AI is deep in thought...",
];

const ArtStudioPage: React.FC<ArtStudioPageProps> = ({ project, onUpdateProject }) => {
    const [activeSceneId, setActiveSceneId] = useState<string | null>(project.scenes[0]?.id || null);
    const [imagePrompt, setImagePrompt] = useState('Add a glowing cobra logo on a building in the background.');
    const [videoLoadingMessage, setVideoLoadingMessage] = useState(loadingMessages[0]);

    const activeScene = project.scenes.find(s => s.id === activeSceneId);

    useEffect(() => {
        let interval: number;
        if (activeScene?.isProcessingVideo) {
            interval = window.setInterval(() => {
                setVideoLoadingMessage(prev => {
                    const currentIndex = loadingMessages.indexOf(prev);
                    const nextIndex = (currentIndex + 1) % loadingMessages.length;
                    return loadingMessages[nextIndex];
                });
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [activeScene?.isProcessingVideo]);
    
    const updateScene = (updatedScene: ProjectScene) => {
        const updatedScenes = project.scenes.map(s => s.id === updatedScene.id ? updatedScene : s);
        onUpdateProject({ ...project, scenes: updatedScenes });
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!activeScene) return;
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                updateScene({ 
                    ...activeScene, 
                    baseImage: {
                        dataUrl: event.target?.result as string,
                        mimeType: file.type,
                    },
                    generatedImage: null,
                    generatedVideoUrl: null, // Reset video if base image changes
                });
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleGenerateImage = async () => {
        if (!activeScene || !activeScene.baseImage || !imagePrompt) return;
        
        updateScene({ ...activeScene, isProcessingImage: true, generatedImage: null, generatedVideoUrl: null });
        try {
            const base64Data = activeScene.baseImage.dataUrl.split(',')[1];
            const generatedDataUrl = await geminiService.editImage(base64Data, activeScene.baseImage.mimeType, imagePrompt);
            updateScene({ ...activeScene, generatedImage: generatedDataUrl, isProcessingImage: false });
        } catch (error) {
            console.error("Image generation failed:", error);
            alert(`Image generation failed: ${error instanceof Error ? error.message : String(error)}`);
            updateScene({ ...activeScene, isProcessingImage: false });
        }
    };

    const handleGenerateVideo = async () => {
        if (!activeScene || !activeScene.generatedImage) return;

        updateScene({ ...activeScene, isProcessingVideo: true });
        try {
            const base64Data = activeScene.generatedImage.split(',')[1];
            const mimeType = activeScene.generatedImage.substring(5, activeScene.generatedImage.indexOf(';'));
            
            const videoUrl = await geminiService.generateVideoForScene(activeScene.script, base64Data, mimeType);
            
            updateScene({ ...activeScene, generatedVideoUrl: videoUrl, isProcessingVideo: false });

        } catch (error) {
            console.error("Video generation failed:", error);
            alert(`Video generation failed: ${error instanceof Error ? error.message : String(error)}`);
            updateScene({ ...activeScene, isProcessingVideo: false });
        }
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-100 border-b-2 border-purple-500/30 pb-2">Художка (Nano Banana & Veo)</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Scene List */}
                <div className="lg:col-span-1 p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-purple-300">Сцены</h3>
                    <div className="space-y-2">
                        {project.scenes.map(scene => (
                            <div
                                key={scene.id}
                                onClick={() => setActiveSceneId(scene.id)}
                                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${activeSceneId === scene.id ? 'bg-purple-800/50' : 'hover:bg-gray-700/50'}`}
                            >
                                <p className="font-bold text-gray-200">Сцена {project.scenes.indexOf(scene) + 1}</p>
                                <p className="text-sm text-gray-400 mt-1 truncate">{scene.script}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Workspace */}
                <div className="lg:col-span-2 p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
                    {activeScene ? (
                        <>
                            <div className="space-y-6">
                                <h3 className="text-xl font-semibold text-purple-300">Редактор: Сцена {project.scenes.indexOf(activeScene) + 1}</h3>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Базовое изображение</label>
                                        <div className="w-full aspect-video bg-gray-900/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600 relative">
                                            {!activeScene.baseImage ? (
                                                <>
                                                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                                    <span className="text-gray-500 text-center px-4">Нажмите или перетащите для загрузки</span>
                                                </>
                                            ) : (
                                                <img src={activeScene.baseImage.dataUrl} alt="Base" className="w-full h-full object-cover rounded-md"/>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Сгенерированное изображение</label>
                                        <div className="w-full aspect-video border-2 border-gray-700 bg-gray-900/50 rounded-lg flex items-center justify-center overflow-hidden">
                                        {activeScene.isProcessingImage ? <Spinner /> : activeScene.generatedImage ? <img src={activeScene.generatedImage} alt="Generated" className="w-full h-full object-cover"/> : <span className="text-gray-500">Результат AI</span>}
                                        </div>
                                        {activeScene.generatedImage && !activeScene.isProcessingImage && (
                                            <button 
                                                onClick={handleGenerateVideo}
                                                disabled={activeScene.isProcessingVideo}
                                                className="mt-3 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold transition-colors text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                                            >
                                                {activeScene.isProcessingVideo ? 'Создание видео...' : 'Сгенерировать видео'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {activeScene.baseImage && (
                                    <div className="mt-4">
                                        <label htmlFor="image-prompt" className="block text-sm font-medium text-gray-400 mb-2">Промпт для редактирования</label>
                                        <input
                                            id="image-prompt"
                                            type="text"
                                            value={imagePrompt}
                                            onChange={(e) => setImagePrompt(e.target.value)}
                                            className="w-full p-2 bg-gray-900/50 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500"
                                            placeholder="e.g., make the sky purple"
                                        />
                                        <button onClick={handleGenerateImage} disabled={activeScene.isProcessingImage || activeScene.isProcessingVideo} className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                                            {activeScene.isProcessingImage ? 'Генерация...' : 'Сгенерировать'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t border-gray-700/60">
                                <h3 className="text-xl font-semibold text-purple-300 mb-4">Предпросмотр видео</h3>
                                <div className="w-full max-w-lg mx-auto aspect-video bg-gray-900/50 rounded-lg flex items-center justify-center border-2 border-gray-700 overflow-hidden relative">
                                    {activeScene.isProcessingVideo ? (
                                        <div className="text-center">
                                            <Spinner />
                                            <p className="text-gray-400 mt-4 animate-pulse">{videoLoadingMessage}</p>
                                        </div>
                                    ) : activeScene.generatedVideoUrl ? (
                                        <video src={activeScene.generatedVideoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                                    ) : (
                                        <p className="text-gray-500 px-4 text-center">Нажмите "Сгенерировать видео" под изображением, чтобы создать видеоклип.</p>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">Выберите сцену для начала работы.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ArtStudioPage;