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

export type MainNavSection = 'subjects' | 'calendar' | 'board';

// ==========================================
// INTERACTIVE BOARD (WHITEBOARD) TYPES
// ==========================================

export type BoardTool = 'select' | 'pan' | 'pen' | 'eraser' | 'text' | 'image' | 'shape';
export type EraserMode = 'object' | 'area';

export type ShapeType =
  | 'square'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'right-triangle'
  | 'right-triangle-flipped'
  | 'cube'
  | 'rhombus'
  | 'trapezoid'
  | 'parallelogram'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'arrow-right'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-down'
  | 'line-h'
  | 'line-v'
  | 'line-slash'
  | 'line-backslash'
  | 'line-custom';

export interface BoardShapeObject {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth?: number;
  rotation?: number;
}

export interface BoardPoint {
  x: number;
  y: number;
}

export interface BoardStroke {
  id: string;
  points: BoardPoint[];
  color: string;
  width: number;
  opacity?: number;
}

export interface BoardTextObject {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  width?: number;
  height?: number;
  rotation?: number; // degrees
}

export interface BoardImageObject {
  id: string;
  fileId?: string; // stored in IndexedDB file_attachments store
  dataUrl?: string; // fallback or immediate object URL
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface SelectedItem {
  type: 'image' | 'text' | 'stroke' | 'shape';
  id: string;
}

export interface BoardState {
  subjectId: string;
  taskId: string;
  strokes: BoardStroke[];
  texts: BoardTextObject[];
  images: BoardImageObject[];
  shapes?: BoardShapeObject[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  updatedAt: number;
}

export * from './ide';

