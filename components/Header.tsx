

import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-10 flex-shrink-0 p-4 border-b border-accent bg-secondary shadow-md flex justify-between items-center h-16">
      <h1 className="text-lg font-semibold text-text-primary">Gemini MCP</h1>
    </header>
  );
};

export default Header;
