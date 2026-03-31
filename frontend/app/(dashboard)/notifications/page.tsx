'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, UserPlus, RefreshCw, MessageSquare, Check, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { NotificationListResponse, NotificationType } from '@/types';

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  ticket_assigned: UserPlus,
  ticket_status_changed: RefreshCw,
  comment_added: MessageSquare,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  ticket_assigned: 'text-blue-500',
  ticket_status_changed: 'text-amber-500',
  comment_added: 'text-green-500',
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function NotificationsPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [page, setPage] = useState(1);
  const perPage = 20;
  const router = useRouter();
  const queryClient = useQueryClient();

  const isReadParam = tab === 'unread' ? 'false' : tab === 'read' ? 'true' : undefined;

  const { data, isLoading } = useQuery<NotificationListResponse>({
    queryKey: ['notifications', 'page', { tab, page }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (isReadParam !== undefined) params.set('is_read', isReadParam);
      return (await api.get(`/notifications?${params}`)).data;
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteNotification = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;

  function handleClick(id: string, ticketId: string | null, isRead: boolean) {
    if (!isRead) markRead.mutate(id);
    if (ticketId) router.push(`/tickets/${ticketId}`);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
          >
            <Check className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              tab === t.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tab === 'unread' ? 'No unread notifications' : tab === 'read' ? 'No read notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          notifications.map(n => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            const iconColor = TYPE_COLORS[n.type] ?? 'text-gray-400';
            return (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0 transition-colors',
                  !n.is_read && 'bg-blue-50/40 dark:bg-blue-950/15'
                )}
              >
                <div className={cn('mt-0.5 flex-shrink-0 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800', iconColor)}>
                  <Icon className="h-4 w-4" />
                </div>
                <button
                  onClick={() => handleClick(n.id, n.ticket_id, n.is_read)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className={cn(
                    'text-sm leading-snug',
                    n.is_read
                      ? 'text-gray-600 dark:text-gray-400'
                      : 'text-gray-900 dark:text-gray-100 font-medium'
                  )}>
                    {n.message}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatRelativeTime(n.created_at)}
                  </p>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification.mutate(n.id); }}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {notifications.length >= perPage && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400 px-3">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      )}
    </div>
  );
}
