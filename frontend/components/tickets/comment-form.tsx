'use client';

import { useState, useRef } from 'react';
import api from '@/lib/api';
import type { Attachment } from '@/types';
import { Paperclip, Send, X, Lock } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import { MarkdownEditor } from '@/components/markdown-editor';

interface CommentFormProps {
  ticketId: string;
  onSuccess: () => void;
}

export function CommentForm({ ticketId, onSuccess }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post<Attachment>('/attachments', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setAttachments(prev => [...prev, res.data]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/tickets/${ticketId}/comments`, {
        content,
        is_internal: isInternal,
        attachment_ids: attachments.map(a => a.id),
      });
      setContent('');
      setAttachments([]);
      setIsInternal(false);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to post comment';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Reply</h3>
        <button
          type="button"
          onClick={() => setIsInternal(!isInternal)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            isInternal ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          <Lock className="h-3 w-3" />
          {isInternal ? 'Internal Note' : 'Public Reply'}
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      <MarkdownEditor
        value={content}
        onChange={setContent}
        placeholder={isInternal ? 'Add an internal note (only visible to agents)...' : 'Write a reply... (Markdown supported)'}
        rows={4}
        className={isInternal ? 'border-yellow-300 dark:border-yellow-700' : 'border-gray-300 dark:border-gray-700'}
      />

      {attachments.length > 0 && (
        <div className="mt-2 space-y-1">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
              <span className="flex-1 truncate">{att.original_filename}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{formatFileSize(att.file_size)}</span>
              <button type="button" onClick={() => removeAttachment(att.id)}>
                <X className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Paperclip className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Attach'}
          </button>
        </div>
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  );
}
