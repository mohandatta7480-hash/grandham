'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Textbook, DrawingStroke, StrokePoint } from '@/types';
import { loadPdfDocument, renderPdfPageToCanvas } from '@/lib/pdf/pdfViewerHelper';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pen,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Maximize2,
  Minimize2,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TextbookViewerProps {
  textbook: Textbook;
  onBack: () => void;
  onUpdateTextbook: (updates: Partial<Textbook>) => Promise<void>;
}

const PEN_COLORS = [
  '#c7a15a', // Antique Gold
  '#ef4444', // Crimson
  '#3b82f6', // Sapphire Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f8fafc', // Warm White
  '#1e293b', // Graphite
];

const STROKE_SIZES = [2, 4, 6, 10];

export const TextbookViewer: React.FC<TextbookViewerProps> = ({
  textbook,
  onBack,
  onUpdateTextbook,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(textbook.currentPage || 1);
  const [totalPages, setTotalPages] = useState<number>(textbook.pageCount || 1);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  // Drawing state
  const [tool, setTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [color, setColor] = useState<string>('#c7a15a');
  const [size, setSize] = useState<number>(3);
  
  // Page Annotations: { [pageNumber]: DrawingStroke[] }
  const [annotations, setAnnotations] = useState<Record<number, DrawingStroke[]>>(
    textbook.annotations || {}
  );
  const [redoStack, setRedoStack] = useState<DrawingStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Canvas refs
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load PDF Document
  useEffect(() => {
    let isMounted = true;
    const loadDoc = async () => {
      try {
        setIsLoadingPdf(true);
        const source = textbook.fileData || textbook.file_url || '';
        if (!source) {
          setIsLoadingPdf(false);
          return;
        }
        const doc = await loadPdfDocument(source);
        if (isMounted) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setIsLoadingPdf(false);
        }
      } catch (err) {
        console.error('Failed to load PDF document:', err);
        if (isMounted) setIsLoadingPdf(false);
      }
    };
    loadDoc();
    return () => {
      isMounted = false;
    };
  }, [textbook.fileData, textbook.file_url]);

  // Render PDF Page onto Canvas
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !pdfCanvasRef.current || !annotCanvasRef.current) return;
    try {
      await renderPdfPageToCanvas(pdfDoc, currentPage, pdfCanvasRef.current, 1.5);
      
      // Match annotation canvas dimensions to PDF canvas
      annotCanvasRef.current.width = pdfCanvasRef.current.width;
      annotCanvasRef.current.height = pdfCanvasRef.current.height;

      // Draw existing annotations for this page
      redrawAnnotations();
    } catch (err) {
      console.error('Error rendering PDF page:', err);
    }
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Redraw annotation strokes for the current page
  const redrawAnnotations = useCallback(() => {
    const canvas = annotCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pageStrokes = annotations[currentPage] || [];

    for (const stroke of pageStrokes) {
      if (stroke.points.length === 0) continue;

      ctx.save();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.globalAlpha = stroke.opacity;

      if (stroke.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'multiply';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [annotations, currentPage]);

  useEffect(() => {
    redrawAnnotations();
  }, [redrawAnnotations]);

  // Pointer Events: S Pen / Touch / Mouse Drawing
  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = annotCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasCoordinates(e);

    if (tool === 'eraser') {
      // Erase strokes near point
      eraseAtPoint(x, y);
      setIsDrawing(true);
      return;
    }

    const stroke: DrawingStroke = {
      id: crypto.randomUUID(),
      tool,
      color: tool === 'highlighter' ? `${color}88` : color,
      size: tool === 'highlighter' ? size * 4 : size,
      opacity: tool === 'highlighter' ? 0.4 : 1,
      points: [{ x, y, pressure: e.pressure || 0.5, time: Date.now() }],
    };

    setCurrentStroke(stroke);
    setIsDrawing(true);
    setRedoStack([]); // Clear redo stack on new stroke
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoordinates(e);

    if (tool === 'eraser') {
      eraseAtPoint(x, y);
      return;
    }

    if (currentStroke) {
      const newPt: StrokePoint = { x, y, pressure: e.pressure || 0.5, time: Date.now() };
      const updatedStroke = {
        ...currentStroke,
        points: [...currentStroke.points, newPt],
      };
      setCurrentStroke(updatedStroke);

      // Draw stroke segment live
      const canvas = annotCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = updatedStroke.color;
          ctx.lineWidth = updatedStroke.size;
          ctx.globalAlpha = updatedStroke.opacity;
          if (updatedStroke.tool === 'highlighter') {
            ctx.globalCompositeOperation = 'multiply';
          }
          const len = updatedStroke.points.length;
          if (len >= 2) {
            ctx.beginPath();
            ctx.moveTo(updatedStroke.points[len - 2].x, updatedStroke.points[len - 2].y);
            ctx.lineTo(newPt.x, newPt.y);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStroke && currentStroke.points.length > 1) {
      const pageStrokes = annotations[currentPage] || [];
      const updatedPageStrokes = [...pageStrokes, currentStroke];
      const updatedAnnotations = { ...annotations, [currentPage]: updatedPageStrokes };
      setAnnotations(updatedAnnotations);
      setCurrentStroke(null);

      // Persist annotations
      await onUpdateTextbook({
        annotations: updatedAnnotations,
        currentPage,
        updated_at: new Date().toISOString(),
      });
    }
  };

  const eraseAtPoint = (x: number, y: number) => {
    const pageStrokes = annotations[currentPage] || [];
    const radius = 15;
    const remaining = pageStrokes.filter((stroke) => {
      return !stroke.points.some(
        (pt) => Math.hypot(pt.x - x, pt.y - y) < radius
      );
    });

    if (remaining.length !== pageStrokes.length) {
      const updatedAnnotations = { ...annotations, [currentPage]: remaining };
      setAnnotations(updatedAnnotations);
      onUpdateTextbook({
        annotations: updatedAnnotations,
        currentPage,
        updated_at: new Date().toISOString(),
      });
    }
  };

  // Undo
  const handleUndo = async () => {
    const pageStrokes = annotations[currentPage] || [];
    if (pageStrokes.length === 0) return;

    const popped = pageStrokes[pageStrokes.length - 1];
    const remaining = pageStrokes.slice(0, -1);
    setRedoStack((prev) => [...prev, popped]);

    const updatedAnnotations = { ...annotations, [currentPage]: remaining };
    setAnnotations(updatedAnnotations);
    await onUpdateTextbook({
      annotations: updatedAnnotations,
      currentPage,
      updated_at: new Date().toISOString(),
    });
  };

  // Redo
  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const restored = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    const pageStrokes = annotations[currentPage] || [];
    const updatedPageStrokes = [...pageStrokes, restored];
    const updatedAnnotations = { ...annotations, [currentPage]: updatedPageStrokes };
    setAnnotations(updatedAnnotations);
    await onUpdateTextbook({
      annotations: updatedAnnotations,
      currentPage,
      updated_at: new Date().toISOString(),
    });
  };

  // Clear Annotations on Page
  const handleClearPage = async () => {
    if (!confirm('Clear all annotations on this page?')) return;
    const updatedAnnotations = { ...annotations, [currentPage]: [] };
    setAnnotations(updatedAnnotations);
    await onUpdateTextbook({
      annotations: updatedAnnotations,
      currentPage,
      updated_at: new Date().toISOString(),
    });
  };

  // Page Navigation
  const goToPage = async (page: number) => {
    const target = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(target);
    await onUpdateTextbook({ currentPage: target });
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col bg-app-bg text-app-text select-none theme-transition"
    >
      {/* Top Header & Navigation */}
      <header className="sticky top-0 z-40 h-16 flex items-center justify-between px-4 md:px-8 bg-app-surface border-b border-app-border">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors flex items-center gap-1 text-xs"
            title="Back to textbooks"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Textbooks</span>
          </button>
          <div className="h-4 w-px bg-app-border" />
          <h1 className="font-serif text-sm md:text-base font-medium text-app-text truncate max-w-[180px] md:max-w-md">
            {textbook.title}
          </h1>
        </div>

        {/* Center: Page Stepper */}
        <div className="flex items-center gap-1 bg-app-bg px-2.5 py-1 rounded-lg border border-app-border">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 rounded text-app-text-muted hover:text-app-text disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-mono text-app-text-muted px-2 font-medium">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1 rounded text-app-text-muted hover:text-app-text disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Fullscreen & Theme */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* S Pen & PDF Annotation Toolbar */}
      <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-2 bg-app-surface/90 backdrop-blur-md border-b border-app-border">
        {/* Tools (Pen, Highlighter, Eraser) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTool('pen')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              tool === 'pen'
                ? 'bg-app-accent text-white shadow-subtle'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
          >
            <Pen className="w-3.5 h-3.5" />
            <span>Pen</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('highlighter')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              tool === 'highlighter'
                ? 'bg-app-accent text-white shadow-subtle'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
          >
            <span className="w-3.5 h-3.5 rounded-sm bg-yellow-400/80 inline-block" />
            <span>Highlight</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('eraser')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              tool === 'eraser'
                ? 'bg-app-accent text-white shadow-subtle'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>
        </div>

        {/* Color Picker & Stroke Size */}
        {tool !== 'eraser' && (
          <div className="flex items-center gap-3">
            {/* Colors */}
            <div className="flex items-center gap-1.5">
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-5 h-5 rounded-full border transition-transform',
                    color === c ? 'scale-125 border-app-accent shadow-sm' : 'border-transparent hover:scale-110'
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            <div className="h-4 w-px bg-app-border" />

            {/* Stroke Sizes */}
            <div className="flex items-center gap-1">
              {STROKE_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={cn(
                    'w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono transition-colors',
                    size === s
                      ? 'bg-app-surface-hover text-app-accent font-bold border border-app-border'
                      : 'text-app-text-muted hover:text-app-text'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Undo, Redo, Clear */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!(annotations[currentPage]?.length > 0)}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text disabled:opacity-30 transition-colors"
            title="Undo stroke"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text disabled:opacity-30 transition-colors"
            title="Redo stroke"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleClearPage}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-500 transition-colors"
            title="Clear all annotations on this page"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Page Area */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-auto bg-app-bg">
        {isLoadingPdf ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-20 text-app-text-muted font-serif italic text-sm">
            <span className="animate-pulse">Loading PDF document...</span>
          </div>
        ) : (
          <div className="relative shadow-elevated rounded-lg overflow-hidden border border-app-border bg-white inline-block">
            {/* Background PDF Render Canvas */}
            <canvas ref={pdfCanvasRef} className="block max-w-full h-auto" />

            {/* Foreground S Pen & Pointer Drawing Canvas */}
            <canvas
              ref={annotCanvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            />
          </div>
        )}
      </main>
    </div>
  );
};
