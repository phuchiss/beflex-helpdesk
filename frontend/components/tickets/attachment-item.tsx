"use client";

import { useState } from "react";
import { formatFileSize } from "@/lib/utils";
import type { Attachment } from "@/types";
import {
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Eye,
} from "lucide-react";
import { AttachmentPreview } from "./attachment-preview";

interface AttachmentItemProps {
  attachment: Attachment;
  onDelete?: (id: string) => void;
  apiUrl?: string;
}

export function AttachmentItem({
  attachment,
  onDelete,
  apiUrl,
}: AttachmentItemProps) {
  const isImage = attachment.mime_type.startsWith("image/");
  const isPdf = attachment.mime_type === "application/pdf";
  const canPreview = isImage || isPdf;
  const downloadUrl = `${apiUrl || "/api"}/attachments/${attachment.id}/download`;

  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <div
        className={`flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${
          canPreview
            ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            : ""
        }`}
        onClick={canPreview ? () => setPreviewOpen(true) : undefined}
      >
        <div className="flex-shrink-0">
          {isImage ? (
            <ImageIcon className="h-5 w-5 text-blue-500" />
          ) : isPdf ? (
            <FileText className="h-5 w-5 text-red-500" />
          ) : (
            <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {attachment.original_filename}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatFileSize(attachment.file_size)}
          </p>
        </div>
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {canPreview && (
            <button
              onClick={() => setPreviewOpen(true)}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Preview"
            >
              <Eye className="h-4 w-4 text-blue-500" />
            </button>
          )}
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Download"
          >
            <Download className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </a>
          {onDelete && (
            <button
              onClick={() => onDelete(attachment.id)}
              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          )}
        </div>
      </div>

      {canPreview && (
        <AttachmentPreview
          attachment={attachment}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
    </>
  );
}
