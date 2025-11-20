import { ParseResult, TargetRow, ProcessedAssignment, GradeMapping } from '../types';

/**
 * robustly parses a CSV line handling quotes
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let startValueIndex = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      let value = line.substring(startValueIndex, i);
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/""/g, '"');
      }
      result.push(value.trim());
      startValueIndex = i + 1;
    }
  }
  
  // Push the last value
  let lastValue = line.substring(startValueIndex);
  if (lastValue.startsWith('"') && lastValue.endsWith('"')) {
    lastValue = lastValue.slice(1, -1).replace(/""/g, '"');
  }
  result.push(lastValue.trim());

  return result;
};

export const parseCSV = (content: string): ParseResult => {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], data: [] };

  const data = lines.map(parseCSVLine);
  // Ensure all rows have the same number of columns as the header (pad with empty strings)
  const headerLength = data[0].length;
  const normalizedData = data.map(row => {
    if (row.length < headerLength) {
      return [...row, ...Array(headerLength - row.length).fill('')];
    }
    return row;
  });

  return {
    headers: normalizedData[0],
    data: normalizedData
  };
};

const getWorkingDaysFromStartToToday = (startDateStr: string): string[] => {
  // Parse input YYYY-MM-DD in local time context to avoid timezone shifts
  const parts = startDateStr.split('-').map(Number);
  if (parts.length !== 3) return [startDateStr];

  const [sYear, sMonth, sDay] = parts;
  const start = new Date(sYear, sMonth - 1, sDay); // Local midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Local midnight today

  // Helper to format date as dd/mm/yyyy
  const formatDDMMYYYY = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  };

  // Safety: If start is after today, just return start date formatted
  if (start > today) return [formatDDMMYYYY(start)];

  const days: string[] = [];
  // Clone start to iterate
  const current = new Date(start);

  while (current <= today) {
    const dayOfWeek = current.getDay(); // 0 = Sun, 6 = Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
       days.push(formatDDMMYYYY(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  // If no working days found (e.g., range is only a weekend), use start date
  return days.length > 0 ? days : [formatDDMMYYYY(start)];
};

// Helper to find the index of the row that actually contains headers
// This is crucial because users might copy-paste files with junk at the top
const findHeaderRowIndex = (data: string[][]): number => {
  const potentialHeaders = ['Student Name', '学生姓名', '姓名', 'Name'];
  // Scan first 20 rows to find a matching header
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const firstCell = (data[i][0] || '').trim();
    if (potentialHeaders.some(h => firstCell.includes(h))) {
      return i;
    }
  }
  return 0; // Fallback to first row
};

/**
 * Scans the parsed data for any non-numeric values in the assignment columns.
 * This allows us to auto-populate the grade mapping with statuses like '需订正', 'Missing', etc.
 */
export const getUniqueNonNumericMarks = (parsedData: ParseResult): string[] => {
  const { data } = parsedData;
  if (data.length < 2) return [];

  const headerIdx = findHeaderRowIndex(data);
  const headerRow = data[headerIdx];
  
  // We need at least Header and MaxMarks rows to identify columns
  if (data.length <= headerIdx + 1) return [];
  const maxMarksRow = data[headerIdx + 1];
  
  // Identify valid assignment columns (must match logic in processClassInToGradebook)
  const validIndices: number[] = [];
  for (let i = 1; i < headerRow.length; i++) {
    const maxMarks = maxMarksRow[i] || '';
    const cleanMaxMarks = maxMarks.replace(/[^\d.]/g, '');
    const isNumeric = !isNaN(parseFloat(cleanMaxMarks)) && cleanMaxMarks !== '';
    if (headerRow[i] && isNumeric) {
      validIndices.push(i);
    }
  }

  const uniqueSet = new Set<string>();
  
  // Standard ClassIn: Header (idx) -> MaxMarks (idx+1) -> Category (idx+2) -> Data (idx+3)
  // We check from idx+3 to avoid scanning metadata
  const studentRows = data.slice(headerIdx + 3);

  studentRows.forEach(row => {
    const studentName = row[0];
    if (!studentName || studentName.startsWith('---')) return;

    validIndices.forEach(index => {
      const raw = (row[index] || '').trim();
      
      // Safety Check: If the cell value is identical to the header name, ignore it.
      // This prevents assignment names from appearing in grade mapping if row detection is slightly off.
      if (raw === headerRow[index]?.trim()) return;
      
      // Ignore standard category placeholders if we accidentally hit the category row
      if (raw === '-' || raw === '成绩类别' || raw === 'Category') return;

      // If it has content and is not a valid number, add to set
      if (raw && isNaN(parseFloat(raw))) {
        uniqueSet.add(raw);
      }
    });
  });

  return Array.from(uniqueSet);
};

const STANDARD_GRADES = new Set(['A*', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'U']);

export const processClassInToGradebook = (
  parsedData: ParseResult,
  selectedDate: string,
  gradeMapping: GradeMapping
): TargetRow[] => {
  const { data } = parsedData;

  const headerIdx = findHeaderRowIndex(data);
  // Validation: We need at least Header, MaxMarks, Category, and 1 Data row
  // Header = idx, Max = idx+1, Cat = idx+2, Student = idx+3
  if (data.length < headerIdx + 2) return [];

  const headerRow = data[headerIdx];
  const maxMarksRow = data[headerIdx + 1];
  
  // Student data starts at index + 3 (skipping Category row at idx+2)
  const studentDataRows = data.slice(headerIdx + 3);

  // Identify valid assignments
  const validAssignments: ProcessedAssignment[] = [];

  for (let i = 1; i < headerRow.length; i++) {
    const assignmentName = headerRow[i];
    const maxMarks = maxMarksRow[i] || '';

    // Filter logic: Include numeric max scores.
    // We remove any currency symbols or whitespace to check for number.
    const cleanMaxMarks = maxMarks.replace(/[^\d.]/g, '');
    const isNumeric = !isNaN(parseFloat(cleanMaxMarks)) && cleanMaxMarks !== '';

    if (assignmentName && isNumeric) {
      validAssignments.push({
        name: assignmentName,
        totalMarks: cleanMaxMarks, // Use the cleaned numeric string
        originalIndex: i
      });
    }
  }

  // Generate random dates for each assignment based on selectedDate until Today
  // Note: workingDays will contain strings in dd/mm/yyyy format
  const workingDays = getWorkingDaysFromStartToToday(selectedDate);
  const assignmentDates: Record<string, string> = {};
  
  validAssignments.forEach(assignment => {
    const randomDay = workingDays[Math.floor(Math.random() * workingDays.length)];
    assignmentDates[assignment.name] = randomDay;
  });

  // Prepare fallback date formatted as dd/mm/yyyy just in case logic misses (selectedDate is yyyy-mm-dd)
  let fallbackDate = selectedDate;
  const dateParts = selectedDate.split('-');
  if (dateParts.length === 3) {
    fallbackDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
  }

  // Pre-analyze columns to determine if they are "Pure Status" or "Mixed"
  // Pure Status: No numbers and no standard grades (A-U) in the entire column
  // Mixed: Contains at least one number or standard grade
  // Also calculate average for Mixed columns to use for '已提交'
  const columnStats: Record<string, { type: 'PURE_STATUS' | 'MIXED', average?: number }> = {};

  validAssignments.forEach(assignment => {
    let hasNumeric = false;
    let hasGrade = false;
    const valuesForAverage: number[] = [];
    const totalMarksNum = parseFloat(assignment.totalMarks);

    for (const row of studentDataRows) {
      const studentName = row[0];
      if (!studentName || studentName.startsWith('---')) continue;

      const raw = (row[assignment.originalIndex] || '').trim();
      if (!raw) continue;
      
      // Skip if strictly equals header (safety)
      if (raw === assignment.name.trim()) continue;

      // Explicitly ignore '-' for statistics and average calculation
      if (raw === '-') continue;

      const numericVal = parseFloat(raw);
      if (!isNaN(numericVal)) {
         hasNumeric = true;
         valuesForAverage.push(numericVal);
      } else if (STANDARD_GRADES.has(raw.toUpperCase())) {
         hasGrade = true;
         // Try to map grade to number for average calculation
         // Grade mapping now represents percentage of total marks
         const mapped = gradeMapping[raw.toUpperCase()];
         if (mapped && !isNaN(parseFloat(mapped))) {
            const percentage = parseFloat(mapped);
            const calculatedScore = (percentage / 100) * totalMarksNum;
            valuesForAverage.push(calculatedScore);
         }
      } else {
          // It's a custom status.
          // Check if this status has a mapping value to contribute to the average
          const mapped = gradeMapping[raw.toUpperCase()];
          if (mapped && !isNaN(parseFloat(mapped))) {
              const percentage = parseFloat(mapped);
              const calculatedScore = (percentage / 100) * totalMarksNum;
              valuesForAverage.push(calculatedScore);
          }
      }
    }

    const type = (hasNumeric || hasGrade) ? 'MIXED' : 'PURE_STATUS';
    
    let average = 0;
    if (valuesForAverage.length > 0) {
      average = valuesForAverage.reduce((a, b) => a + b, 0) / valuesForAverage.length;
    }

    columnStats[assignment.name] = { type, average };
  });

  const results: TargetRow[] = [];

  studentDataRows.forEach(row => {
    const studentName = row[0];
    
    // Skip if student name is purely empty or looks like a footer/header
    if (!studentName || studentName.startsWith('---')) return;

    validAssignments.forEach(assignment => {
      let rawMark = row[assignment.originalIndex] || '';
      rawMark = rawMark.trim();
      
      // Skip if matches header (safety)
      if (rawMark === assignment.name.trim()) return;

      let finalMark = '';
      const numericMark = parseFloat(rawMark);
      const upperRaw = rawMark.toUpperCase();
      const stats = columnStats[assignment.name];
      const totalMarksNum = parseFloat(assignment.totalMarks);

      // Explicitly handle '-' to be blank, overriding all other rules
      if (rawMark === '-') {
        finalMark = '';
      } else {
          // Check for context-specific rules first (Rule 1 > Score Mapping)
          let ruleApplied = false;
          let ruleValue = '';

          if (stats.type === 'PURE_STATUS') {
            // Rule 1a: Pure Status column overrides
            // 已提交 = 100% of Total Marks
            if (rawMark === '已提交') { 
              ruleValue = totalMarksNum.toFixed(1); 
              ruleApplied = true; 
            } else if (rawMark === '未提交') { 
              ruleValue = '0'; 
              ruleApplied = true; 
            } else if (rawMark === '已补交') {
              // Rule: 60% for pure status resubmission
              ruleValue = ((60 / 100) * totalMarksNum).toFixed(1);
              ruleApplied = true;
            }
            // Other statuses fall through to mapping
          } else {
            // Rule 1b: Mixed column overrides
            if (rawMark === '未提交') { ruleValue = '0'; ruleApplied = true; }
            // For Mixed columns, '已提交' gets the average score of the column
            else if (rawMark === '已提交') { ruleValue = stats.average?.toFixed(1) || '0'; ruleApplied = true; }
            // Other statuses removed from here to allow gradeMapping to handle them
          }

          if (ruleApplied) {
            finalMark = ruleValue.replace(/\.0$/, '.0');
          } else if (!isNaN(numericMark)) {
            // Check if it's a number first
            finalMark = numericMark.toFixed(1).replace(/\.0$/, '.0'); 
          } else {
            // Fallback to grade mapping
            if (gradeMapping.hasOwnProperty(upperRaw)) {
              const mapped = gradeMapping[upperRaw];
              // Calculate mark as percentage of Total Marks
              if (mapped && !isNaN(parseFloat(mapped))) {
                const percentage = parseFloat(mapped);
                finalMark = ((percentage / 100) * totalMarksNum).toFixed(1).replace(/\.0$/, '.0');
              } else {
                finalMark = '';
              }
            } else {
              // If not found in mapping, leave blank.
              finalMark = '';
            }
          }
      }

      results.push({
        StudentName: studentName,
        AssignmentName: assignment.name,
        AssignmentDate: assignmentDates[assignment.name] || fallbackDate,
        Category: 'Coursework',
        Marks: finalMark,
        TotalMarksPossible: totalMarksNum.toFixed(1)
      });
    });
  });

  return results;
};

export const generateCSVContent = (rows: TargetRow[]): string => {
  const headers = [
    'Student Name',
    'Assignment Name',
    'Assignment Date',
    'Category',
    'Marks',
    'Total Marks Possible'
  ];

  const csvRows = rows.map(row => [
    `"${row.StudentName}"`,
    `"${row.AssignmentName.replace(/"/g, '""')}"`,
    // IMPORTANT: Do NOT quote the date. 
    // This allows Excel to sniff the data type. Since it is dd/mm/yyyy (e.g. 25/09/2023),
    // it contains no commas and is safe to be unquoted in CSV.
    // This helps Excel treat it as a date format rather than a text string.
    row.AssignmentDate,
    `"${row.Category}"`,
    // If mark is empty, leave empty, else quote it
    row.Marks ? `${row.Marks}` : '',
    `${row.TotalMarksPossible}`
  ]);

  return [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
};