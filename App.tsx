import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import FileUploader from './components/FileUploader';
import GradeMapper from './components/GradeMapper';
import { parseCSV, processClassInToGradebook, generateCSVContent, getUniqueNonNumericMarks } from './utils/csvHelper';
import { TargetRow, GradeMapping } from './types';
import { TableCellsIcon, ArrowDownTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  
  const [processedData, setProcessedData] = useState<TargetRow[]>([]);
  
  // Default mapping based on updated prompt rules
  // Defaults now include Chinese statuses to allow user overrides
  const [gradeMapping, setGradeMapping] = useState<GradeMapping>({
    'A*': '100',
    'A': '90',
    'B': '80',
    'C': '70',
    'D': '60',
    'E': '50',
    'U': '0',
    '需订正': '50',
    '已补交': '60',
    '已订正': '80'
  });

  const handleFileSelect = (content: string, name: string) => {
    setRawContent(content);
    setFileName(name);

    // Analyze file for new statuses (e.g., "需订正", "已提交")
    const parsed = parseCSV(content);
    const foundStatuses = getUniqueNonNumericMarks(parsed);

    setGradeMapping(prev => {
      const next = { ...prev };
      let hasChanges = false;
      
      foundStatuses.forEach(status => {
        const key = status.toUpperCase();
        // Only add if it doesn't exist to preserve user settings
        if (!next.hasOwnProperty(key)) {
          next[key] = '0'; // Default value for new unknown statuses
          hasChanges = true;
        }
      });

      return hasChanges ? next : prev;
    });
  };

  // Re-process when content, date, or mapping changes
  useEffect(() => {
    if (!rawContent) return;

    const parsed = parseCSV(rawContent);
    const processed = processClassInToGradebook(parsed, selectedDate, gradeMapping);
    setProcessedData(processed);
  }, [rawContent, selectedDate, gradeMapping]);

  const handleDownload = () => {
    if (processedData.length === 0) return;
    
    const csvContent = generateCSVContent(processedData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gradebook_export_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to display date in UK format on UI
  const formatDateToUK = (isoDate: string) => {
    const parts = isoDate.split('-');
    if(parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Preview a slice of data to avoid rendering massive tables
  const previewData = useMemo(() => processedData.slice(0, 10), [processedData]);
  
  const isFutureDate = selectedDate > todayStr;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-sans">
      <Header />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        
        {/* Section 1: Configuration & Upload */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Configuration Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 lg:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">Step 1</span>
              Settings
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="assignDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="assignDate"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={todayStr}
                  className={`block w-full rounded-md border shadow-sm p-2 sm:text-sm ${isFutureDate ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                />
                
                {isFutureDate && (
                  <div className="mt-2 flex items-start text-xs text-red-600 bg-red-50 p-2 rounded">
                    <ExclamationTriangleIcon className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span>
                      Warning: Start date is in the future. Assignments will all be assigned to this single date.
                    </span>
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                   <span className="font-semibold block mb-1">Generation Range:</span>
                   {isFutureDate ? (
                     <span>Single Date: <span className="font-mono text-gray-700">{formatDateToUK(selectedDate)}</span></span>
                   ) : (
                     <span>
                       Randomly between <span className="font-mono text-gray-700">{formatDateToUK(selectedDate)}</span> and <span className="font-mono text-gray-700">{formatDateToUK(todayStr)}</span> (Today)
                     </span>
                   )}
                </div>
              </div>
            </div>
          </div>

          {/* Upload Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 lg:col-span-2">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">Step 2</span>
              Upload Source File
            </h2>
            <FileUploader onFileSelect={handleFileSelect} />
            {fileName && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-center">
                 <span className="font-medium mr-2">Loaded:</span> {fileName}
              </div>
            )}
          </div>
        </div>
        
        {/* Section 1.5: Grade Mapping */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-3">
              <GradeMapper mapping={gradeMapping} onChange={setGradeMapping} />
           </div>
        </div>

        {/* Section 2: Preview & Action */}
        {processedData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                 <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">Step 3</span>
                  Preview & Download
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Found <span className="font-bold text-indigo-600">{processedData.length}</span> records ready for export.
                </p>
              </div>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Download CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Student Name', 'Assignment', 'Date', 'Category', 'Marks', 'Total'].map((h) => (
                      <th key={h} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.StudentName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs" title={row.AssignmentName}>
                        {row.AssignmentName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.AssignmentDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.Category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {row.Marks || <span className="text-gray-300 italic">Empty</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.TotalMarksPossible}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {processedData.length > 10 && (
              <div className="bg-gray-50 px-6 py-3 text-center text-sm text-gray-500 border-t border-gray-200">
                ...and {processedData.length - 10} more rows
              </div>
            )}
          </div>
        )}

        {processedData.length === 0 && rawContent && (
          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <TableCellsIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">No valid data found</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    The uploaded file doesn't match the expected ClassIn format or contains no assignments with valid numeric "Full Marks".
                    Please check the file structure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;