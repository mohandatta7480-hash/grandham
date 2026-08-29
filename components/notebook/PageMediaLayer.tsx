'use client';

import React from 'react';
import { PageMediaImage, PageUrlEmbed, PdfAttachment } from '@/types';
import { ExternalLink, FileText, Trash2, Globe, Image as ImageIcon } from 'lucide-react';

interface PageMediaLayerProps {
  images: PageMediaImage[];
  urls: PageUrlEmbed[];
  pdfAttachments: PdfAttachment[];
  onRemoveImage: (id: string) => void;
  onRemoveUrl: (id: string) => void;
  onRemovePdf: (id: string) => void;
  onOpenPdf?: (pdf: PdfAttachment) => void;
}

export const PageMediaLayer: React.FC<PageMediaLayerProps> = ({
  images,
  urls,
  pdfAttachments,
  onRemoveImage,
  onRemoveUrl,
  onRemovePdf,
  onOpenPdf,
}) => {
  if (images.length === 0 && urls.length === 0 && pdfAttachments.length === 0) {
    return null;
  }

  return (
    <div className="p-6 pt-0 space-y-4 relative z-10">
      {/* PDF Attachments Section */}
      {pdfAttachments.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5 text-brand-400" />
            <span>Attached PDF Documents ({pdfAttachments.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {pdfAttachments.map((pdf) => (
              <div
                key={pdf.id}
                className="flex items-center justify-between p-3 rounded-xl bg-dark-900/80 border border-slate-800 hover:border-brand-500/50 transition-all group"
              >
                <div
                  onClick={() => onOpenPdf && onOpenPdf(pdf)}
                  className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1"
                >
                  <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-medium text-slate-200 truncate group-hover:text-brand-300">
                      {pdf.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {pdf.size ? `${(pdf.size / (1024 * 1024)).toFixed(1)} MB` : 'PDF Document'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePdf(pdf.id);
                  }}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove attachment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Embedded URLs Section */}
      {urls.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Referenced Links ({urls.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {urls.map((link) => (
              <div
                key={link.id}
                className="relative flex items-start justify-between p-3.5 rounded-xl bg-dark-900/80 border border-slate-800 hover:border-cyan-500/50 transition-all group"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 flex-1 min-w-0"
                >
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 flex-shrink-0 mt-0.5">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate group-hover:text-cyan-300">
                      {link.title || link.url}
                    </p>
                    {link.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                        {link.description}
                      </p>
                    )}
                    <span className="text-[10px] text-cyan-500/80 truncate block mt-1">
                      {link.url}
                    </span>
                  </div>
                </a>
                <button
                  type="button"
                  onClick={() => onRemoveUrl(link.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  title="Remove link card"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inserted Images Section */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Inserted Images ({images.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative rounded-xl overflow-hidden border border-slate-800 bg-dark-900 group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption || 'Inserted notebook image'}
                  className="w-full h-48 object-cover rounded-xl transition-transform group-hover:scale-105"
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-950/80 text-rose-400 hover:bg-rose-500 hover:text-white shadow transition-all opacity-0 group-hover:opacity-100"
                  title="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {img.caption && (
                  <div className="p-2 bg-dark-950/80 text-xs text-slate-300 truncate">
                    {img.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
