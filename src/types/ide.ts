/**
 * Supported file languages/types in Persona IDE
 */
export type IdeFileLanguage = 'python' | 'text';

/**
 * File inside a task IDE project (e.g. main.py, helper.py, 27_A.txt)
 */
export interface IdeFile {
  id: string;
  name: string;
  content: string;
  language: IdeFileLanguage;
}

/**
 * IDE project bound to a specific task
 */
export interface IdeProject {
  taskId: string;
  files: IdeFile[];
  activeFileId: string;
  updatedAt: number;
}

/**
 * Execution status of the Python process
 */
export type ProcessStatus = 'idle' | 'running' | 'completed' | 'terminated' | 'error';

/**
 * Terminal output stream type
 */
export type TerminalOutputType = 'stdout' | 'stderr' | 'stdin' | 'system';

/**
 * An output line in the interactive terminal
 */
export interface TerminalOutputLine {
  id: string;
  type: TerminalOutputType;
  text: string;
  timestamp: number;
}
