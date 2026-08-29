'use client';

import React, { useState, useEffect } from 'react';
import { X, BookOpen, GraduationCap, Upload, Sparkles, Folder as FolderIcon } from 'lucide-react';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import { Subject, Folder } from '@/types';
import { cn } from '@/lib/utils';
import { getPdfJs } from '@/lib/pdf/pdfViewerHelper';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'notebook' | 'textbook';
  onCreated: (item?: any) => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  isOpen,
  onClose,
  initialType = 'notebook',
  onCreated,
}) => {
  const [activeType, setActiveType] = useState<'notebook' | 'textbook'>(initialType);
  const [title, setTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadOrg = async () => {
      try {
        const [sRes, fRes] = await Promise.all([
          supabase.from('subjects').select('*').eq('is_deleted', false).order('name', { ascending: true }),
          supabase.from('folders').select('*').eq('is_deleted', false).order('name', { ascending: true }),
        ]);
        if (sRes.data) setSubjects(sRes.data);
        if (fRes.data) setFolders(fRes.data);
      } catch (e) {
        console.error('Failed to load subjects in CreateModal:', e);
      }
    };
    loadOrg();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        setErrorMsg('Please select a valid PDF file.');
        return;
      }
      setSelectedFile(file);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.pdf$/i, '').trim());
      }
      setErrorMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Please enter a title.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const userId = await getCurrentUserId();

      if (activeType === 'notebook') {
        // Create Notebook in Supabase
        const { data: nbData, error: nbError } = await supabase
          .from('notebooks')
          .insert([
            {
              user_id: userId,
              title: cleanTitle,
              subject_id: selectedSubjectId || null,
              folder_id: selectedFolderId || null,
              is_starred: false,
              is_deleted: false,
              default_template: 'ruled',
            },
          ])
          .select()
          .single();

        if (nbError) throw nbError;

        // Create initial Page 1 in notebook_pages
        await supabase.from('notebook_pages').insert([
          {
            user_id: userId,
            notebook_id: nbData.id,
            page_number: 1,
            title: 'Page 1',
            template: 'ruled',
            blocks: [
              {
                id: crypto.randomUUID(),
                type: 'text',
                content: { type: 'doc', content: [{ type: 'paragraph' }] },
              },
            ],
            is_deleted: false,
          },
        ]);

        setTitle('');
        setSelectedSubjectId(null);
        setSelectedFolderId(null);
        setIsLoading(false);
        onCreated(nbData);
        onClose();
      } else {
        // Create Textbook
        let filePath = '';
        let fileUrl = '';
        let pageCount = 1;

        if (selectedFile) {
          const fileExt = selectedFile.name.split('.').pop() || 'pdf';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          filePath = `${userId}/${fileName}`;

          // Upload to Supabase Storage bucket 'textbooks'
          const { error: uploadError } = await supabase.storage
            .from('textbooks')
            .upload(filePath, selectedFile, {
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadError) {
            console.warn('Supabase storage upload error:', uploadError);
            const reader = new FileReader();
            fileUrl = await new Promise((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(selectedFile);
            });
          } else {
            const { data: urlData } = supabase.storage
              .from('textbooks')
              .getPublicUrl(filePath);
            fileUrl = urlData?.publicUrl || '';
          }

          // Extract page count
          try {
            const pdfjs = await getPdfJs();
            if (pdfjs && fileUrl) {
              const loadingTask = pdfjs.getDocument(fileUrl);
              const doc = await loadingTask.promise;
              pageCount = doc.numPages;
            }
          } catch (pdfErr) {
            console.warn('Could not extract PDF page count:', pdfErr);
          }
        }

        const { data: tbData, error: tbError } = await supabase
          .from('textbooks')
          .insert([
            {
              user_id: userId,
              title: cleanTitle,
              file_path: filePath || null,
              file_url: fileUrl || null,
              file_name: selectedFile?.name || `${cleanTitle}.pdf`,
              page_count: pageCount,
              current_page: 1,
              annotations: {},
              is_starred: false,
              is_deleted: false,
            },
          ])
          .select()
          .single();

        if (tbError) throw tbError;

        setTitle('');
        setSelectedFile(null);
        setIsLoading(false);
        onCreated(tbData);
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to create item in Supabase:', err);
      setErrorMsg(err?.message || 'Failed to save to database. Please check your connection.');
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'notebook' as const, label: 'Notebook', icon: BookOpen },
    { id: 'textbook' as const, label: 'Textbook', icon: GraduationCap },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-elevated overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h3 className="font-serif text-base font-medium text-app-text">
            {activeType === 'textbook' ? 'New Textbook' : 'New Notebook'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-app-text-muted hover:text-app-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-app-border bg-app-bg px-4 pt-2 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveType(tab.id);
                  setErrorMsg(null);
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium border-b-2 transition-all',
                  isActive
                    ? 'border-app-accent text-app-text bg-app-surface'
                    : 'border-transparent text-app-text-muted hover:text-app-text'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-app-text-muted">
              {activeType === 'notebook' ? 'Notebook title' : 'Textbook title'}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={activeType === 'notebook' ? 'e.g. Linear Algebra Notes' : 'e.g. Organic Chemistry'}
              className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors font-serif"
            />
          </div>

          {activeType === 'notebook' && (
            <>
              {/* Optional Subject selector */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted">Subject (optional)</label>
                <select
                  value={selectedSubjectId || ''}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value || null);
                    setSelectedFolderId(null);
                  }}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-app-text outline-none focus:border-app-accent"
                >
                  <option value="">(Unassigned - No Subject)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Folder selector if Subject chosen */}
              {selectedSubjectId && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted">Folder (optional)</label>
                  <select
                    value={selectedFolderId || ''}
                    onChange={(e) => setSelectedFolderId(e.target.value || null)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-app-text outline-none focus:border-app-accent"
                  >
                    <option value="">(Subject Root - No Folder)</option>
                    {folders
                      .filter((f) => f.subject_id === selectedSubjectId)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </>
          )}

          {activeType === 'textbook' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-app-text-muted">
                PDF Document
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="modal-pdf-upload"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="modal-pdf-upload"
                  className="flex items-center justify-between p-3 rounded-xl border border-dashed border-app-border bg-app-bg hover:border-app-accent cursor-pointer text-xs text-app-text transition-colors"
                >
                  <span className="truncate max-w-[240px] text-app-text-dim">
                    {selectedFile ? selectedFile.name : 'Select PDF from device...'}
                  </span>
                  <Upload className="w-3.5 h-3.5 text-app-accent flex-shrink-0" />
                </label>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-app-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs text-app-text-muted hover:text-app-text transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-app-accent hover:opacity-90 disabled:opacity-50 text-white text-xs font-medium transition-opacity flex items-center gap-1.5"
            >
              {isLoading ? (
                <span>Saving to Supabase...</span>
              ) : (
                <span>{activeType === 'notebook' ? 'Create notebook' : 'Add textbook'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
