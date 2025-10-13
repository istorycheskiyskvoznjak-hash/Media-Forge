
import React from 'react';

const ClapperboardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.82,2.46a2,2,0,0,0-1.93-.4L4.18,6.6A2,2,0,0,0,3,8.51V19a2,2,0,0,0,2,2H19a2,2,0,0,0,2,2V4.51A2,2,0,0,0,19.82,2.46ZM19,19H5V8.51l14-4.5Z"/>
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
          <ClapperboardIcon className="w-8 h-8 text-purple-400" />
          <h1 className="text-xl md:text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            DIRECTED@CBRNRH
          </h1>
        </div>
        <nav className="hidden md:flex items-center space-x-4">
            <NavLink page="dashboard" activePage={activePage} setActivePage={setActivePage}>Главная</NavLink>
            <NavLink page="script" activePage={activePage} setActivePage={setActivePage}>Сценарная</NavLink>
            <NavLink page="art" activePage={activePage} setActivePage={setActivePage}>Художка</NavLink>
            <NavLink page="voiceover" activePage={activePage} setActivePage={setActivePage}>Озвучка</NavLink>
        </nav>
      </div>
    </header>
  );
};

export default Header;
