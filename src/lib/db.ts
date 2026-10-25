import { Subject, TaskItem, CalendarEntry, StoredFile, BoardState } from '../types';

const DB_NAME = 'persona_notebook_db';
const DB_VERSION = 5; // Bump version to 5 for compatibility with existing DB version

let dbPromise: Promise<IDBDatabase> | null = null;

function setupStores(db: IDBDatabase) {
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

  // Dedicated Board store for task whiteboards (keyed by taskId)
  if (!db.objectStoreNames.contains('board_states')) {
    const boardStore = db.createObjectStore('board_states', { keyPath: 'taskId' });
    boardStore.createIndex('subjectId', 'subjectId', { unique: false });
  }
}

function attachConnectionLifecycleHandlers(db: IDBDatabase) {
  db.onversionchange = () => {
    db.close();
    dbPromise = null;
  };
  db.onclose = () => {
    dbPromise = null;
  };
}

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const tryOpen = (version?: number) => {
      try {
        const request = version !== undefined 
          ? indexedDB.open(DB_NAME, version) 
          : indexedDB.open(DB_NAME);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          setupStores(db);
        };

        request.onblocked = () => {
          dbPromise = null;
          reject(new Error('Локальная база данных IndexedDB заблокирована другим открытым соединением'));
        };

        request.onsuccess = () => {
          const db = request.result;

          // Check if all needed stores exist in case DB was created or opened at different version
          const neededStores = [
            'subjects',
            'tasks',
            'calendar_entries',
            'file_attachments',
            'board_states',
          ];
          const missingStores = neededStores.some((store) => !db.objectStoreNames.contains(store));

          if (missingStores) {
            const nextVersion = db.version + 1;
            db.close();
            const upgradeReq = indexedDB.open(DB_NAME, nextVersion);
            upgradeReq.onupgradeneeded = (ev) => {
              const upgradeDb = (ev.target as IDBOpenDBRequest).result;
              setupStores(upgradeDb);
            };
            upgradeReq.onblocked = () => {
              dbPromise = null;
              reject(new Error('Обновление локальной базы данных IndexedDB заблокировано другим соединением'));
            };
            upgradeReq.onsuccess = () => {
              const upgradedDb = upgradeReq.result;
              attachConnectionLifecycleHandlers(upgradedDb);
              resolve(upgradedDb);
            };
            upgradeReq.onerror = () => {
              dbPromise = null;
              reject(upgradeReq.error || new Error('Не удалось обновить схему локальной базы данных IndexedDB'));
            };
            return;
          }

          attachConnectionLifecycleHandlers(db);
          resolve(db);
        };

        request.onerror = () => {
          // If a VersionError occurs (the browser's existing database has a higher version),
          // fallback to opening without a specified version to open at the current version.
          if (request.error?.name === 'VersionError' && version !== undefined) {
            console.warn(`IndexedDB requested version (${version}) is lower than existing version. Opening at existing version...`);
            tryOpen(undefined);
            return;
          }

          dbPromise = null;
          reject(request.error || new Error('Не удалось открыть локальную базу данных IndexedDB'));
        };
      } catch (e) {
        dbPromise = null;
        reject(e);
      }
    };

    tryOpen(DB_VERSION);
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
      store.put(subject);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Транзакция сохранения предмета прервана'));
    } catch (err) {
      reject(err);
    }
  });
}

// Track per-task board save queues and monotonic timestamps to prevent concurrent or out-of-order writes
const boardSaveQueues = new Map<string, Promise<void>>();
const latestBoardUpdatedAtByTask = new Map<string, number>();
const deletedTaskIds = new Set<string>();

export async function deleteSubject(subjectId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const storeNames = ['subjects', 'tasks', 'calendar_entries', 'file_attachments', 'board_states'];
      const transaction = db.transaction(storeNames, 'readwrite');
      const subjectStore = transaction.objectStore('subjects');
      const taskStore = transaction.objectStore('tasks');
      const calendarStore = transaction.objectStore('calendar_entries');
      const fileStore = transaction.objectStore('file_attachments');
      const boardStore = transaction.objectStore('board_states');

      subjectStore.delete(subjectId);

      // Delete associated tasks, boards, and unreferenced file attachments
      const allTasksReq = taskStore.getAll();
      const allBoardsReq = boardStore.getAll();
      allTasksReq.onsuccess = () => {
        allBoardsReq.onsuccess = () => {
          const allTasks: TaskItem[] = allTasksReq.result || [];
          const allBoards: BoardState[] = allBoardsReq.result || [];

          const subjectTasks = allTasks.filter((t) => t.subjectId === subjectId);
          const subjectTaskIds = new Set(subjectTasks.map((t) => t.id));
          const candidateFileIds = new Set<string>();

          subjectTasks.forEach((t) => {
            deletedTaskIds.add(t.id);
            latestBoardUpdatedAtByTask.delete(t.id);
            boardSaveQueues.delete(t.id);

            if (t.solutionAttachment?.fileId) {
              candidateFileIds.add(t.solutionAttachment.fileId);
            }
            if (t.exampleAttachment?.fileId) {
              candidateFileIds.add(t.exampleAttachment.fileId);
            }
            taskStore.delete(t.id);
          });

          allBoards.forEach((b) => {
            if (b.subjectId === subjectId || subjectTaskIds.has(b.taskId)) {
              deletedTaskIds.add(b.taskId);
              latestBoardUpdatedAtByTask.delete(b.taskId);
              boardSaveQueues.delete(b.taskId);
              b.images?.forEach((img) => {
                if (img.fileId) candidateFileIds.add(img.fileId);
              });
              boardStore.delete(b.taskId);
            }
          });

          const remainingTasks = allTasks.filter((t) => t.subjectId !== subjectId);
          const remainingBoards = allBoards.filter(
            (b) => b.subjectId !== subjectId && !subjectTaskIds.has(b.taskId)
          );

          candidateFileIds.forEach((fid) => {
            const stillUsedInTask = remainingTasks.some(
              (t) => t.exampleAttachment?.fileId === fid || t.solutionAttachment?.fileId === fid
            );
            const stillUsedInBoard = remainingBoards.some((b) =>
              b.images?.some((img) => img.fileId === fid)
            );
            if (!stillUsedInTask && !stillUsedInBoard) {
              fileStore.delete(fid);
            }
          });
        };
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
      transaction.onabort = () => reject(transaction.error || new Error('Транзакция удаления предмета прервана'));
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
  deletedTaskIds.delete(task.id);
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('tasks', 'readwrite');
      const store = transaction.objectStore('tasks');
      store.put(task);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Транзакция сохранения задания прервана'));
    } catch (err) {
      reject(err);
    }
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  deletedTaskIds.add(taskId);
  latestBoardUpdatedAtByTask.delete(taskId);
  boardSaveQueues.delete(taskId);

  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const storeNames = ['tasks', 'file_attachments', 'board_states'];
      const transaction = db.transaction(storeNames, 'readwrite');
      const taskStore = transaction.objectStore('tasks');
      const fileStore = transaction.objectStore('file_attachments');
      const boardStore = transaction.objectStore('board_states');

      const allTasksReq = taskStore.getAll();
      const allBoardsReq = boardStore.getAll();
      allTasksReq.onsuccess = () => {
        allBoardsReq.onsuccess = () => {
          const allTasks: TaskItem[] = allTasksReq.result || [];
          const allBoards: BoardState[] = allBoardsReq.result || [];

          const existing = allTasks.find((t) => t.id === taskId);
          const bState = allBoards.find((b) => b.taskId === taskId);

          const candidateFileIds = new Set<string>();
          if (existing?.solutionAttachment?.fileId) {
            candidateFileIds.add(existing.solutionAttachment.fileId);
          }
          if (existing?.exampleAttachment?.fileId) {
            candidateFileIds.add(existing.exampleAttachment.fileId);
          }
          bState?.images?.forEach((img) => {
            if (img.fileId) candidateFileIds.add(img.fileId);
          });

          boardStore.delete(taskId);
          taskStore.delete(taskId);

          const remainingTasks = allTasks.filter((t) => t.id !== taskId);
          const remainingBoards = allBoards.filter((b) => b.taskId !== taskId);

          candidateFileIds.forEach((fid) => {
            const stillUsedInTask = remainingTasks.some(
              (t) => t.exampleAttachment?.fileId === fid || t.solutionAttachment?.fileId === fid
            );
            const stillUsedInBoard = remainingBoards.some((b) =>
              b.images?.some((img) => img.fileId === fid)
            );
            if (!stillUsedInTask && !stillUsedInBoard) {
              fileStore.delete(fid);
            }
          });
        };
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Транзакция удаления задания прервана'));
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
      store.put(item);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Транзакция сохранения файла прервана'));
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
  if (!fileId) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(['file_attachments', 'board_states', 'tasks'], 'readwrite');
      const fileStore = transaction.objectStore('file_attachments');
      const boardStore = transaction.objectStore('board_states');
      const taskStore = transaction.objectStore('tasks');

      // Do not delete the underlying Blob if any saved board or task still references this fileId
      const boardsReq = boardStore.getAll();
      const tasksReq = taskStore.getAll();
      boardsReq.onsuccess = () => {
        tasksReq.onsuccess = () => {
          const boards: BoardState[] = boardsReq.result || [];
          const tasks: TaskItem[] = tasksReq.result || [];
          const usedOnBoard = boards.some((b) =>
            b.images?.some((img) => img.fileId === fileId)
          );
          const usedInTask = tasks.some(
            (t) =>
              t.exampleAttachment?.fileId === fileId ||
              t.solutionAttachment?.fileId === fileId
          );
          if (!usedOnBoard && !usedInTask) {
            fileStore.delete(fileId);
          }
        };
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Транзакция удаления файла прервана'));
    } catch (err) {
      reject(err);
    }
  });
}

// ------------------- BOARD STATES -------------------

export async function getBoardState(taskId: string): Promise<BoardState | null> {
  // Wait for any pending queued save for this taskId before reading
  const pendingSave = boardSaveQueues.get(taskId);
  if (pendingSave) {
    try {
      await pendingSave;
    } catch {
      // Ignore previous save error and proceed with read
    }
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('board_states', 'readonly');
      const store = transaction.objectStore('board_states');
      const req = store.get(taskId);
      req.onsuccess = () => {
        const result: BoardState | null = req.result || null;
        if (result && typeof result.updatedAt === 'number') {
          const prevTs = latestBoardUpdatedAtByTask.get(taskId) ?? 0;
          if (result.updatedAt > prevTs) {
            latestBoardUpdatedAtByTask.set(taskId, result.updatedAt);
          }
        }
        resolve(result);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function saveBoardState(state: BoardState): Promise<void> {
  if (!state?.taskId || deletedTaskIds.has(state.taskId)) {
    return;
  }

  const taskId = state.taskId;
  const incomingTs = typeof state.updatedAt === 'number' ? state.updatedAt : Date.now();
  const knownLatestTs = latestBoardUpdatedAtByTask.get(taskId) ?? 0;

  // Reject stale snapshot immediately if a newer snapshot was already scheduled
  if (incomingTs < knownLatestTs) {
    return boardSaveQueues.get(taskId) ?? Promise.resolve();
  }

  latestBoardUpdatedAtByTask.set(taskId, incomingTs);

  const previousSave = boardSaveQueues.get(taskId) ?? Promise.resolve();
  const nextSave = previousSave
    .catch(() => {})
    .then(async () => {
      if (deletedTaskIds.has(taskId)) return;

      const currentLatestTs = latestBoardUpdatedAtByTask.get(taskId) ?? 0;
      if (incomingTs < currentLatestTs) {
        // Superseded by a newer queued snapshot while waiting
        return;
      }

      const db = await getDB();
      if (deletedTaskIds.has(taskId) || incomingTs < (latestBoardUpdatedAtByTask.get(taskId) ?? 0)) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction('board_states', 'readwrite');
          const store = transaction.objectStore('board_states');
          const getReq = store.get(taskId);

          getReq.onsuccess = () => {
            if (deletedTaskIds.has(taskId) || incomingTs < (latestBoardUpdatedAtByTask.get(taskId) ?? 0)) {
              return;
            }
            const existing: BoardState | undefined = getReq.result;
            if (
              existing &&
              typeof existing.updatedAt === 'number' &&
              existing.updatedAt > incomingTs
            ) {
              // Never overwrite a newer persisted state with an older one
              latestBoardUpdatedAtByTask.set(taskId, existing.updatedAt);
              return;
            }
            store.put({
              ...state,
              updatedAt: incomingTs,
            });
          };

          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () =>
            reject(transaction.error || new Error('Транзакция сохранения доски прервана'));
        } catch (err) {
          reject(err);
        }
      });
    })
    .finally(() => {
      if (boardSaveQueues.get(taskId) === nextSave) {
        boardSaveQueues.delete(taskId);
      }
    });

  boardSaveQueues.set(taskId, nextSave);
  return nextSave;
}

export async function deleteBoardState(taskId: string): Promise<void> {
  const cutoffTs = Math.max(Date.now(), (latestBoardUpdatedAtByTask.get(taskId) ?? 0) + 1);
  latestBoardUpdatedAtByTask.set(taskId, cutoffTs);

  const previousOp = boardSaveQueues.get(taskId) ?? Promise.resolve();
  const deleteOp = previousOp
    .catch(() => {})
    .then(async () => {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction('board_states', 'readwrite');
          const store = transaction.objectStore('board_states');
          store.delete(taskId);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () =>
            reject(transaction.error || new Error('Транзакция удаления доски прервана'));
        } catch (err) {
          reject(err);
        }
      });
    })
    .finally(() => {
      if (boardSaveQueues.get(taskId) === deleteOp) {
        boardSaveQueues.delete(taskId);
      }
    });

  boardSaveQueues.set(taskId, deleteOp);
  return deleteOp;
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
      store.put(entry);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Транзакция сохранения записи календаря прервана'));
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
      store.delete(entryId);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Транзакция удаления записи календаря прервана'));
    } catch (err) {
      reject(err);
    }
  });
}

// ------------------- INITIAL SEEDING -------------------

export async function initializeDatabaseIfEmpty(): Promise<void> {
  await getDB();
}
