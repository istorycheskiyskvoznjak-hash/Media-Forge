
import React, { useState } from 'react';
import { Project } from '../types';
import * as geminiService from '../services/geminiService';
import Spinner from '../components/Spinner';

interface ScriptRoomPageProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

const ScriptRoomPage: React.FC<ScriptRoomPageProps> = ({ project, onUpdateProject }) => {
    const [rawText, setRawText] = useState(project.rawScript);
    const [structuredScript, setStructuredScript] = useState(JSON.stringify({ scenes: project.scenes }, null, 2));
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateScript = async () => {
        setIsLoading(true);
        setStructuredScript('');
        let fullResponse = '';

        try {
            await geminiService.structureScriptFromText(rawText, (chunk) => {
                fullResponse += chunk;
                setStructuredScript(fullResponse);
            });
        } catch (error) {
            console.error("Script generation failed:", error);
            alert(`Script generation failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyScript = () => {
        try {
            const parsed = JSON.parse(structuredScript);
            if (parsed.scenes && Array.isArray(parsed.scenes)) {
                onUpdateProject({
                    ...project,
                    rawScript: rawText,
                    scenes: parsed.scenes.map((s: any) => ({
                        ...s,
                        baseImage: null,
                        generatedImage: null,
                        isProcessingImage: false,
                    })),
                });
                alert('Script updated successfully!');
            } else {
                alert('Invalid script structure. Could not find "scenes" array.');
            }
        } catch (error) {
            alert(`Failed to parse script. Please ensure it's valid JSON. ${error}`);
        }
    };


    return (
        <div className="space-y-8 max-w-6xl mx-auto">
             <h1 className="text-3xl font-bold text-gray-100 border-b-2 border-purple-500/30 pb-2">Сценарная комната</h1>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700 space-y-4">
                    <h3 className="text-xl font-semibold text-purple-300">1. Вставьте текст</h3>
                    <p className="text-sm text-gray-400">Вставьте сюда текст вашего документа или набросок идеи.</p>
                    <textarea
                        className="w-full h-80 p-3 bg-gray-900/50 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder="A solitary figure on a rooftop..."
                    />
                     <button onClick={handleGenerateScript} disabled={isLoading} className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {isLoading ? <><Spinner /> Генерируем...</> : 'Сгенерировать сценарий'}
                    </button>
                </div>
                
                {/* Output Section */}
                <div className="p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700 space-y-4">
                     <h3 className="text-xl font-semibold text-purple-300">2. Структурированный сценарий</h3>
                     <p className="text-sm text-gray-400">AI преобразует ваш текст в готовый к работе JSON-сценарий.</p>
                     <div className="w-full h-80 p-3 bg-gray-900/50 rounded-md border border-gray-600 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm text-gray-200">
                            <code>{structuredScript}</code>
                        </pre>
                     </div>
                     <button onClick={handleApplyScript} disabled={isLoading || !structuredScript} className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                        Применить к проекту
                    </button>
                </div>
             </div>
        </div>
    );
};

export default ScriptRoomPage;
