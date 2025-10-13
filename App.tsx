
import React, { useState, useCallback } from 'react';
import { Project } from './types';
import Header from './components/Header';
import ProjectSidebar from './components/ProjectSidebar';
import DashboardPage from './pages/DashboardPage';
import ScriptRoomPage from './pages/ScriptRoomPage';
import ArtStudioPage from './pages/ArtStudioPage';
import VoiceoverPage from './pages/VoiceoverPage';

// Create a more detailed mock project
const initialProject: Project = {
  id: 'proj-001',
  title: 'Project 001: Neon City',
  rawScript: 'A solitary figure stands on a neon-lit rooftop, overlooking a futuristic city at night. Rain slicks the streets below, reflecting the glowing advertisements.\\nThe figure pulls up their collar against the wind, their face hidden in shadow.\\nA flying vehicle zips past silently in the distance.',
  scenes: [
    {
      id: 'scene-1',
      script: 'A solitary figure stands on a neon-lit rooftop, cinematic shot, futuristic city at night, reflecting glowing advertisements.',
      baseImage: null,
      generatedImage: null,
      isProcessingImage: false,
      generatedVideoUrl: null,
      isProcessingVideo: false,
    },
    {
      id: 'scene-2',
      script: 'Close up on the figure pulling up their collar, face hidden in shadow, dramatic lighting, rain.',
      baseImage: null,
      generatedImage: null,
      isProcessingImage: false,
      generatedVideoUrl: null,
      isProcessingVideo: false,
    },
     {
      id: 'scene-3',
      script: 'Wide shot of a flying vehicle zipping past in the distance, motion blur, neon city background.',
      baseImage: null,
      generatedImage: null,
      isProcessingImage: false,
      generatedVideoUrl: null,
      isProcessingVideo: false,
    },
  ],
};

const Footer: React.FC = () => {
    return (
        <footer className="w-full text-center py-4 bg-gray-900 border-t border-purple-500/20 mt-auto">
            <p className="text-xs text-gray-500">
                PWRD BY COBZHA & GEMINI © 2025
            </p>
        </footer>
    );
};


const App: React.FC = () => {
  const [project, setProject] = useState<Project>(initialProject);
  const [activePage, setActivePage] = useState('dashboard');

  const updateProject = useCallback((updatedProject: Project) => {
    setProject(updatedProject);
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'script':
        return <ScriptRoomPage project={project} onUpdateProject={updateProject} />;
      case 'art':
        return <ArtStudioPage project={project} onUpdateProject={updateProject} />;
      case 'voiceover':
        return <VoiceoverPage project={project} />;
      default:
        return <DashboardPage />;
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <Header activePage={activePage} setActivePage={setActivePage} />
      <div className="flex flex-1 overflow-hidden">
        {activePage === 'dashboard' && <ProjectSidebar />}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-800/50">
          {renderPage()}
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default App;
