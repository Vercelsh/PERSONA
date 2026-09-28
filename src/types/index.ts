export interface Subject {
  id: string;
  title: string;
  order: number;
  createdAt: number;
}

export interface SolutionAttachment {
  fileId: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: number;
  dataUrl?: string; // backward compatibility with legacy base64 if present
}

export interface StoredFile {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  uploadedAt: number;
}

export interface TaskItem {
  id: string;
  subjectId: string;
  taskNumber: number;
  title: string;
  example: string;
  exampleAttachment?: SolutionAttachment | null;
  notes: string;
  solutionAttachment: SolutionAttachment | null;
  solutionText?: string;
  updatedAt: number;
  createdAt: number;
}

export interface CalendarEntry {
  id: string;
  date: string; // YYYY-MM-DD
  subjectId: string;
  durationHours: number;
  durationMinutes: number;
  taskNumbers: string; // e.g. "№ 5, № 8, № 12"
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export type MainNavSection = 'subjects' | 'calendar';
