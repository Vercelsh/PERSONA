/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Subject, TaskItem, CalendarEntry, MainNavSection } from './types';
import {
  initializeDatabaseIfEmpty,
  getAllSubjects,
  saveSubject,
  deleteSubject,
  getTasksForSubject,
  saveTask,
  deleteTask,
  getAllCalendarEntries,
  saveCalendarEntry,
  deleteCalendarEntry,
} from './lib/db';
import { IntroScreen } from './components/IntroScreen';
import { TopNav } from './components/TopNav';
import { PersonaLogo } from './components/PersonaLogo';
import { SubjectsView } from './components/subjects/SubjectsView';
import { SubjectDetailView } from './components/subjects/SubjectDetailView';
import { TaskDetailView } from './components/subjects/TaskDetailView';
import { CalendarView } from './components/calendar/CalendarView';
import { nativeToggleFullscreen, subscribeToWindowState } from './lib/tauriWindow';

export default function App() {
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Real-time Window State synchronized directly with OS events
  const [windowState, setWindowState] = useState<{ isMaximized: boolean; isFullscreen: boolean }>({
    isMaximized: false,
    isFullscreen: false,
  });

  useEffect(() => {
    return subscribeToWindowState(setWindowState);
  }, []);

  // Navigation
  const [currentSection, setCurrentSection] = useState<MainNavSection>('subjects');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // App State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasksBySubject, setTasksBySubject] = useState<Record<string, TaskItem[]>>({});
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);

  // Load all data from IndexedDB
  const reloadData = useCallback(async () => {
    try {
      setStorageError(null);
      await initializeDatabaseIfEmpty();

      const loadedSubjects = await getAllSubjects();
      setSubjects(loadedSubjects);

      // Load tasks for all subjects
      const tasksMap: Record<string, TaskItem[]> = {};
      for (const subj of loadedSubjects) {
        tasksMap[subj.id] = await getTasksForSubject(subj.id);
      }
      setTasksBySubject(tasksMap);

      const entries = await getAllCalendarEntries();
      setCalendarEntries(entries);
    } catch (err) {
      console.error('Failed to load data from IndexedDB:', err);
      setStorageError(
        'Не удалось получить доступ к локальному хранилищу IndexedDB. Проверьте разрешения браузера или обновите страницу.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Global F11 fullscreen shortcut listener (F12 removed)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        nativeToggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Section switcher
  const handleSelectSection = (section: MainNavSection) => {
    setCurrentSection(section);
    // If switching to subjects from calendar, reset deep selection if needed or keep current
    if (section === 'subjects' && !selectedSubjectId) {
      // Stay on list
    }
  };

  // Subject operations
  const handleAddSubject = async (title: string) => {
    const newSubject: Subject = {
      id: `subj-${Date.now()}`,
      title,
      order: subjects.length + 1,
      createdAt: Date.now(),
    };
    await saveSubject(newSubject);
    await reloadData();
  };

  const handleRenameSubject = async (subjectId: string, newTitle: string) => {
    const target = subjects.find((s) => s.id === subjectId);
    if (!target) return;
    await saveSubject({ ...target, title: newTitle });
    await reloadData();
  };

  const handleDeleteSubject = async (subjectId: string) => {
    await deleteSubject(subjectId);
    if (selectedSubjectId === subjectId) {
      setSelectedSubjectId(null);
      setSelectedTaskId(null);
    }
    await reloadData();
  };

  // Task operations
  const handleAddTask = async (title: string, taskNumber: number) => {
    if (!selectedSubjectId) return;
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      subjectId: selectedSubjectId,
      taskNumber,
      title,
      example: '',
      exampleAttachment: null,
      notes: '',
      solutionAttachment: null,
      solutionText: '',
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    await saveTask(newTask);

    // Update in-memory state
    setTasksBySubject((prev) => ({
      ...prev,
      [selectedSubjectId]: [...(prev[selectedSubjectId] || []), newTask].sort(
        (a, b) => a.taskNumber - b.taskNumber
      ),
    }));
  };

  const handleSaveTask = async (updatedTask: TaskItem) => {
    await saveTask(updatedTask);
    setTasksBySubject((prev) => {
      const list = prev[updatedTask.subjectId] || [];
      return {
        ...prev,
        [updatedTask.subjectId]: list.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      };
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedSubjectId) return;
    await deleteTask(taskId);
    setTasksBySubject((prev) => ({
      ...prev,
      [selectedSubjectId]: (prev[selectedSubjectId] || []).filter((t) => t.id !== taskId),
    }));
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  };

  // Calendar operations
  const handleAddCalendarEntry = async (
    entry: Omit<CalendarEntry, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const newEntry: CalendarEntry = {
      ...entry,
      id: `cal-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveCalendarEntry(newEntry);
    setCalendarEntries((prev) => [newEntry, ...prev]);
  };

  const handleUpdateCalendarEntry = async (entry: CalendarEntry) => {
    await saveCalendarEntry(entry);
    setCalendarEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
  };

  const handleDeleteCalendarEntry = async (entryId: string) => {
    await deleteCalendarEntry(entryId);
    setCalendarEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  // Current selections
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId);
  const currentSubjectTasks = selectedSubjectId ? tasksBySubject[selectedSubjectId] || [] : [];
  const currentTask = currentSubjectTasks.find((t) => t.id === selectedTaskId);

  const isWindowMaximized = windowState.isMaximized || windowState.isFullscreen;

  return (
    <div className="w-full h-full bg-[#0a0a0a] text-neutral-100 flex flex-col overflow-hidden select-none border border-white/[0.08]">
      {/* Intro Animation */}
      <AnimatePresence>
        {showIntro && <IntroScreen onComplete={() => setShowIntro(false)} />}
      </AnimatePresence>

      {/* Main Unified Top Navigation (Draggable Custom Titlebar + Controls + Navigation) */}
      <TopNav
        currentSection={currentSection}
        onSelectSection={handleSelectSection}
        onLogoClick={() => {
          setCurrentSection('subjects');
          setSelectedSubjectId(null);
          setSelectedTaskId(null);
        }}
        isMaximized={isWindowMaximized}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-12 persona-bg-ambient select-none">
          {storageError && (
            <div className="max-w-xl mx-auto mt-6 px-4">
              <div className="p-3.5 rounded-xl border border-white/[0.15] bg-[#141414] text-xs text-neutral-300 flex items-center justify-between gap-3">
                <span>{storageError}</span>
                <button
                  onClick={() => reloadData()}
                  className="px-2.5 py-1 rounded bg-white/[0.1] hover:bg-white/[0.2] text-white font-medium transition-colors shrink-0"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <motion.div
              key={`${currentSection}-${selectedSubjectId || 'root'}-${selectedTaskId || 'none'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {currentSection === 'subjects' && (
                <>
                  {selectedTaskId && currentTask && currentSubject ? (
                    <TaskDetailView
                      task={currentTask}
                      subject={currentSubject}
                      allTasks={currentSubjectTasks}
                      onBack={() => setSelectedTaskId(null)}
                      onSave={handleSaveTask}
                      onDelete={handleDeleteTask}
                      onSelectTask={(id) => setSelectedTaskId(id)}
                    />
                  ) : selectedSubjectId && currentSubject ? (
                    <SubjectDetailView
                      subject={currentSubject}
                      tasks={currentSubjectTasks}
                      onBack={() => setSelectedSubjectId(null)}
                      onSelectTask={(taskId) => setSelectedTaskId(taskId)}
                      onAddTask={handleAddTask}
                      onDeleteTask={handleDeleteTask}
                      onRenameSubject={(newTitle: string) => handleRenameSubject(currentSubject.id, newTitle)}
                    />
                  ) : (
                    <SubjectsView
                      subjects={subjects}
                      tasksBySubject={tasksBySubject}
                      onSelectSubject={(id) => setSelectedSubjectId(id)}
                      onAddSubject={handleAddSubject}
                      onRenameSubject={handleRenameSubject}
                      onDeleteSubject={handleDeleteSubject}
                    />
                  )}
                </>
              )}

              {currentSection === 'calendar' && (
                <CalendarView
                  subjects={subjects}
                  entries={calendarEntries}
                  onAddEntry={handleAddCalendarEntry}
                  onUpdateEntry={handleUpdateCalendarEntry}
                  onDeleteEntry={handleDeleteCalendarEntry}
                />
              )}
            </motion.div>
          )}
        </main>
    </div>
  );
}
