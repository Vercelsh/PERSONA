import React, { useState, useRef, useEffect } from 'react';
import { IdeFile } from '../../types/ide';
import { FileCode, FileText, Plus, X, Edit2, Check } from 'lucide-react';

interface IdeTabsProps {
  files: IdeFile[];
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  onAddFile: (fileName: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
}

export const IdeTabs: React.FC<IdeTabsProps> = ({
  files,
  activeFileId,
  onSelectFile,
  onAddFile,
  onDeleteFile,
  onRenameFile,
}) => {
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isCreatingFile) {
      inputRef.current?.focus();
    }
  }, [isCreatingFile]);

  useEffect(() => {
    if (renamingFileId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingFileId]);

  const handleStartCreate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCreatingFile(true);
    setNewFileName('');
  };

  const handleCommitCreate = () => {
    const trimmed = newFileName.trim();
    if (trimmed) {
      // Add default extension if not provided
      const finalName = trimmed.includes('.') ? trimmed : `${trimmed}.py`;
      onAddFile(finalName);
    }
    setIsCreatingFile(false);
    setNewFileName('');
  };

  const handleKeyDownCreate = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitCreate();
    } else if (e.key === 'Escape') {
      setIsCreatingFile(false);
      setNewFileName('');
    }
  };

  const handleStartRename = (file: IdeFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingFileId(file.id);
    setRenameValue(file.name);
  };

  const handleCommitRename = () => {
    if (renamingFileId) {
      const trimmed = renameValue.trim();
      if (trimmed) {
        onRenameFile(renamingFileId, trimmed);
      }
    }
    setRenamingFileId(null);
    setRenameValue('');
  };

  const handleKeyDownRename = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitRename();
    } else if (e.key === 'Escape') {
      setRenamingFileId(null);
      setRenameValue('');
    }
  };

  return (
    <div
      className="flex items-center bg-[#111111] border-b border-white/[0.08] px-2 h-9 overflow-x-auto select-none no-scrollbar"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 min-w-0">
        {files.map((file) => {
          const isActive = file.id === activeFileId;
          const isRenaming = renamingFileId === file.id;
          const isPython = file.name.endsWith('.py');

          return (
            <div
              key={file.id}
              onClick={() => onSelectFile(file.id)}
              className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-md transition-all cursor-pointer max-w-[180px] shrink-0 border-t-2 ${
                isActive
                  ? 'bg-[#0a0a0a] text-white border-white font-medium shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04] border-transparent'
              }`}
            >
              {isPython ? (
                <FileCode className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-neutral-500'}`} />
              ) : (
                <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-neutral-500'}`} />
              )}

              {isRenaming ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleKeyDownRename}
                    onBlur={handleCommitRename}
                    className="bg-black/60 text-white px-1 py-0.5 rounded text-xs outline-none border border-white/20 w-24"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCommitRename();
                    }}
                    className="p-0.5 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span
                  onDoubleClick={(e) => handleStartRename(file, e)}
                  title={`${file.name} (двойной клик для переименования)`}
                  className="truncate text-[11px]"
                >
                  {file.name}
                </span>
              )}

              {/* Action buttons (Rename / Delete) */}
              {!isRenaming && (
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-1 gap-0.5">
                  <button
                    onClick={(e) => handleStartRename(file, e)}
                    title="Переименовать"
                    className="p-0.5 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>

                  {files.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(file.id);
                      }}
                      title="Удалить файл"
                      className="p-0.5 rounded text-neutral-400 hover:text-red-400 hover:bg-white/10 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* New File Inline Form */}
        {isCreatingFile ? (
          <div className="flex items-center gap-1 px-2 py-1 bg-black/60 rounded border border-white/20 text-xs">
            <input
              ref={inputRef}
              type="text"
              placeholder="имя_файла.py"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={handleKeyDownCreate}
              onBlur={handleCommitCreate}
              className="bg-transparent text-white text-[11px] outline-none w-28 placeholder:text-neutral-500"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={handleCommitCreate}
              className="p-0.5 text-emerald-400 hover:text-emerald-300"
              title="Создать"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsCreatingFile(false)}
              className="p-0.5 text-neutral-400 hover:text-neutral-300"
              title="Отмена"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartCreate}
            title="Создать новый файл"
            className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded transition-colors ml-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
