'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Project, ApiListResponse } from '@/types';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const { data } = useQuery<ApiListResponse<Project>>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeleteError('');
    },
    onError: (err: unknown) => {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setDeleteError(axiosErr.response?.data?.error || 'Failed to delete project');
      } else {
        setDeleteError('Failed to delete project');
      }
    },
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await api.post('/projects', { name, description: description || null });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setName('');
      setDescription('');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (project: Project) => {
    setEditId(project.id);
    setEditName(project.name);
    setEditDesc(project.description ?? '');
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return;
    await api.put(`/projects/${editId}`, { name: editName, description: editDesc || null });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    setEditId(null);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Projects</h1>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Add Project</h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <input type="text" value={name} onChange={e => setName(e.target.value)} required
            placeholder="Project name"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
          <button type="submit" disabled={adding || !name.trim()}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
      </div>

      {deleteError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {deleteError}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {data?.data?.length === 0 && (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">No projects yet</div>
        )}
        {data?.data?.map(project => (
          <div key={project.id} className="flex items-center justify-between px-4 py-3">
            {editId === project.id ? (
              <div className="flex-1 flex items-center gap-2">
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
                <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                  placeholder="Description"
                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
                <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditId(null)} className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{project.name}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      project.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      {project.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{project.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(project)}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setDeleteError(''); deleteMutation.mutate(project.id); }}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
