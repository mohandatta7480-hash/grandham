'use client';

import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Edit2,
  Check,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageBlockProps {
  content: {
    url?: string;
    caption?: string;
    altText?: string;
    size?: 'small' | 'medium' | 'large' | 'full';
  };
  onChange: (newContent: any) => void;
  onDelete?: () => void;
}

export const ImageBlock: React.FC<ImageBlockProps> = ({ content, onChange, onDelete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [caption, setCaption] = useState(content.caption || '');
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSize = content.size || 'large';

  const handleUploadFile = async (file: File) => {
    if (!file) return;

    try {
      setIsUploading(true);
      const reader = new FileReader();

      reader.onload = async () => {
        const localDataUrl = reader.result as string;

        // Try upload to Supabase Storage bucket 'note-images'
        let finalUrl = localDataUrl;
        try {
          const ext = file.name.split('.').pop() || 'png';
          const fileName = `${crypto.randomUUID()}.${ext}`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('note-images')
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

          if (!uploadErr && uploadData) {
            const { data: pubData } = supabase.storage
              .from('note-images')
              .getPublicUrl(fileName);
            if (pubData?.publicUrl) {
              finalUrl = pubData.publicUrl;
            }
          }
        } catch (e) {
          console.warn('Storage upload fallback to data URL:', e);
        }

        onChange({
          ...content,
          url: finalUrl,
          caption: caption || file.name,
          size: currentSize,
        });
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to process image:', err);
      setIsUploading(false);
    }
  };

  const handleSizeChange = (newSize: 'small' | 'medium' | 'large' | 'full') => {
    onChange({ ...content, size: newSize });
  };

  const handleSaveCaption = () => {
    setIsEditingCaption(false);
    onChange({ ...content, caption: caption.trim() });
  };

  if (!content.url) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith('image/')) {
            handleUploadFile(file);
          }
        }}
        className={cn(
          'my-3 p-8 rounded-2xl border-2 border-dashed transition-all text-center space-y-2',
          isDragOver
            ? 'border-app-accent bg-app-accent/10 ring-2 ring-app-accent/20'
            : 'border-app-border bg-app-surface/60 hover:border-app-accent/50'
        )}
      >
        <ImageIcon className="w-8 h-8 text-app-text-dim mx-auto" />
        <p className="text-xs font-medium text-app-text">Insert Image</p>
        <p className="text-[11px] text-app-text-muted">
          Paste with <kbd className="px-1.5 py-0.5 rounded bg-app-bg border border-app-border font-mono text-[10px]">Ctrl+V</kbd>, drag and drop here, or choose from device:
        </p>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-subtle"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{isUploading ? 'Uploading...' : 'Choose Image File'}</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadFile(file);
          }}
          className="hidden"
        />
      </div>
    );
  }

  const sizeClasses = {
    small: 'max-w-xs mx-auto',
    medium: 'max-w-md mx-auto',
    large: 'max-w-2xl mx-auto',
    full: 'w-full',
  }[currentSize];

  return (
    <div className="my-4 group/img relative w-full space-y-2">
      {/* Floating control bar */}
      <div className="opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-between p-1 bg-app-surface/95 backdrop-blur-md border border-app-border rounded-xl max-w-fit mx-auto shadow-elevated z-20">
        <div className="flex items-center gap-1">
          {(['small', 'medium', 'large', 'full'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSizeChange(s)}
              className={cn(
                'px-2 py-0.5 text-[10px] capitalize rounded font-mono transition-colors',
                currentSize === s
                  ? 'bg-app-accent text-white font-medium shadow-subtle'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="w-px h-3.5 bg-app-border mx-1" />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1 rounded text-app-text-muted hover:text-app-text text-[11px] flex items-center gap-1"
          title="Replace image"
        >
          <Upload className="w-3 h-3" />
          <span className="text-[10px] hidden sm:inline">Replace</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadFile(file);
          }}
          className="hidden"
        />

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 text-[11px]"
            title="Delete image block"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Rendered Image */}
      <div className={cn('rounded-2xl overflow-hidden border border-app-border bg-app-bg transition-all shadow-subtle', sizeClasses)}>
        <img
          src={content.url}
          alt={content.altText || caption || 'Note image'}
          className="w-full h-auto object-contain max-h-[650px] select-none"
        />
      </div>

      {/* Caption Editor */}
      <div className="text-center">
        {isEditingCaption ? (
          <div className="inline-flex items-center gap-1">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCaption()}
              placeholder="Add caption..."
              autoFocus
              className="bg-app-surface border border-app-accent rounded-lg px-2.5 py-0.5 text-xs text-app-text outline-none text-center font-sans"
            />
            <button
              type="button"
              onClick={handleSaveCaption}
              className="p-1 rounded-lg bg-app-accent text-white"
            >
              <Check className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <p
            onClick={() => setIsEditingCaption(true)}
            className="text-[11px] text-app-text-muted hover:text-app-accent cursor-pointer italic transition-colors inline-block"
            title="Click to edit caption"
          >
            {caption || 'Add caption...'}
          </p>
        )}
      </div>
    </div>
  );
};
