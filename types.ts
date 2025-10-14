
export interface ProjectScene {
  id: string;
  script: string;
  baseImage: {
    dataUrl: string;
    mimeType: string;
  } | null;
  generatedImage: string | null; // data URL
  isProcessingImage: boolean;
  generatedVideoUrl: string | null;
  isProcessingVideo: boolean;
  voiceoverHistory: Array<{
    id: string;
    url: string;
    timestamp: string;
    voice: string;
  }>;
}

export interface Project {
  id: string;
  title: string;
  rawScript: string;
  scenes: ProjectScene[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// FIX: Moved ProcessItem here to be shared across modules
export interface ProcessItem {
    id: string;
    title: string;
    content: string;
    sourceAgentId: string;
    type: 'topic' | 'deep_research' | 'research' | 'script';
}
