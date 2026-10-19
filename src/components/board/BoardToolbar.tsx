import React, { useState, useRef, useEffect } from 'react';
import { BoardTool, EraserMode, ShapeType } from '../../types';
import {
  MousePointer,
  Hand,
  Pen,
  Eraser,
  Type,
  Shapes,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Trash2,
  Minus,
  Plus,
} from 'lucide-react';
import { SHAPE_DEFINITIONS, SHAPE_MAP, ShapeIcon } from './shapeDefinitions';

interface BoardToolbarProps {
  activeTool: BoardTool;
  onChangeTool: (tool: BoardTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddImageClick: () => void;
  selectedColor: string;
  onChangeColor: (color: string) => void;
  strokeWidth: number;
  onChangeStrokeWidth: (width: number) => void;
  textColor: string;
  onChangeTextColor: (color: string) => void;
  textFontSize: number;
  onChangeTextFontSize: (size: number) => void;
  selectedShapeType: ShapeType;
  onSelectShapeType: (type: ShapeType) => void;
  shapeColor: string;
  onChangeShapeColor: (color: string) => void;
  eraserMode: EraserMode;
  onChangeEraserMode: (mode: EraserMode) => void;
  eraserRadius: number;
  onChangeEraserRadius: (radius: number) => void;
  selectedCount: number;
  onDeleteSelected: () => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onPointerEnterToolbar?: () => void;
}

// 12 functional colors
const COLOR_PALETTE = [
  { label: 'Чёрный', value: '#111111' },
  { label: 'Тёмно-серый', value: '#4b5563' },
  { label: 'Серый', value: '#9ca3af' },
  { label: 'Белый', value: '#ffffff' },
  { label: 'Красный', value: '#ef4444' },
  { label: 'Оранжевый', value: '#f97316' },
  { label: 'Жёлтый', value: '#eab308' },
  { label: 'Зелёный', value: '#22c55e' },
  { label: 'Голубой', value: '#06b6d4' },
  { label: 'Синий', value: '#3b82f6' },
  { label: 'Фиолетовый', value: '#a855f7' },
  { label: 'Розовый', value: '#ec4899' },
];

export const BoardToolbar: React.FC<BoardToolbarProps> = ({
  activeTool,
  onChangeTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddImageClick,
  selectedColor,
  onChangeColor,
  strokeWidth,
  onChangeStrokeWidth,
  textColor,
  onChangeTextColor,
  textFontSize,
  onChangeTextFontSize,
  selectedShapeType,
  onSelectShapeType,
  shapeColor,
  onChangeShapeColor,
  eraserMode,
  onChangeEraserMode,
  eraserRadius,
  onChangeEraserRadius,
  selectedCount,
  onDeleteSelected,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onPointerEnterToolbar,
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isTextColorPickerOpen, setIsTextColorPickerOpen] = useState(false);
  const [isShapesMenuOpen, setIsShapesMenuOpen] = useState(false);
  const [isShapeColorPickerOpen, setIsShapeColorPickerOpen] = useState(false);

  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const textColorPickerRef = useRef<HTMLDivElement | null>(null);
  const shapesMenuRef = useRef<HTMLDivElement | null>(null);
  const shapeColorPickerRef = useRef<HTMLDivElement | null>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
      if (textColorPickerRef.current && !textColorPickerRef.current.contains(e.target as Node)) {
        setIsTextColorPickerOpen(false);
      }
      if (shapesMenuRef.current && !shapesMenuRef.current.contains(e.target as Node)) {
        setIsShapesMenuOpen(false);
      }
      if (shapeColorPickerRef.current && !shapeColorPickerRef.current.contains(e.target as Node)) {
        setIsShapeColorPickerOpen(false);
      }
    };
    if (isColorPickerOpen || isTextColorPickerOpen || isShapesMenuOpen || isShapeColorPickerOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isColorPickerOpen, isTextColorPickerOpen, isShapesMenuOpen, isShapeColorPickerOpen]);

  // Stop pointer events from propagating to the canvas underneath
  const stopPointer = (e: React.PointerEvent | React.MouseEvent | React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      onPointerDown={stopPointer}
      onPointerMove={stopPointer}
      onPointerUp={stopPointer}
      onPointerEnter={(e) => {
        stopPointer(e);
        onPointerEnterToolbar?.();
      }}
      onPointerLeave={stopPointer}
      onMouseDown={stopPointer}
      onMouseMove={stopPointer}
      onMouseUp={stopPointer}
      onClick={stopPointer}
      onDoubleClick={stopPointer}
      onContextMenu={stopPointer}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center p-1.5 rounded-2xl bg-[#0c0c0c] border border-white/[0.12] shadow-2xl backdrop-blur-md text-white select-none max-w-[96vw] transition-all duration-300 ease-out pointer-events-auto cursor-default"
    >
      {/* Primary Tools */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onChangeTool('select')}
          title="Выбор / Select (V)"
          className={`p-2 rounded-xl text-xs flex items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTool === 'select'
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
          }`}
        >
          <MousePointer className="w-4 h-4" />
        </button>

        <button
          onClick={() => onChangeTool('pan')}
          title="Рука / Pan (H / Space)"
          className={`p-2 rounded-xl text-xs flex items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTool === 'pan'
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>

        <button
          onClick={() => onChangeTool('pen')}
          title="Карандаш / Pen (P)"
          className={`p-2 rounded-xl text-xs flex items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTool === 'pen'
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
          }`}
        >
          <Pen className="w-4 h-4" />
        </button>

        <button
          onClick={() => onChangeTool('eraser')}
          title="Ластик / Eraser (E)"
          className={`p-2 rounded-xl text-xs flex items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTool === 'eraser'
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
          }`}
        >
          <Eraser className="w-4 h-4" />
        </button>

        {/* SHAPES TOOL BUTTON WITH DROPDOWN MENU */}
        <div className="relative" ref={shapesMenuRef}>
          <button
            onClick={() => {
              setIsShapesMenuOpen((prev) => !prev);
            }}
            title="Фигуры / Shapes"
            className={`p-2 rounded-xl text-xs flex items-center justify-center transition-all duration-150 cursor-pointer ${
              activeTool === 'shape' || isShapesMenuOpen
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <Shapes className="w-4 h-4" />
          </button>

          {/* Shapes Popup Menu */}
          {isShapesMenuOpen && (
            <div
              onPointerDown={stopPointer}
              onPointerMove={stopPointer}
              onPointerUp={stopPointer}
              onMouseDown={stopPointer}
              onMouseMove={stopPointer}
              onMouseUp={stopPointer}
              onClick={stopPointer}
              className="absolute top-12 left-1/2 -translate-x-1/2 p-3 rounded-2xl bg-[#0e0e0e]/95 backdrop-blur-xl border border-white/[0.14] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 w-[276px] pointer-events-auto cursor-default flex flex-col gap-2.5"
            >
              {/* Header with Title and Shape Color */}
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-semibold text-neutral-300">Фигуры</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-400">Цвет:</span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm shrink-0"
                    style={{ backgroundColor: shapeColor }}
                  />
                </div>
              </div>

              {/* Color Palette Grid: 2 rows of 6 */}
              <div className="grid grid-cols-6 gap-1.5 p-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => onChangeShapeColor(c.value)}
                    title={c.label}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      shapeColor === c.value
                        ? 'ring-2 ring-white scale-110 shadow-sm'
                        : 'hover:scale-110 opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: c.value,
                      border: c.value === '#ffffff' ? '1px solid rgba(0,0,0,0.3)' : '1px solid rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>

              {/* Subtle Divider */}
              <div className="w-full h-[1px] bg-white/[0.08]" />

              {/* 24 Shapes Grid: 6 columns x 4 rows */}
              <div className="grid grid-cols-6 gap-1">
                {SHAPE_DEFINITIONS.map((def) => {
                  const isSelected = activeTool === 'shape' && selectedShapeType === def.type;
                  return (
                    <button
                      key={def.type}
                      onClick={() => {
                        onSelectShapeType(def.type);
                        onChangeTool('shape');
                        setIsShapesMenuOpen(false);
                      }}
                      title={def.label}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black shadow-md scale-105 font-bold'
                          : 'text-neutral-300 hover:text-white hover:bg-white/[0.1] hover:scale-105'
                      }`}
                    >
                      <ShapeIcon type={def.type} className="w-4.5 h-4.5 text-current" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => onChangeTool('text')}
          title="Текст / Text (T)"
          className={`p-2 rounded-xl text-xs flex items-center justify-center transition-all duration-150 cursor-pointer ${
            activeTool === 'text'
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
          }`}
        >
          <Type className="w-4 h-4" />
        </button>

        <button
          onClick={onAddImageClick}
          title="Добавить изображение / Image"
          className="p-2 rounded-xl text-xs flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-all duration-150 cursor-pointer"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
      </div>

      {/* PEN SUB-TOOLBAR (Smooth width expansion & fade-in) */}
      <div
        className={`flex items-center overflow-visible transition-all duration-300 ease-out cursor-default ${
          activeTool === 'pen'
            ? 'max-w-[320px] opacity-100 ml-1.5 mr-0.5'
            : 'max-w-0 opacity-0 overflow-hidden pointer-events-none m-0'
        }`}
      >
        <div className="w-[1px] h-5 bg-white/[0.1] shrink-0 mr-2 cursor-default" />

        <div className="flex items-center gap-2 shrink-0 cursor-default">
          {/* Color Picker Button & Popover */}
          <div className="relative cursor-default" ref={colorPickerRef}>
            <button
              onClick={() => setIsColorPickerOpen((prev) => !prev)}
              title="Выбор цвета карандаша"
              className="w-6 h-6 rounded-full border-2 border-white/40 hover:border-white transition-all flex items-center justify-center shadow-inner focus:outline-none cursor-pointer"
              style={{ backgroundColor: selectedColor }}
            />

            {/* Popover */}
            {isColorPickerOpen && (
              <div
                onPointerDown={stopPointer}
                onPointerMove={stopPointer}
                onPointerUp={stopPointer}
                onMouseDown={stopPointer}
                onMouseMove={stopPointer}
                onMouseUp={stopPointer}
                onClick={stopPointer}
                className="absolute top-9 left-0 p-2 rounded-xl bg-[#141414] border border-white/[0.15] shadow-2xl z-50 grid grid-cols-4 gap-1.5 animate-in fade-in zoom-in-95 duration-150 w-36 pointer-events-auto cursor-default"
              >
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => {
                      onChangeColor(c.value);
                      setIsColorPickerOpen(false);
                    }}
                    title={c.label}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      selectedColor === c.value
                        ? 'ring-2 ring-white scale-110'
                        : 'hover:scale-110 opacity-90 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: c.value,
                      border: c.value === '#ffffff' ? '1px solid rgba(0,0,0,0.3)' : '1px solid rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Stroke Width Custom Range Slider */}
          <div className="flex items-center gap-2 bg-white/[0.04] px-2.5 py-1 rounded-xl border border-white/[0.08] cursor-default">
            <span
              className="rounded-full bg-white transition-all shrink-0 pointer-events-none"
              style={{
                width: Math.max(2, Math.min(10, strokeWidth)),
                height: Math.max(2, Math.min(10, strokeWidth)),
              }}
            />
            <input
              type="range"
              min="1"
              max="24"
              step="0.5"
              value={strokeWidth}
              onChange={(e) => onChangeStrokeWidth(Number(e.target.value))}
              className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
              title={`Толщина: ${strokeWidth}px`}
            />
            <span className="text-[10px] font-mono text-neutral-400 w-5 text-right select-none pointer-events-none">
              {Math.round(strokeWidth)}
            </span>
          </div>
        </div>
      </div>

      {/* SHAPES SUB-TOOLBAR (Current shape preview button + color picker) */}
      <div
        className={`flex items-center overflow-visible transition-all duration-300 ease-out cursor-default ${
          activeTool === 'shape'
            ? 'max-w-[260px] opacity-100 ml-1.5 mr-0.5'
            : 'max-w-0 opacity-0 overflow-hidden pointer-events-none m-0'
        }`}
      >
        <div className="w-[1px] h-5 bg-white/[0.1] shrink-0 mr-2 cursor-default" />

        <div className="flex items-center gap-2 shrink-0 cursor-default">
          {/* Quick Shape Selector Button */}
          <button
            onClick={() => setIsShapesMenuOpen((prev) => !prev)}
            title="Выбрать другую фигуру"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs transition-all cursor-pointer text-white"
          >
            <ShapeIcon type={selectedShapeType} className="w-4 h-4 text-white" />
            <span className="text-[11px] font-medium max-w-[85px] truncate">
              {SHAPE_MAP.get(selectedShapeType)?.label || 'Фигура'}
            </span>
          </button>

          {/* Dedicated Shape Color Picker */}
          <div className="relative cursor-default" ref={shapeColorPickerRef}>
            <button
              onClick={() => setIsShapeColorPickerOpen((prev) => !prev)}
              title="Выбор цвета фигуры"
              className="w-6 h-6 rounded-full border-2 border-white/40 hover:border-white transition-all flex items-center justify-center shadow-inner focus:outline-none cursor-pointer"
              style={{ backgroundColor: shapeColor }}
            />

            {/* Popover */}
            {isShapeColorPickerOpen && (
              <div
                onPointerDown={stopPointer}
                onPointerMove={stopPointer}
                onPointerUp={stopPointer}
                onMouseDown={stopPointer}
                onMouseMove={stopPointer}
                onMouseUp={stopPointer}
                onClick={stopPointer}
                className="absolute top-9 left-0 p-2 rounded-xl bg-[#141414] border border-white/[0.15] shadow-2xl z-50 grid grid-cols-4 gap-1.5 animate-in fade-in zoom-in-95 duration-150 w-36 pointer-events-auto cursor-default"
              >
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => {
                      onChangeShapeColor(c.value);
                      setIsShapeColorPickerOpen(false);
                    }}
                    title={c.label}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      shapeColor === c.value
                        ? 'ring-2 ring-white scale-110'
                        : 'hover:scale-110 opacity-90 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: c.value,
                      border: c.value === '#ffffff' ? '1px solid rgba(0,0,0,0.3)' : '1px solid rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TEXT SUB-TOOLBAR (Font size presets + Text Color Picker) */}
      <div
        className={`flex items-center overflow-visible transition-all duration-300 ease-out cursor-default ${
          activeTool === 'text'
            ? 'max-w-[340px] opacity-100 ml-1.5 mr-0.5'
            : 'max-w-0 opacity-0 overflow-hidden pointer-events-none m-0'
        }`}
      >
        <div className="w-[1px] h-5 bg-white/[0.1] shrink-0 mr-2 cursor-default" />

        <div className="flex items-center gap-2 shrink-0 cursor-default">
          {/* Text Color Picker Button & Popover */}
          <div className="relative cursor-default" ref={textColorPickerRef}>
            <button
              onClick={() => setIsTextColorPickerOpen((prev) => !prev)}
              title="Цвет текста"
              className="w-6 h-6 rounded-full border-2 border-white/40 hover:border-white transition-all flex items-center justify-center shadow-inner focus:outline-none cursor-pointer"
              style={{ backgroundColor: textColor }}
            />

            {/* Popover */}
            {isTextColorPickerOpen && (
              <div
                onPointerDown={stopPointer}
                onPointerMove={stopPointer}
                onPointerUp={stopPointer}
                onMouseDown={stopPointer}
                onMouseMove={stopPointer}
                onMouseUp={stopPointer}
                onClick={stopPointer}
                className="absolute top-9 left-0 p-2 rounded-xl bg-[#141414] border border-white/[0.15] shadow-2xl z-50 grid grid-cols-4 gap-1.5 animate-in fade-in zoom-in-95 duration-150 w-36 pointer-events-auto cursor-default"
              >
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => {
                      onChangeTextColor(c.value);
                      setIsTextColorPickerOpen(false);
                    }}
                    title={c.label}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      textColor === c.value
                        ? 'ring-2 ring-white scale-110'
                        : 'hover:scale-110 opacity-90 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: c.value,
                      border: c.value === '#ffffff' ? '1px solid rgba(0,0,0,0.3)' : '1px solid rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Font Size Presets: 4 sizes represented by progressively larger 'A' letters */}
          <div className="flex items-center bg-white/[0.06] p-0.5 rounded-lg border border-white/[0.08] cursor-default">
            {[
              { size: 14, textClass: 'text-[11px]', title: 'Маленький (14px)' },
              { size: 18, textClass: 'text-[14px]', title: 'Средний (18px)' },
              { size: 24, textClass: 'text-[17px] font-semibold', title: 'Большой (24px)' },
              { size: 32, textClass: 'text-[20px] font-bold', title: 'Очень большой (32px)' },
            ].map((p) => (
              <button
                key={p.size}
                onClick={() => onChangeTextFontSize(p.size)}
                title={p.title}
                className={`min-w-[24px] h-6 px-1.5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                  textFontSize === p.size
                    ? 'bg-white text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span className={`leading-none ${p.textClass}`}>A</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ERASER SUB-TOOLBAR (Mode switcher + radius slider) */}
      <div
        className={`flex items-center overflow-hidden transition-all duration-300 ease-out cursor-default ${
          activeTool === 'eraser'
            ? 'max-w-[280px] opacity-100 ml-1.5 mr-0.5'
            : 'max-w-0 opacity-0 pointer-events-none m-0'
        }`}
      >
        <div className="w-[1px] h-5 bg-white/[0.1] shrink-0 mr-2 cursor-default" />

        <div className="flex items-center gap-2 shrink-0 cursor-default">
          {/* Mode Switcher */}
          <div className="flex items-center bg-white/[0.06] p-0.5 rounded-lg border border-white/[0.08] text-[11px] cursor-default">
            <button
              onClick={() => onChangeEraserMode('object')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                eraserMode === 'object'
                  ? 'bg-white text-black font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Стирать весь объект/штрих целиком при клике"
            >
              Объект
            </button>
            <button
              onClick={() => onChangeEraserMode('area')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                eraserMode === 'area'
                  ? 'bg-white text-black font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Стирать только область под кистью"
            >
              Область
            </button>
          </div>

          {/* Eraser Radius Slider (for Area mode) */}
          {eraserMode === 'area' && (
            <div className="flex items-center gap-1.5 bg-white/[0.04] px-2 py-1 rounded-xl border border-white/[0.08] cursor-default">
              <input
                type="range"
                min="4"
                max="40"
                step="2"
                value={eraserRadius}
                onChange={(e) => onChangeEraserRadius(Number(e.target.value))}
                className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                title={`Размер ластика: ${eraserRadius * 2}px`}
              />
              <span className="text-[10px] font-mono text-neutral-400 w-4 text-right select-none pointer-events-none">
                {eraserRadius}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Contextual Delete for Selection */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-1 ml-1 animate-in fade-in duration-150 cursor-default">
          <div className="w-[1px] h-5 bg-white/[0.1] mr-1 cursor-default" />
          <button
            onClick={onDeleteSelected}
            title={`Удалить выбранное (${selectedCount}) (Del / Backspace)`}
            className="px-2 py-1.5 rounded-xl text-xs flex items-center gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-150 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            {selectedCount > 1 && (
              <span className="text-[10px] font-mono font-medium">({selectedCount})</span>
            )}
          </button>
        </div>
      )}

      <div className="w-[1px] h-5 bg-white/[0.1] mx-1 shrink-0 cursor-default" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-1 shrink-0 cursor-default">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Отмена / Undo (Ctrl+Z)"
          className={`p-2 rounded-xl text-xs flex items-center justify-center transition-all duration-150 ${
            canUndo
              ? 'text-neutral-400 hover:text-white hover:bg-white/[0.08] cursor-pointer'
              : 'text-neutral-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Повтор / Redo (Ctrl+Shift+Z)"
          className={`p-2 rounded-xl text-xs flex items-center justify-center transition-all duration-150 ${
            canRedo
              ? 'text-neutral-400 hover:text-white hover:bg-white/[0.08] cursor-pointer'
              : 'text-neutral-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <div className="w-[1px] h-5 bg-white/[0.1] mx-1 shrink-0 cursor-default" />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 text-[11px] font-mono text-neutral-300 shrink-0 cursor-default">
        <button
          onClick={onZoomOut}
          title="Отдалить (Ctrl -)"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-all duration-150 cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onResetZoom}
          title="Сбросить масштаб (Ctrl 0)"
          className="px-1.5 py-1 rounded hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          {zoomPercent}%
        </button>

        <button
          onClick={onZoomIn}
          title="Приблизить (Ctrl +)"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-all duration-150 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
