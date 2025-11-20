import React from 'react';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { GradeMapping } from '../types';

interface GradeMapperProps {
  mapping: GradeMapping;
  onChange: (newMapping: GradeMapping) => void;
}

const GradeMapper: React.FC<GradeMapperProps> = ({ mapping, onChange }) => {
  const handleChange = (key: string, field: 'key' | 'value', newValue: string) => {
    if (field === 'value') {
      const newMapping = { ...mapping, [key]: newValue };
      onChange(newMapping);
    } else {
      // Key changes are handled via add/remove to keep it simple
    }
  };
  
  // Explicitly cast entries to [string, string][] to resolve 'unknown' type inference issues
  const entries = Object.entries(mapping) as [string, string][];

  const updateEntry = (oldKey: string, newKey: string, newValue: string) => {
    // Create new object preserving order roughly
    const newMap: GradeMapping = {};
    entries.forEach(([k, v]) => {
      if (k === oldKey) {
        newMap[newKey] = newValue;
      } else {
        newMap[k] = v;
      }
    });
    onChange(newMap);
  };

  const addEntry = () => {
    const newKey = `New Grade ${entries.length + 1}`;
    onChange({ ...mapping, [newKey]: '0' });
  };

  const removeEntry = (keyToRemove: string) => {
    const { [keyToRemove]: _, ...rest } = mapping;
    onChange(rest);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 lg:col-span-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">Optional</span>
          Score Mapping
        </h2>
        <button
          onClick={addEntry}
          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Rule
        </button>
      </div>
      
      <p className="text-sm text-gray-500 mb-4">
        Define how text-based marks (e.g., "A", "B", "需订正", "已提交") should be converted. 
        <br/>
        <span className="font-semibold text-indigo-600">Important:</span> Values entered below are treated as <span className="font-bold">PERCENTAGES</span> of the assignment's Total Marks (e.g., enter "90" for 90%).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {entries.map(([grade, score]) => (
          <div key={grade} className="flex items-center space-x-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
            <input
              type="text"
              value={grade}
              onChange={(e) => updateEntry(grade, e.target.value, score)}
              className="w-24 text-center text-sm font-bold text-gray-700 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 uppercase"
              placeholder="Status"
            />
            <span className="text-gray-400">→</span>
            <div className="relative flex-1 min-w-0">
                <input
                type="number"
                value={score}
                onChange={(e) => updateEntry(grade, grade, e.target.value)}
                className="w-full text-sm text-gray-700 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 pr-6"
                placeholder="%"
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs pointer-events-none">%</span>
            </div>
            <button
              onClick={() => removeEntry(grade)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
        {entries.length === 0 && (
            <div className="col-span-full text-center text-sm text-gray-400 italic py-2">
                No mapping rules defined. Non-numeric marks will be left blank.
            </div>
        )}
      </div>
    </div>
  );
};

export default GradeMapper;