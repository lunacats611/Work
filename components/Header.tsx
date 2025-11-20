import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const Header: React.FC = () => {
  return (
    <header className="bg-indigo-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowPathIcon className="h-8 w-8 text-indigo-200" />
          <h1 className="text-2xl font-bold tracking-tight">ClassIn Converter</h1>
        </div>
        <p className="text-indigo-200 text-sm font-medium hidden sm:block">
          CSV Transformation Tool
        </p>
      </div>
    </header>
  );
};

export default Header;
