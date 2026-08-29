'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import { NotebookPage, DrawingStroke, StrokePoint, DrawingTool } from '@/types';
import { PageBackground } from './PageBackground';
import { EditorMode } from './UnifiedPageToolbar';
import { cn } from '@/lib/utils';

interface UnifiedPageCanvasProps {
  page: NotebookPage;
  mode: EditorMode;
  editor: Editor | null;
  drawingTool: DrawingTool;
  drawingColor: string;
  drawingSize: number;
  palmRejection: boolean;
  strokes: DrawingStroke[];
  onAddStroke: (stroke: DrawingStroke) => void;
  onEraseAtPoint: (x: number, y: number) => void;
  onUpdateTitle?: (title: string) => void;
  onDropImage: (file: File) => void;
}

export const UnifiedPageCanvas: React.FC<UnifiedPageCanvasProps> = ({
  page,
  mode,
  editor,
  drawingTool,
  drawingColor,
  drawingSize,
  palmRejection,
  strokes,
  onAddStroke,
  onEraseAtPoint,
  onDropImage,
}) => {
  // Canvas refs
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPointsRef = useRef<StrokePoint[]>([]);

  // Redraw Vector Strokes on Canvas
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

  // Adjust canvas size to match page container exactly
  const handleResizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = pageContainerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    renderStrokes();
  }, [renderStrokes]);

  useEffect(() => {
    handleResizeCanvas();
    window.addEventListener('resize', handleResizeCanvas);
    const observer = new ResizeObserver(() => handleResizeCanvas());
    if (pageContainerRef.current) observer.observe(pageContainerRef.current);

    return () => {
      window.removeEventListener('resize', handleResizeCanvas);
      observer.disconnect();
    };
  }, [handleResizeCanvas]);

  useEffect(() => {
    renderStrokes();
  }, [renderStrokes]);

  // Pointer Events for Drawing
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
    if (mode !== 'draw') return;

    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const coords = getCanvasCoords(e);
    setIsDrawing(true);

    if (drawingTool === 'eraser') {
      onEraseAtPoint(coords.x, coords.y);
      return;
    }

    currentPointsRef.current = [coords];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || mode !== 'draw') return;
    e.preventDefault();

    const coords = getCanvasCoords(e);

    if (drawingTool === 'eraser') {
      onEraseAtPoint(coords.x, coords.y);
      return;
    }

    currentPointsRef.current.push(coords);

    // Live preview stroke on canvas
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

      if (drawingTool === 'highlighter') {
        ctx.strokeStyle = drawingColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = drawingSize * 4 * dpr;
      } else {
        ctx.strokeStyle = drawingColor;
        ctx.globalAlpha = 1.0;
        const pressureScale = coords.pressure ? 0.6 + coords.pressure * 0.8 : 1;
        ctx.lineWidth = drawingSize * pressureScale * dpr;
      }

      ctx.moveTo(p1.x * dpr, p1.y * dpr);
      ctx.lineTo(p2.x * dpr, p2.y * dpr);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || mode !== 'draw') return;
    setIsDrawing(false);

    if (drawingTool !== 'eraser' && currentPointsRef.current.length > 1) {
      const newStroke: DrawingStroke = {
        id: crypto.randomUUID(),
        tool: drawingTool,
        color: drawingColor,
        size: drawingSize,
        opacity: drawingTool === 'highlighter' ? 0.35 : 1,
        points: [...currentPointsRef.current],
      };
      onAddStroke(newStroke);
    }
    currentPointsRef.current = [];
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-24">
      {/* Infinite Canvas Clean Ruled Writing Surface (No "Page 1" chip or inside page title) */}
      <div
        ref={pageContainerRef}
        onClick={() => {
          if (mode === 'text' && editor) {
            editor.commands.focus();
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith('image/')) {
            onDropImage(file);
          }
        }}
        className="relative rounded-3xl border border-app-border min-h-[900px] md:min-h-[1100px] p-8 sm:p-14 shadow-elevated bg-app-surface/95 backdrop-blur-sm cursor-text transition-all overflow-hidden"
      >
        {/* Paper Texture Backdrop */}
        <PageBackground template={page.template || 'ruled'} />

        {/* 1. Full-page Unified Rich-Text & Inline Image Layer */}
        <div className="relative z-10 prose dark:prose-invert max-w-none text-app-text leading-relaxed font-sans text-sm focus:outline-none min-h-[850px]">
          <EditorContent editor={editor} />
        </div>

        {/* 2. Full-page Vector Drawing Overlay Layer */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            'absolute inset-0 z-20 w-full h-full transition-opacity',
            mode === 'draw'
              ? 'pointer-events-auto cursor-crosshair opacity-100 touch-none'
              : 'pointer-events-none opacity-100'
          )}
        />
      </div>
    </div>
  );
};
