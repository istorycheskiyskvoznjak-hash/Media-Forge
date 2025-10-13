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