import { Subject, TaskItem, CalendarEntry, StoredFile } from '../types';

const DB_NAME = 'persona_notebook_db';
const DB_VERSION = 3; // Bump version so existing browser test sessions auto-reset cleanly

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // If migrating from previous test version, clear all stores cleanly
        if (event.oldVersion > 0 && event.oldVersion < 3) {
          if (db.objectStoreNames.contains('subjects')) db.deleteObjectStore('subjects');
          if (db.objectStoreNames.contains('tasks')) db.deleteObjectStore('tasks');
          if (db.objectStoreNames.contains('calendar_entries')) db.deleteObjectStore('calendar_entries');
          if (db.objectStoreNames.contains('file_attachments')) db.deleteObjectStore('file_attachments');
        }

        if (!db.objectStoreNames.contains('subjects')) {
          const subjectStore = db.createObjectStore('subjects', { keyPath: 'id' });
          subjectStore.createIndex('order', 'order', { unique: false });
        }

        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('subjectId', 'subjectId', { unique: false });
          taskStore.createIndex('taskNumber', 'taskNumber', { unique: false });
        }

        if (!db.objectStoreNames.contains('calendar_entries')) {
          const calendarStore = db.createObjectStore('calendar_entries', { keyPath: 'id' });
          calendarStore.createIndex('date', 'date', { unique: false });
        }

        // Dedicated Blob/binary store for attachments (saves memory, prevents huge Base64 strings)
        if (!db.objectStoreNames.contains('file_attachments')) {
          db.createObjectStore('file_attachments', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error('Не удалось открыть локальную базу данных IndexedDB'));
      };
    } catch (e) {
      dbPromise = null;
      reject(e);
    }
  });

  return dbPromise;
}

// ------------------- SUBJECTS -------------------

export async function getAllSubjects(): Promise<Subject[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('subjects', 'readonly');
      const store = transaction.objectStore('subjects');
      const request = store.getAll();

      request.onsuccess = () => {
        const subjects: Subject[] = request.result || [];
        subjects.sort((a, b) => a.order - b.order);
        resolve(subjects);
      };
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function saveSubject(subject: Subject): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('subjects', 'readwrite');
      const store = transaction.objectStore('subjects');
      const request = store.put(subject);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(
        ['subjects', 'tasks', 'calendar_entries', 'file_attachments'],
        'readwrite'
      );
      const subjectStore = transaction.objectStore('subjects');
      const taskStore = transaction.objectStore('tasks');
      const calendarStore = transaction.objectStore('calendar_entries');
      const fileStore = transaction.objectStore('file_attachments');

      subjectStore.delete(subjectId);

      // Delete associated tasks and their file attachments
      const taskIndex = taskStore.index('subjectId');
      const taskRequest = taskIndex.getAll(subjectId);
      taskRequest.onsuccess = () => {
        const tasks: TaskItem[] = taskRequest.result || [];
        tasks.forEach((t) => {
          if (t.solutionAttachment?.fileId) {
            fileStore.delete(t.solutionAttachment.fileId);
          }
          taskStore.delete(t.id);
        });
      };

      // Also clean calendar entries referencing this subject
      const calRequest = calendarStore.getAll();
      calRequest.onsuccess = () => {
        const entries: CalendarEntry[] = calRequest.result || [];
        entries.forEach((e) => {
          if (e.subjectId === subjectId) {
            calendarStore.delete(e.id);
          }
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    } catch (err) {
      reject(err);
    }
  });
}

// ------------------- TASKS -------------------

export async function getTasksForSubject(subjectId: string): Promise<TaskItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('tasks', 'readonly');
      const store = transaction.objectStore('tasks');
      const index = store.index('subjectId');
      const request = index.getAll(subjectId);

      request.onsuccess = () => {
        const tasks: TaskItem[] = request.result || [];
        tasks.sort((a, b) => a.taskNumber - b.taskNumber);
        resolve(tasks);
      };
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function getTaskById(taskId: string): Promise<TaskItem | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('tasks', 'readonly');
      const store = transaction.objectStore('tasks');
      const request = store.get(taskId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function saveTask(task: TaskItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('tasks', 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(['tasks', 'file_attachments'], 'readwrite');
      const taskStore = transaction.objectStore('tasks');
      const fileStore = transaction.objectStore('file_attachments');

      const getReq = taskStore.get(taskId);
      getReq.onsuccess = () => {
        const existing: TaskItem | undefined = getReq.result;
        if (existing?.solutionAttachment?.fileId) {
          fileStore.delete(existing.solutionAttachment.fileId);
        }
        taskStore.delete(taskId);
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    } catch (err) {
      reject(err);
    }
  });
}

// ------------------- FILE ATTACHMENTS (Blob Storage) -------------------

export async function saveFileAttachment(
  fileId: string,
  blob: Blob,
  name: string,
  type: string,
  size: number
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('file_attachments', 'readwrite');
      const store = transaction.objectStore('file_attachments');
      const item: StoredFile = {
        id: fileId,
        blob,
        name,
        type,
        size,
        uploadedAt: Date.now(),
      };
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function getFileAttachment(fileId: string): Promise<StoredFile | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('file_attachments', 'readonly');
      const store = transaction.objectStore('file_attachments');
      const req = store.get(fileId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function deleteFileAttachment(fileId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('file_attachments', 'readwrite');
      const store = transaction.objectStore('file_attachments');
      const req = store.delete(fileId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

// ------------------- CALENDAR ENTRIES -------------------

export async function getAllCalendarEntries(): Promise<CalendarEntry[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('calendar_entries', 'readonly');
      const store = transaction.objectStore('calendar_entries');
      const request = store.getAll();

      request.onsuccess = () => {
        const entries: CalendarEntry[] = request.result || [];
        entries.sort((a, b) => b.createdAt - a.createdAt);
        resolve(entries);
      };
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function saveCalendarEntry(entry: CalendarEntry): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('calendar_entries', 'readwrite');
      const store = transaction.objectStore('calendar_entries');
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function deleteCalendarEntry(entryId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('calendar_entries', 'readwrite');
      const store = transaction.objectStore('calendar_entries');
      const request = store.delete(entryId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

// ------------------- INITIAL SEEDING -------------------

export async function initializeDatabaseIfEmpty(): Promise<void> {
  // Database initializes schema stores automatically via onupgradeneeded.
  // Out of the box, the app starts completely pristine and empty.
  // The user creates their own subjects, tasks, and calendar records.
  return Promise.resolve();
}

