'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, UserPlus, RefreshCw, MessageSquare, Check } from 'lucide-react';
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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: countData } = useQuery<{ unread_count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => (await api.get('/notifications/unread-count')).data,
    refetchInterval: 30000,
  });

  const { data: listData } = useQuery<NotificationListResponse>({
    queryKey: ['notifications', 'recent'],
    queryFn: async () => (await api.get('/notifications?per_page=10')).data,
    refetchInterval: 30000,
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const unreadCount = countData?.unread_count ?? 0;
  const notifications = listData?.data ?? [];

  function handleNotificationClick(id: string, ticketId: string | null, isRead: boolean) {
    if (!isRead) markRead.mutate(id);
    setOpen(false);
    if (ticketId) router.push(`/tickets/${ticketId}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 relative"
      >
        <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                No notifications
              </div>
            ) : (
              notifications.map(n => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                const iconColor = TYPE_COLORS[n.type] ?? 'text-gray-400';
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n.id, n.ticket_id, n.is_read)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0',
                      !n.is_read && 'bg-blue-50/50 dark:bg-blue-950/20'
                    )}
                  >
                    <div className={cn('mt-0.5 flex-shrink-0 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800', iconColor)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
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
                    </div>
                    {!n.is_read && (
                      <span className="mt-2 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => { setOpen(false); router.push('/notifications'); }}
              className="w-full px-4 py-2.5 text-sm text-center text-blue-600 dark:text-blue-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              See all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
