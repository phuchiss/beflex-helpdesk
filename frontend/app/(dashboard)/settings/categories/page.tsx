'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Category, ApiListResponse } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6B7280');
  const [adding, setAdding] = useState(false);

  const { data } = useQuery<ApiListResponse<Category>>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/categories/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/categories', { name, color });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setName('');
      setColor('#6B7280');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Categories</h1>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Add Category</h2>
        <form onSubmit={handleAdd} className="flex items-end gap-3">
          <div className="flex-1">
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Category name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
          </div>
          <div>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="h-10 w-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer" />
          </div>
          <button type="submit" disabled={adding}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {data?.data?.length === 0 && (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">No categories yet</div>
        )}
        {data?.data?.map(cat => (
          <div key={cat.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{cat.name}</span>
            </div>
            <button onClick={() => deleteMutation.mutate(cat.id)}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
