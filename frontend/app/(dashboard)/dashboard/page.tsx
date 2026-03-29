'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { StatusBadge, PriorityBadge } from '@/components/tickets/ticket-badge';
import type { DashboardStats } from '@/types';
import { CheckCircle, Clock, AlertCircle, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Failed to load dashboard data
      </div>
    );
  }

  const stats = data?.stats;

  const statCards = [
    { label: 'Total Tickets', value: stats?.total ?? 0, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Open', value: stats?.open ?? 0, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/30' },
    { label: 'In Progress', value: stats?.in_progress ?? 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/30' },
    { label: 'Resolved', value: stats?.resolved ?? 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <Link
          href="/tickets/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Ticket
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Tickets</h2>
          <Link href="/tickets" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {data?.recent_tickets?.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No tickets yet</div>
          )}
          {data?.recent_tickets?.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">#{ticket.ticket_number}</span>
                  <StatusBadge value={ticket.status} />
                  <PriorityBadge value={ticket.priority} />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ticket.subject}</p>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{formatDate(ticket.created_at)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
