'use client';

import React, { useState } from 'react';
import {
  Pen,
  Highlighter,
  Eraser,
  Pencil,
  Minus,
  Square,
  Circle,
  RotateCcw,
  RotateCw,
  Trash2,
  Hand,
  ChevronDown,
  Palette,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DrawingTool } from '@/types';
import { cn } from '@/lib/utils';

interface DrawingToolbarProps {
  tool: DrawingTool;
  setTool: (tool: DrawingTool) => void;
  color: string;
  setColor: (color: string) => void;
  size: number;
  setSize: (size: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  palmRejection: boolean;
  setPalmRejection: (val: boolean) => void;
  isDrawingLayerActive: boolean;
  setIsDrawingLayerActive: (val: boolean) => void;
}

const COLOR_PRESETS = [
  { name: 'White', hex: '#f8fafc' },
  { name: 'Electric Cyan', hex: '#06b6d4' },
  { name: 'Neon Green', hex: '#10b981' },
  { name: 'Neon Yellow', hex: '#facc15' },
  { name: 'Coral Rose', hex: '#f43f5e' },
  { name: 'Violet Brand', hex: '#8b5cf6' },
  { name: 'Amber Orange', hex: '#f97316' },
  { name: 'Slate Gray', hex: '#94a3b8' },
];

const SIZE_PRESETS = [2, 4, 8, 14, 24];

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  palmRejection,
  setPalmRejection,
  isDrawingLayerActive,
  setIsDrawingLayerActive,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showShapes, setShowShapes] = useState(false);

  return (
    <div className="sticky top-3 z-30 flex items-center justify-between gap-1.5 p-1.5 md:p-2 bg-dark-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl max-w-full overflow-x-auto">
      {/* Drawing / Text Layer Mode Toggle */}
      <div className="flex items-center gap-1 bg-dark-950/80 p-1 rounded-xl border border-slate-800/80">
        <button
          type="button"
          onClick={() => setIsDrawingLayerActive(true)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
            isDrawingLayerActive
              ? 'bg-brand-500 text-white shadow-glow'
              : 'text-slate-400 hover:text-slate-200'
          )}
          title="Stylus / Drawing Mode"
        >
          <Pen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Handwriting</span>
        </button>
        <button
          type="button"
          onClick={() => setIsDrawingLayerActive(false)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
            !isDrawingLayerActive
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-slate-200'
          )}
          title="Type Text Mode"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Type Notes</span>
        </button>
      </div>

      <div className="h-6 w-px bg-slate-800 mx-0.5" />

      {/* Main Drawing Tools */}
      <div className="flex items-center gap-1">
        {/* Ballpoint Pen */}
        <button
          type="button"
          onClick={() => {
            setTool('pen');
            setIsDrawingLayerActive(true);
          }}
          className={cn(
            'p-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center',
            tool === 'pen' && isDrawingLayerActive
              ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40 shadow-glow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          )}
          title="Ballpoint Pen"
        >
          <Pen className="w-4 h-4" />
        </button>

        {/* Fountain Pen (Pressure dynamic) */}
        <button
          type="button"
          onClick={() => {
            setTool('fountain');
            setIsDrawingLayerActive(true);
          }}
          className={cn(
            'p-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center relative',
            tool === 'fountain' && isDrawingLayerActive
              ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40 shadow-glow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          )}
          title="Fountain Pen (S Pen Pressure Sensitive)"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Highlighter */}
        <button
          type="button"
          onClick={() => {
            setTool('highlighter');
            setIsDrawingLayerActive(true);
          }}
          className={cn(
            'p-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center',
            tool === 'highlighter' && isDrawingLayerActive
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          )}
          title="Highlighter"
        >
          <Highlighter className="w-4 h-4" />
        </button>

        {/* Pencil */}
        <button
          type="button"
          onClick={() => {
            setTool('pencil');
            setIsDrawingLayerActive(true);
          }}
          className={cn(
            'p-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center',
            tool === 'pencil' && isDrawingLayerActive
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          )}
          title="Pencil"
        >
          <Pencil className="w-4 h-4" />
        </button>

        {/* Eraser */}
        <button
          type="button"
          onClick={() => {
            setTool('eraser');
            setIsDrawingLayerActive(true);
          }}
          className={cn(
            'p-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center',
            tool === 'eraser' && isDrawingLayerActive
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          )}
          title="Eraser"
        >
          <Eraser className="w-4 h-4" />
        </button>

        {/* Shapes Menu Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowShapes(!showShapes)}
            className={cn(
              'p-2 rounded-xl text-xs font-medium transition-all flex items-center gap-0.5',
              ['line', 'rect', 'circle'].includes(tool) && isDrawingLayerActive
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            )}
            title="Shapes"
          >
            {tool === 'rect' ? (
              <Square className="w-4 h-4" />
            ) : tool === 'circle' ? (
              <Circle className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
            <ChevronDown className="w-3 h-3" />
          </button>

          {showShapes && (
            <div className="absolute top-full mt-1.5 left-0 glass-dropdown p-2 rounded-xl flex gap-1.5 z-40">
              <button
                type="button"
                onClick={() => {
                  setTool('line');
                  setIsDrawingLayerActive(true);
                  setShowShapes(false);
                }}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                title="Straight Line"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTool('rect');
                  setIsDrawingLayerActive(true);
                  setShowShapes(false);
                }}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                title="Rectangle"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTool('circle');
                  setIsDrawingLayerActive(true);
                  setShowShapes(false);
                }}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                title="Ellipse / Circle"
              >
                <Circle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="h-6 w-px bg-slate-800 mx-0.5" />

      {/* Colors & Palette */}
      <div className="flex items-center gap-1.5">
        <div className="hidden sm:flex items-center gap-1 bg-dark-950/60 p-1 rounded-xl border border-slate-800/80">
          {COLOR_PRESETS.slice(0, 5).map((preset) => (
            <button
              key={preset.hex}
              type="button"
              onClick={() => setColor(preset.hex)}
              className={cn(
                'w-5 h-5 rounded-full transition-transform border',
                color === preset.hex
                  ? 'scale-125 border-white ring-2 ring-brand-500/50'
                  : 'border-slate-700 hover:scale-110'
              )}
              style={{ backgroundColor: preset.hex }}
              title={preset.name}
            />
          ))}
        </div>

        {/* Custom Color Picker Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-1.5 rounded-xl border border-slate-800 bg-dark-950/80 hover:bg-slate-800/80 transition-all flex items-center gap-1"
            title="More Colors"
          >
            <div
              className="w-4 h-4 rounded-full border border-slate-600"
              style={{ backgroundColor: color }}
            />
            <Palette className="w-3 h-3 text-slate-400" />
          </button>

          {showColorPicker && (
            <div className="absolute top-full mt-1.5 right-0 glass-dropdown p-3 rounded-2xl grid grid-cols-4 gap-2 z-40 w-48">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => {
                    setColor(preset.hex);
                    setShowColorPicker(false);
                  }}
                  className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-slate-800"
                >
                  <div
                    className="w-6 h-6 rounded-full border border-slate-600 shadow"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span className="text-[10px] text-slate-400 truncate w-full text-center">
                    {preset.name.split(' ')[0]}
                  </span>
                </button>
              ))}
              <div className="col-span-4 mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Custom:</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-6 w-px bg-slate-800 mx-0.5" />

      {/* Stroke Size Selector */}
      <div className="flex items-center gap-1 bg-dark-950/60 p-1 rounded-xl border border-slate-800/80">
        {SIZE_PRESETS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            className={cn(
              'w-6 h-6 rounded-lg flex items-center justify-center transition-all',
              size === s
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            )}
            title={`Stroke ${s}px`}
          >
            <div
              className="rounded-full bg-current"
              style={{ width: Math.min(14, Math.max(2, s)), height: Math.min(14, Math.max(2, s)) }}
            />
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-slate-800 mx-0.5" />

      {/* Palm Rejection Toggle (crucial for Samsung tablet / S Pen users) */}
      <button
        type="button"
        onClick={() => setPalmRejection(!palmRejection)}
        className={cn(
          'p-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1',
          palmRejection
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        )}
        title={palmRejection ? 'Palm Rejection Active (S Pen Only)' : 'Palm Rejection Off (Touch + Pen)'}
      >
        <Hand className="w-4 h-4" />
        <span className="hidden lg:inline text-[11px]">Palm Reject</span>
      </button>

      <div className="h-6 w-px bg-slate-800 mx-0.5" />

      {/* History & Clear Actions */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-30 disabled:pointer-events-none transition-all"
          title="Undo Stroke (Ctrl+Z)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-30 disabled:pointer-events-none transition-all"
          title="Redo Stroke (Ctrl+Y)"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onClear}
          className="p-2 rounded-xl text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          title="Clear Canvas Strokes"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
