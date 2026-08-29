import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { StrokePoint, DrawingStroke } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7 && diffDays > 0) {
    return `${diffDays} days ago`;
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDueDate(dateString?: string | null): { text: string; isOverdue: boolean; isSoon: boolean } {
  if (!dateString) return { text: 'No due date', isOverdue: false, isSoon: false };
  const due = new Date(dateString);
  const now = new Date();
  const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (diffHours < 0) {
    return {
      text: `Overdue (${Math.abs(Math.floor(diffHours / 24))}d ago)`,
      isOverdue: true,
      isSoon: false,
    };
  } else if (diffHours < 24) {
    return {
      text: `Due today (${Math.floor(diffHours)}h left)`,
      isOverdue: false,
      isSoon: true,
    };
  } else if (diffHours < 72) {
    return {
      text: `Due in ${Math.floor(diffHours / 24)} days`,
      isOverdue: false,
      isSoon: true,
    };
  }
  
  return {
    text: `Due ${due.toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
    isOverdue: false,
    isSoon: false,
  };
}

// Canvas Drawing & Catmull-Rom / Bezier smoothing functions
export function renderStrokeToCanvas(ctx: CanvasRenderingContext2D, stroke: DrawingStroke) {
  const { points, color, size, opacity, tool } = stroke;
  if (!points || points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (tool === 'highlighter') {
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity || 0.35;
    ctx.lineWidth = size * 2.5;
  } else if (tool === 'pencil') {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = size * 0.9;
  } else if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = size * 2;
  } else {
    // pen or fountain
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity || 1;
    ctx.lineWidth = size;
  }

  if (tool === 'line' && points.length >= 2) {
    const start = points[0];
    const end = points[points.length - 1];
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (tool === 'rect' && points.length >= 2) {
    const start = points[0];
    const end = points[points.length - 1];
    ctx.beginPath();
    ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (tool === 'circle' && points.length >= 2) {
    const start = points[0];
    const end = points[points.length - 1];
    const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    ctx.beginPath();
    ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (points.length === 1) {
    const p = points[0];
    ctx.beginPath();
    const radius = (p.pressure ? size * p.pressure : size) / 2;
    ctx.arc(p.x, p.y, Math.max(1, radius), 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.restore();
    return;
  }

  // Smooth multi-point spline
  if (tool === 'fountain') {
    // Pressure varying segments
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const pressure = p2.pressure ?? 0.5;
      const currentWidth = Math.max(1, size * (pressure * 1.6));
      
      ctx.beginPath();
      ctx.lineWidth = currentWidth;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  } else {
    // Smooth quadratic curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  ctx.restore();
}
