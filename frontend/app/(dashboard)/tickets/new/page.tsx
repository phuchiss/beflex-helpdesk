'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import type { Category, User, Project, ApiListResponse } from '@/types';
import { ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/markdown-editor';

export default function NewTicketPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [categoryId, setCategoryId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: categoriesData } = useQuery<ApiListResponse<Category>>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data;
    },
  });

  const { data: usersData } = useQuery<ApiListResponse<User>>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });

  const currentUser = typeof window !== 'undefined' ? getStoredUser() as User | null : null;

  const { data: projectsData } = useQuery<ApiListResponse<Project>>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
  });

  const { data: userProjectsData } = useQuery<ApiListResponse<Project>>({
    queryKey: ['user-projects', currentUser?.id],
    queryFn: async () => {
      const res = await api.get(`/users/${currentUser!.id}/projects`);
      return res.data;
    },
    enabled: !!currentUser?.id,
  });

  const availableProjects = (() => {
    const userProjects = userProjectsData?.data;
    if (userProjects && userProjects.length > 0) {
      return userProjects.filter(p => p.is_active);
    }
    return projectsData?.data?.filter(p => p.is_active) ?? [];
  })();

  useEffect(() => {
    if (!projectId && availableProjects.length > 0) {
      setProjectId(availableProjects[0].id);
    }
  }, [availableProjects, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/tickets', {
        subject,
        description: description || null,
        priority,
        project_id: projectId || null,
        category_id: categoryId || null,
        assignee_id: assigneeId || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      });
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      router.push(`/tickets/${res.data.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create ticket';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">New Ticket</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject *</Label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Brief description of the issue"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <MarkdownEditor
              id="description"
              value={description}
              onChange={setDescription}
              rows={6}
              placeholder="Detailed description of the issue..."
              className="border-gray-300 dark:border-gray-700"
            />
          </div>
          <div>
            <Label htmlFor="project">Project *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId || '__none__'} onValueChange={(v) => setCategoryId(v === '__none__' ? '' : v)}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No category</SelectItem>
                  {categoriesData?.data?.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignee">Assignee</Label>
              <Select value={assigneeId || '__none__'} onValueChange={(v) => setAssigneeId(v === '__none__' ? '' : v)}>
                <SelectTrigger id="assignee">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {usersData?.data
                    ?.filter(u => u.is_active && (u.role === 'agent' || u.role === 'admin'))
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="due-date">Due Date</Label>
              <input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !subject.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
