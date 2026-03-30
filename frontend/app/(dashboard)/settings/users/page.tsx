'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { User, Project, ApiListResponse } from '@/types';
import { formatDate } from '@/lib/utils';
import { Plus, UserCheck, UserX, FolderOpen, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  project_ids: string[];
}

const defaultForm: CreateUserForm = { name: '', email: '', password: '', role: 'agent', project_ids: [] };

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(defaultForm);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const [editProjectsUserId, setEditProjectsUserId] = useState<string | null>(null);
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);
  const [savingProjects, setSavingProjects] = useState(false);

  const { data, isLoading } = useQuery<ApiListResponse<User>>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });

  const { data: projectsData } = useQuery<ApiListResponse<Project>>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
  });

  const activeProjects = projectsData?.data?.filter(p => p.is_active) ?? [];

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await api.put(`/users/${id}`, { role });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await api.put(`/users/${id}`, { is_active });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const toggleFormProject = (projectId: string) => {
    setForm(f => ({
      ...f,
      project_ids: f.project_ids.includes(projectId)
        ? f.project_ids.filter(id => id !== projectId)
        : [...f.project_ids, projectId],
    }));
  };

  const toggleEditProject = (projectId: string) => {
    setEditProjectIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError('');
    try {
      await api.post('/users', {
        ...form,
        project_ids: form.project_ids.length > 0 ? form.project_ids : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      setForm(defaultForm);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      setFormError(msg);
    } finally {
      setCreating(false);
    }
  };

  const openEditProjects = async (userId: string) => {
    setEditProjectsUserId(userId);
    try {
      const res = await api.get(`/users/${userId}/projects`);
      setEditProjectIds((res.data.data as Project[]).map(p => p.id));
    } catch {
      setEditProjectIds([]);
    }
  };

  const handleSaveProjects = async () => {
    if (!editProjectsUserId) return;
    setSavingProjects(true);
    try {
      await api.put(`/users/${editProjectsUserId}/projects`, {
        project_ids: editProjectIds,
      });
      queryClient.invalidateQueries({ queryKey: ['user-projects', editProjectsUserId] });
      setEditProjectsUserId(null);
    } catch {
    } finally {
      setSavingProjects(false);
    }
  };

  const editProjectsUser = data?.data?.find(u => u.id === editProjectsUserId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Users</h1>
        <button
          onClick={() => { setShowModal(true); setFormError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data?.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No users found</td>
                </tr>
              )}
              {data?.data?.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                  <td className="px-4 py-3">
                    <Select value={user.role} onValueChange={(v) => updateRoleMutation.mutate({ id: user.id, role: v })}>
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditProjects(user.id)}
                        title="Manage Projects"
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: user.id, is_active: !user.is_active })}
                        title={user.is_active ? 'Deactivate' : 'Activate'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          user.is_active
                            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                            : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                      >
                        {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) setFormError(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          {formError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>
          )}
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label htmlFor="user-name">Full Name</Label>
              <input id="user-name" type="text" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="John Doe" />
            </div>
            <div>
              <Label htmlFor="user-email">Email</Label>
              <input id="user-email" type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="user@example.com" />
            </div>
            <div>
              <Label htmlFor="user-password">Password</Label>
              <input id="user-password" type="password" required minLength={8} value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Min. 8 characters" />
            </div>
            <div>
              <Label htmlFor="user-role">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger id="user-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeProjects.length > 0 && (
              <div>
                <Label>Projects</Label>
                <div className="mt-1 space-y-1.5 max-h-40 overflow-y-auto">
                  {activeProjects.map(p => {
                    const selected = form.project_ids.includes(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => toggleFormProject(p.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-sm transition-colors ${
                          selected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center ${
                          selected ? 'bg-blue-600 text-white' : 'border border-gray-300 dark:border-gray-600'
                        }`}>
                          {selected && <Check className="h-3 w-3" />}
                        </div>
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{form.project_ids.length} selected</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                Cancel
              </button>
              <button type="submit" disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProjectsUserId} onOpenChange={(open) => { if (!open) setEditProjectsUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Projects — {editProjectsUser?.name}</DialogTitle>
          </DialogHeader>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4">No projects available.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {activeProjects.map(p => {
                const selected = editProjectIds.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => toggleEditProject(p.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-sm transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center ${
                      selected ? 'bg-blue-600 text-white' : 'border border-gray-300 dark:border-gray-600'
                    }`}>
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="flex-1">{p.name}</span>
                    {p.description && <span className="text-xs text-gray-400 truncate max-w-[150px]">{p.description}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">{editProjectIds.length} selected</span>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditProjectsUserId(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                Cancel
              </button>
              <button type="button" onClick={handleSaveProjects} disabled={savingProjects}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                {savingProjects ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
