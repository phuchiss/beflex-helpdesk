'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        a: ({ ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline" />
        ),
        code: ({ children, className: codeClassName, ...props }) => {
          const isInline = !codeClassName;
          return isInline ? (
            <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono" {...props}>{children}</code>
          ) : (
            <code className={cn('block overflow-x-auto p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-mono', codeClassName)} {...props}>{children}</code>
          );
        },
        pre: ({ children }) => <pre className="overflow-x-auto rounded-lg bg-gray-100 dark:bg-gray-800 p-3">{children}</pre>,
        img: ({ alt, ...props }) => <img {...props} alt={alt || ''} className="rounded-lg max-w-full" />,
        table: ({ children }) => <table className="border-collapse border border-gray-300 dark:border-gray-700 w-full">{children}</table>,
        th: ({ children }) => <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-left text-sm font-medium">{children}</th>,
        td: ({ children }) => <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
