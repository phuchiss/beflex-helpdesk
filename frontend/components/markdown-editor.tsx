'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/markdown';
import { Eye, Pencil } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  id?: string;
}

export function MarkdownEditor({ value, onChange, placeholder, rows = 6, className, id }: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <button
          type="button"
          onClick={() => setTab('write')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors',
            tab === 'write'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-900'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors',
            tab === 'preview'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-900'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
        <span className="ml-auto pr-3 text-xs text-gray-400 dark:text-gray-500">Markdown supported</span>
      </div>

      {tab === 'write' ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 text-sm focus:outline-none resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 border-0"
        />
      ) : (
        <div className="px-3 py-2 bg-white dark:bg-gray-900 min-h-[calc(1.5rem*var(--rows)+1rem)]" style={{ '--rows': rows } as React.CSSProperties}>
          {value.trim() ? (
            <Markdown content={value} className="text-gray-700 dark:text-gray-300" />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">Nothing to preview</p>
          )}
        </div>
      )}
    </div>
  );
}
