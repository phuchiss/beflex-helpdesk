'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import api from '@/lib/api';
import type { Attachment } from '@/types';

interface AttachmentPreviewProps {
  attachment: Attachment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttachmentPreview({ attachment, open, onOpenChange }: AttachmentPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const isImage = attachment.mime_type.startsWith('image/');
  const isPdf = attachment.mime_type === 'application/pdf';

  const cleanup = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
  }, []);

  useEffect(() => {
    if (!open) {
      cleanup();
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get(`/attachments/${attachment.id}/download`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        cleanup();
        const url = URL.createObjectURL(res.data);
        blobUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError('ไม่สามารถโหลดตัวอย่างได้');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, attachment.id, cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isPdf && 'max-w-5xl h-[85vh] flex flex-col',
          isImage && 'max-w-4xl'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-8">
            <DialogTitle className="truncate text-base">
              {attachment.original_filename}
            </DialogTitle>
            <DialogDescription className="mt-0.5">
              {formatFileSize(attachment.file_size)}
            </DialogDescription>
          </div>
          {blobUrl && (
            <a
              href={blobUrl}
              download={attachment.original_filename}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          )}
        </div>

        <div
          className={cn(
            'flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden',
            isPdf ? 'flex-1 min-h-0 mt-3' : 'mt-3'
          )}
        >
          {loading && (
            <div className="flex flex-col items-center gap-2 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 py-12">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && blobUrl && isImage && (
            <img
              src={blobUrl}
              alt={attachment.original_filename}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}

          {!loading && !error && blobUrl && isPdf && (
            <iframe
              src={blobUrl}
              title={attachment.original_filename}
              className="w-full h-full border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
