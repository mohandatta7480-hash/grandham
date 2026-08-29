'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { DrawingStroke, StrokePoint, DrawingTool } from '@/types';
import {
  PenTool,
  Highlighter,
  Eraser,
  Undo,
  Redo,
  Trash2,
  ChevronDown,
  Palette,
  Sliders,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrawingBlockProps {
  content: { strokes?: DrawingStroke[]; height?: number };
  onChange: (newContent: { strokes: DrawingStroke[]; height: number }) => void;
  onDelete?: () => void;
}

const COLOR_PRESETS = [
  { label: 'Gold', value: '#c7a15a' },
  { label: 'Cyan', value: '#38bdf8' },
  { label: 'Green', value: '#4ade80' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Coral', value: '#f43f5e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'White', value: '#ffffff' },
  { label: 'Slate', value: '#94a3b8' },
  { label: 'Dark', value: '#1e293b' },
];

const STROKE_SIZES = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick', value: 8 },
  { label: 'Bold', value: 16 },
];

export const DrawingBlock: React.FC<DrawingBlockProps> = ({ content, onChange, onDelete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [strokes, setStrokes] = useState<DrawingStroke[]>(content?.strokes || []);
  const [history, setHistory] = useState<DrawingStroke[][]>([]);
  const [redoHistory, setRedoHistory] = useState<DrawingStroke[][]>([]);
  const [canvasHeight, setCanvasHeight] = useState<number>(content?.height || 280);

  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState<string>('#c7a15a');
  const [size, setSize] = useState<number>(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPointsRef = useRef<StrokePoint[]>([]);

  // Redraw all vector strokes
  const renderStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((st) => {
      if (!st.points || st.points.length < 2) return;

      ctx.save();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (st.tool === 'highlighter') {
        ctx.strokeStyle = st.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = st.size * 4 * dpr;
      } else {
        ctx.strokeStyle = st.color;
        ctx.globalAlpha = st.opacity || 1.0;
        ctx.lineWidth = st.size * dpr;
      }

      ctx.moveTo(st.points[0].x * dpr, st.points[0].y * dpr);
      for (let i = 1; i < st.points.length; i++) {
        const p1 = st.points[i - 1];
        const p2 = st.points[i];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.quadraticCurveTo(p1.x * dpr, p1.y * dpr, midX * dpr, midY * dpr);
      }
      ctx.stroke();
      ctx.restore();
    });
  }, [strokes]);

  // Adjust canvas size for DPR
  const handleResizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${canvasHeight}px`;

    renderStrokes();
  }, [canvasHeight, renderStrokes]);

  useEffect(() => {
    handleResizeCanvas();
    window.addEventListener('resize', handleResizeCanvas);
    return () => window.removeEventListener('resize', handleResizeCanvas);
  }, [handleResizeCanvas]);

  useEffect(() => {
    renderStrokes();
  }, [renderStrokes]);

  // Pointer Events (Touch, Mouse, Samsung S Pen with pressure)
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure && e.pressure > 0 ? e.pressure : 0.5,
      time: Date.now(),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const coords = getCanvasCoords(e);
    setIsDrawing(true);

    if (tool === 'eraser') {
      eraseAtPoint(coords.x, coords.y);
      return;
    }

    currentPointsRef.current = [coords];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCanvasCoords(e);

    if (tool === 'eraser') {
      eraseAtPoint(coords.x, coords.y);
      return;
    }

    currentPointsRef.current.push(coords);

    // Live preview stroke
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && currentPointsRef.current.length > 1) {
      const dpr = window.devicePixelRatio || 1;
      const pts = currentPointsRef.current;
      const p1 = pts[pts.length - 2];
      const p2 = pts[pts.length - 1];

      ctx.save();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (tool === 'highlighter') {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = size * 4 * dpr;
      } else {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1.0;
        const pressureScale = coords.pressure ? 0.6 + coords.pressure * 0.8 : 1;
        ctx.lineWidth = size * pressureScale * dpr;
      }

      ctx.moveTo(p1.x * dpr, p1.y * dpr);
      ctx.lineTo(p2.x * dpr, p2.y * dpr);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool !== 'eraser' && currentPointsRef.current.length > 1) {
      const newStroke: DrawingStroke = {
        id: crypto.randomUUID(),
        tool,
        color,
        size,
        opacity: tool === 'highlighter' ? 0.35 : 1,
        points: [...currentPointsRef.current],
      };

      const updated = [...strokes, newStroke];
      setHistory((prev) => [...prev, strokes]);
      setRedoHistory([]);
      setStrokes(updated);
      onChange({ strokes: updated, height: canvasHeight });
    }
    currentPointsRef.current = [];
  };

  const eraseAtPoint = (x: number, y: number) => {
    const radius = size * 8;
    const remaining = strokes.filter((st) => {
      return !st.points.some((p) => Math.hypot(p.x - x, p.y - y) < radius);
    });

    if (remaining.length !== strokes.length) {
      setHistory((prev) => [...prev, strokes]);
      setRedoHistory([]);
      setStrokes(remaining);
      onChange({ strokes: remaining, height: canvasHeight });
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setRedoHistory((prev) => [...prev, strokes]);
    setHistory((prev) => prev.slice(0, -1));
    setStrokes(last);
    onChange({ strokes: last, height: canvasHeight });
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const next = redoHistory[redoHistory.length - 1];
    setHistory((prev) => [...prev, strokes]);
    setRedoHistory((prev) => prev.slice(0, -1));
    setStrokes(next);
    onChange({ strokes: next, height: canvasHeight });
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    setHistory((prev) => [...prev, strokes]);
    setRedoHistory([]);
    setStrokes([]);
    onChange({ strokes: [], height: canvasHeight });
  };

  return (
    <div ref={containerRef} className="w-full my-3 space-y-2 group/draw">
      {/* Drawing Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 p-1.5 bg-app-surface/95 backdrop-blur-md border border-app-border rounded-2xl shadow-elevated">
        {/* Tools (Pen, Highlighter, Eraser) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTool('pen')}
            className={cn(
              'p-1.5 rounded-xl text-xs transition-colors flex items-center gap-1',
              tool === 'pen'
                ? 'bg-app-accent text-white font-medium shadow-subtle'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="S Pen / Stylus Pen"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium hidden sm:inline">Pen</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('highlighter')}
            className={cn(
              'p-1.5 rounded-xl text-xs transition-colors flex items-center gap-1',
              tool === 'highlighter'
                ? 'bg-app-accent text-white font-medium shadow-subtle'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Highlighter"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium hidden sm:inline">Highlighter</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('eraser')}
            className={cn(
              'p-1.5 rounded-xl text-xs transition-colors flex items-center gap-1',
              tool === 'eraser'
                ? 'bg-app-accent text-white font-medium shadow-subtle'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Stroke Eraser"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium hidden sm:inline">Eraser</span>
          </button>

          <div className="w-px h-4 bg-app-border mx-1" />

          {/* Color Presets */}
          {tool !== 'eraser' && (
            <div className="flex items-center gap-1">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={cn(
                    'w-4 h-4 rounded-full border transition-transform',
                    color === c.value
                      ? 'scale-125 border-white shadow-sm ring-2 ring-app-accent'
                      : 'border-black/20 opacity-80 hover:opacity-100'
                  )}
                  title={c.label}
                />
              ))}

              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-4 h-4 rounded-full border border-app-border cursor-pointer bg-transparent ml-0.5"
                title="Custom color"
              />
            </div>
          )}
        </div>

        {/* Thickness, Undo, Redo, Clear, Height */}
        <div className="flex items-center gap-1">
          {/* Thickness options */}
          <div className="flex items-center gap-1 px-1 text-[11px] text-app-text-muted">
            {STROKE_SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSize(s.value)}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors',
                  size === s.value
                    ? 'bg-app-accent text-white font-bold'
                    : 'hover:bg-app-surface-hover text-app-text-muted'
                )}
                title={`${s.label} thickness (${s.value}px)`}
              >
                {s.value}px
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-app-border mx-0.5" />

          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover disabled:opacity-30 transition-colors"
            title="Undo stroke"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={redoHistory.length === 0}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover disabled:opacity-30 transition-colors"
            title="Redo stroke"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-30 transition-colors"
            title="Clear all strokes"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              const next = canvasHeight >= 500 ? 220 : canvasHeight + 100;
              setCanvasHeight(next);
              onChange({ strokes, height: next });
            }}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text text-[11px] font-mono flex items-center gap-0.5 transition-colors"
            title="Expand / Contract drawing canvas height"
          >
            <span>{canvasHeight}px</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 text-xs transition-colors ml-1"
              title="Delete drawing block"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Vector Drawing Canvas */}
      <div
        className="relative rounded-2xl border border-app-border bg-app-bg/90 overflow-hidden shadow-inner touch-none cursor-crosshair transition-all"
        style={{ height: `${canvasHeight}px` }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full"
        />
        {strokes.length === 0 && !isDrawing && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-app-text-dim/60 italic font-serif">
            Draw or write with Samsung S Pen / touch / mouse here
          </div>
        )}
      </div>
    </div>
  );
};
