
import React from 'react';

const CobraIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12.51,2.02c-1.8-0.08-3.6,0.29-5.2,1.05C4.24,4.2,2.3,6.81,2.05,9.96c-0.19,2.44,0.38,4.8,1.6,6.73c0.7,1.1,1.6,2.09,2.7,2.83c1.23,0.84,2.6,1.31,4.1,1.43c2.4,0.19,4.71-0.53,6.5-2.11c1.37-1.22,2.3-2.8,2.7-4.63c0.41-1.89-0.07-3.8-0.9-5.46c-1.2-2.39-3.2-4-5.7-4.57C12.91,2.09,12.71,2.03,12.51,2.02z M12.01,7.03c1.3,0,2.3,1,2.3,2.2s-1.1,2.2-2.3,2.2s-2.3-1-2.3-2.2S10.71,7.03,12.01,7.03z M15.11,16.53c-0.8,0.4-1.9,0.7-3.1,0.7s-2.3-0.3-3.1-0.7c-0.3-0.2-0.4-0.5-0.2-0.8c0.2-0.3,0.5-0.4,0.8-0.2c1.3,0.7,2.9,0.7,4.2,0c0.3-0.2,0.7-0.1,0.8,0.2C15.51,16.03,15.41,16.43,15.11,16.53z"></path>
    </svg>
);

interface HeaderProps {
    activePage: string;
    setActivePage: (page: string) => void;
}

const NavLink: React.FC<{page: string; activePage: string; setActivePage: (page: string) => void; children: React.ReactNode}> = ({ page, activePage, setActivePage, children }) => {
    const isActive = page === activePage;
    return (
        <button 
            onClick={() => setActivePage(page)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
        >
            {children}
        </button>
    )
}


const Header: React.FC<HeaderProps> = ({ activePage, setActivePage }) => {
  return (
    <header className="bg-gray-900/70 backdrop-blur-sm border-b border-purple-500/30 shadow-lg shadow-purple-900/20 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CobraIcon className="w-8 h-8 text-purple-400" />
          <h1 className="text-xl md:text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            Media Forge
          </h1>
        </div>
        <nav className="hidden md:flex items-center space-x-4">
            <NavLink page="dashboard" activePage={activePage} setActivePage={setActivePage}>Главная</NavLink>
            <NavLink page="script" activePage={activePage} setActivePage={setActivePage}>Сценарная</NavLink>
            <NavLink page="art" activePage={activePage} setActivePage={setActivePage}>Художка</NavLink>
            <NavLink page="voiceover" activePage={activePage} setActivePage={setActivePage}>Озвучка</NavLink>
        </nav>
        <a
          href="https://openrouter.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-400 hover:text-purple-400 transition-colors"
        >
            Powered by OpenRouter
        </a>
      </div>
    </header>
  );
};

export default Header;
