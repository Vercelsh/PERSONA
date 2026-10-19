import { getDB } from './db';
import { IdeProject, IdeFile, IdeFileLanguage } from '../types/ide';

const STORE_NAME = 'ide_projects';

/**
 * Detects file language based on extension
 */
export function detectLanguage(fileName: string): IdeFileLanguage {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  return 'text';
}

/**
 * Creates a default starter IDE project on-demand for a given task.
 * Called only when the user explicitly requests/opens the IDE for that task.
 */
export function createDefaultProject(taskId: string): IdeProject {
  const mainFileId = `file-${Date.now()}-main`;
  const defaultFile: IdeFile = {
    id: mainFileId,
    name: 'main.py',
    content: '# Решение задания ЕГЭ\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n',
    language: 'python',
  };

  return {
    taskId,
    files: [defaultFile],
    activeFileId: mainFileId,
    updatedAt: Date.now(),
  };
}

/**
 * Retrieves the stored IDE project for a specific task.
 * Returns null if no project has been created yet or if taskId is invalid.
 */
export async function getIdeProject(taskId: string): Promise<IdeProject | null> {
  if (!taskId || typeof taskId !== 'string') {
    return null;
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve(null);
        return;
      }

      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(taskId);

      request.onsuccess = () => {
        const result = request.result as IdeProject | undefined;
        if (!result || !Array.isArray(result.files) || result.files.length === 0) {
          resolve(null);
          return;
        }

        // Validate that activeFileId points to an existing file
        const activeExists = result.files.some((f) => f.id === result.activeFileId);
        const validatedProject: IdeProject = {
          ...result,
          activeFileId: activeExists ? result.activeFileId : result.files[0].id,
        };

        resolve(validatedProject);
      };

      request.onerror = () => {
        reject(request.error || new Error(`Не удалось загрузить проект IDE для задачи ${taskId}`));
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Saves or updates an IDE project for a task.
 * Using keyPath 'taskId' ensures idempotent updates without creating duplicates.
 */
export async function saveIdeProject(project: IdeProject): Promise<void> {
  if (!project || !project.taskId) {
    throw new Error('Невозможно сохранить проект IDE: отсутствует taskId');
  }

  // Ensure files array is not empty
  if (!Array.isArray(project.files) || project.files.length === 0) {
    throw new Error('Невозможно сохранить проект IDE: проект должен содержать хотя бы один файл');
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const toSave: IdeProject = {
        taskId: project.taskId,
        files: project.files.map((f) => ({
          id: f.id,
          name: f.name.trim() || 'untitled.py',
          content: typeof f.content === 'string' ? f.content : '',
          language: f.language || detectLanguage(f.name),
        })),
        activeFileId: project.activeFileId || project.files[0].id,
        updatedAt: Date.now(),
      };

      const request = store.put(toSave);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error || new Error(`Ошибка сохранения проекта IDE для задачи ${project.taskId}`));
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes an IDE project associated with a task
 */
export async function deleteIdeProject(taskId: string): Promise<void> {
  if (!taskId) return;

  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve();
        return;
      }

      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(taskId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error || new Error(`Ошибка удаления проекта IDE для задачи ${taskId}`));
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Helper to add a new file to an existing project (e.g., solution.py or 27_A.txt)
 */
export function addFileToProject(
  project: IdeProject,
  fileName: string,
  initialContent = ''
): { project: IdeProject; newFileId: string } {
  const newId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newFile: IdeFile = {
    id: newId,
    name: fileName.trim() || 'file.py',
    content: initialContent,
    language: detectLanguage(fileName),
  };

  const updatedProject: IdeProject = {
    ...project,
    files: [...project.files, newFile],
    activeFileId: newId,
    updatedAt: Date.now(),
  };

  return { project: updatedProject, newFileId: newId };
}
