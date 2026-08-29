'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingStroke, DrawingTool, StrokePoint } from '@/types';
import { renderStrokeToCanvas } from '@/lib/utils';

interface HandwritingCanvasProps {
  strokes: DrawingStroke[];
  onStrokesChange: (strokes: DrawingStroke[]) => void;
  tool: DrawingTool;
  color: string;
  size: number;
  palmRejection: boolean;
  isDrawingLayerActive: boolean;
  onCanUndoChange?: (canUndo: boolean) => void;
  onCanRedoChange?: (canRedo: boolean) => void;
}

export const HandwritingCanvas: React.FC<HandwritingCanvasProps> = ({
  strokes,
  onStrokesChange,
  tool,
  color,
  size,
  palmRejection,
  isDrawingLayerActive,
  onCanUndoChange,
  onCanRedoChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<StrokePoint[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingStroke[][]>([]);
  const strokeHistoryRef = useRef<DrawingStroke[]>(strokes);

  // Sync strokeHistoryRef with incoming strokes
  useEffect(() => {
    strokeHistoryRef.current = strokes;
    redrawCanvas();
    if (onCanUndoChange) onCanUndoChange(strokes.length > 0);
  }, [strokes]);

  useEffect(() => {
    if (onCanRedoChange) onCanRedoChange(redoStack.length > 0);
  }, [redoStack, onCanRedoChange]);

  // Redraw all strokes onto canvas with DPI scaling
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (const stroke of strokeHistoryRef.current) {
      renderStrokeToCanvas(ctx, stroke);
    }
    ctx.restore();
  }, []);

  // Setup resize listener
  useEffect(() => {
    redrawCanvas();
    const handleResize = () => {
      redrawCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawCanvas]);

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingLayerActive) return;

    // Palm Rejection: If enabled, only allow pen input
    if (palmRejection && e.pointerType !== 'pen') {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    currentStrokeRef.current = [
      {
        x,
        y,
        pressure,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
        time: Date.now(),
      },
    ];

    if (tool === 'eraser') {
      // Stroke eraser: Check if touching any existing stroke
      handleEraser(x, y);
    } else {
      // Fast single point render
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.scale(dpr, dpr);
        renderStrokeToCanvas(ctx, {
          id: 'temp',
          tool,
          color,
          size,
          opacity: tool === 'highlighter' ? 0.35 : 1,
          points: currentStrokeRef.current,
        });
        ctx.restore();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isDrawingLayerActive) return;
    if (palmRejection && e.pointerType !== 'pen') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    if (tool === 'eraser') {
      handleEraser(x, y);
      return;
    }

    currentStrokeRef.current.push({
      x,
      y,
      pressure,
      tiltX: e.tiltX,
      tiltY: e.tiltY,
      time: Date.now(),
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // For shape tools (line, rect, circle), redraw entire canvas to show live shape guide
    if (['line', 'rect', 'circle'].includes(tool)) {
      redrawCanvas();
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      renderStrokeToCanvas(ctx, {
        id: 'preview',
        tool,
        color,
        size,
        opacity: 0.9,
        points: currentStrokeRef.current,
      });
      ctx.restore();
    } else {
      // Continuous line drawing
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      const points = currentStrokeRef.current;
      if (points.length >= 2) {
        const p1 = points[points.length - 2];
        const p2 = points[points.length - 1];

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (tool === 'highlighter') {
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = size * 2.5;
        } else if (tool === 'fountain') {
          ctx.strokeStyle = color;
          ctx.globalAlpha = 1;
          ctx.lineWidth = Math.max(1, size * (pressure * 1.6));
        } else {
          ctx.strokeStyle = color;
          ctx.globalAlpha = 1;
          ctx.lineWidth = size;
        }

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (tool !== 'eraser' && currentStrokeRef.current.length > 0) {
      const newStroke: DrawingStroke = {
        id: crypto.randomUUID(),
        tool,
        color,
        size,
        opacity: tool === 'highlighter' ? 0.35 : 1,
        points: [...currentStrokeRef.current],
      };

      const updatedStrokes = [...strokes, newStroke];
      setRedoStack([]); // Clear redo stack on new stroke
      onStrokesChange(updatedStrokes);
    }

    currentStrokeRef.current = [];
    redrawCanvas();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = false;
    currentStrokeRef.current = [];
    redrawCanvas();
  };

  // Stroke Eraser Helper: removes strokes whose points lie within eraser radius
  const handleEraser = (x: number, y: number) => {
    const eraserRadius = size * 2;
    const remaining = strokes.filter((stroke) => {
      return !stroke.points.some((p) => {
        const dist = Math.hypot(p.x - x, p.y - y);
        return dist <= eraserRadius;
      });
    });

    if (remaining.length !== strokes.length) {
      onStrokesChange(remaining);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`absolute inset-0 w-full h-full touch-none z-20 ${
        isDrawingLayerActive ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{
        touchAction: 'none',
      }}
    />
  );
};
