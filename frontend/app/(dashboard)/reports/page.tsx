'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { BarChart3, Clock, TrendingUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface ReportItem {
  label: string;
  count: number;
}

interface PerDayItem {
  date: string;
  count: number;
}

interface ReportData {
  total: number;
  avg_resolution_hours: number;
  by_status: ReportItem[];
  by_priority: ReportItem[];
  by_project: ReportItem[];
  by_assignee: ReportItem[];
  per_day: PerDayItem[];
}

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6',
  in_progress: '#eab308',
  pending: '#f97316',
  resolved: '#22c55e',
  closed: '#9ca3af',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#9ca3af',
  medium: '#3b82f6',
  high: '#f97316',
  critical: '#ef4444',
};

const PIE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

function formatLabel(s: string): string {
  return (s || 'Unknown').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading } = useQuery<ReportData>({
    queryKey: ['reports', { fromDate, toDate }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) params.set('to', new Date(toDate + 'T23:59:59').toISOString());
      const res = await api.get(`/reports?${params.toString()}`);
      return res.data as ReportData;
    },
  });

  const statusData = (data?.by_status ?? []).map(d => ({ name: formatLabel(d.label), value: d.count, key: d.label }));
  const priorityData = (data?.by_priority ?? []).map(d => ({ name: formatLabel(d.label), value: d.count, key: d.label }));
  const projectData = (data?.by_project ?? []).map(d => ({ name: formatLabel(d.label), value: d.count }));
  const assigneeData = (data?.by_assignee ?? []).map(d => ({ name: formatLabel(d.label), value: d.count }));
  const dailyData = (data?.per_day ?? []).map(d => ({ date: d.date.slice(5), count: d.count, fullDate: d.date }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="from">From</Label>
            <input
              id="from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <input
              id="to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Tickets</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data?.total ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Avg Resolution Time</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {data?.avg_resolution_hours ? `${data.avg_resolution_hours.toFixed(1)}h` : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Daily Average</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {data?.per_day && data.per_day.length > 0
                      ? (data.per_day.reduce((sum, d) => sum + d.count, 0) / data.per_day.length).toFixed(1)
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Tickets Per Day</h2>
            {dailyData.length === 0 ? (
              <p className="text-sm text-gray-400">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
                  />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} name="Tickets" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Status</h2>
              {statusData.length === 0 ? (
                <p className="text-sm text-gray-400">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} (${value})`}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.key] || '#3b82f6'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Priority</h2>
              {priorityData.length === 0 ? (
                <p className="text-sm text-gray-400">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} (${value})`}>
                      {priorityData.map((entry) => (
                        <Cell key={entry.name} fill={PRIORITY_COLORS[entry.key] || '#3b82f6'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Project</h2>
              {projectData.length === 0 ? (
                <p className="text-sm text-gray-400">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={projectData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                    <Bar dataKey="value" name="Tickets" radius={[0, 4, 4, 0]}>
                      {projectData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Assignee</h2>
              {assigneeData.length === 0 ? (
                <p className="text-sm text-gray-400">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={assigneeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                    <Bar dataKey="value" name="Tickets" radius={[0, 4, 4, 0]}>
                      {assigneeData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
