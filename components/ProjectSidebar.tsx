
import React, { useState } from 'react';

const ProjectSidebar: React.FC = () => {
  const [activeProjectId, setActiveProjectId] = useState<string>('proj-001');
  const projects = Array.from({ length: 99 }, (_, i) => ({
      id: `proj-${String(i + 1).padStart(3, '0')}`,
      title: `Проект ${String(i + 1).padStart(3, '0')}`
  }));

  return (
    <aside className="w-64 bg-gray-900/80 border-r border-purple-500/20 p-4 flex flex-col space-y-4">
      <h2 className="text-lg font-semibold text-gray-300">Проекты</h2>
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2">
        {projects.map(project => (
          <div
            key={project.id}
            onClick={() => setActiveProjectId(project.id)}
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 group relative ${activeProjectId === project.id ? 'bg-purple-800/50 shadow-lg' : 'hover:bg-gray-700/50'}`}
          >
            <p className="font-medium truncate text-gray-200">{project.title}</p>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default ProjectSidebar;
