export interface SourceRow {
  [key: string]: string;
}

export interface ProcessedAssignment {
  name: string;
  totalMarks: string;
  originalIndex: number; // Column index in the source CSV
}

export interface TargetRow {
  StudentName: string;
  AssignmentName: string;
  AssignmentDate: string;
  Category: string;
  Marks: string;
  TotalMarksPossible: string;
}

export interface ParseResult {
  headers: string[];
  data: string[][]; // 2D array of strings
}

export interface GradeMapping {
  [grade: string]: string; // keeping value as string to allow flexible user input (though usually numeric)
}
