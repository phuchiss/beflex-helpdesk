'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getStoredUser, setStoredUser } from '@/lib/auth';
import type { User, Project, ApiListResponse } from '@/types';
import { Check, X } from 'lucide-react';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [projectMsg, setProjectMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [savingProjects, setSavingProjects] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const { data: allProjectsData } = useQuery<ApiListResponse<Project>>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
  });

  const { data: userProjectsData } = useQuery<ApiListResponse<Project>>({
    queryKey: ['user-projects', userId],
    queryFn: async () => {
      const res = await api.get(`/users/${userId}/projects`);
      return res.data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    const user = getStoredUser() as User | null;
    if (user) {
      setName(user.name);
      setUserId(user.id);
    }
  }, []);

  useEffect(() => {
    if (userProjectsData?.data) {
      setSelectedProjectIds(userProjectsData.data.map(p => p.id));
    }
  }, [userProjectsData]);

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProfileMsg('');
    try {
      const user = getStoredUser() as User | null;
      if (!user) return;
      const res = await api.put(`/users/${user.id}`, { name });
      setStoredUser(res.data);
      setProfileMsg('Profile updated successfully');
    } catch {
      setProfileMsg('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleProjectsSave = async () => {
    if (!userId) return;
    setSavingProjects(true);
    setProjectMsg('');
    try {
      await api.put(`/users/${userId}/projects`, {
        project_ids: selectedProjectIds,
      });
      await queryClient.invalidateQueries({ queryKey: ['user-projects', userId] });
      setProjectMsg('Projects updated successfully');
    } catch {
      setProjectMsg('Failed to update projects');
    } finally {
      setSavingProjects(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPw(true);
    setPasswordMsg('');
    try {
      await api.put('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordMsg('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      setPasswordMsg('Failed to change password. Check your current password.');
    } finally {
      setChangingPw(false);
    }
  };

  const activeProjects = allProjectsData?.data?.filter(p => p.is_active) ?? [];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Profile Settings</h1>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Personal Information</h2>
        {profileMsg && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${profileMsg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {profileMsg}
          </div>
        )}
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">My Projects</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select projects you are working on. These will be shown when creating or editing tickets.</p>
        {projectMsg && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${projectMsg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {projectMsg}
          </div>
        )}
        {activeProjects.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No projects available.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {activeProjects.map(project => {
              const isSelected = selectedProjectIds.includes(project.id);
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => toggleProject(project.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center ${
                    isSelected ? 'bg-blue-600 text-white' : 'border border-gray-300 dark:border-gray-600'
                  }`}>
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{project.name}</span>
                    {project.description && (
                      <span className="ml-2 text-gray-400 dark:text-gray-500 truncate">{project.description}</span>
                    )}
                  </div>
                  {isSelected && (
                    <X className="h-4 w-4 flex-shrink-0 text-gray-400 hover:text-red-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleProjectsSave}
            disabled={savingProjects || activeProjects.length === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            {savingProjects ? 'Saving...' : 'Save Projects'}
          </button>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {selectedProjectIds.length} project{selectedProjectIds.length !== 1 ? 's' : ''} selected
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Change Password</h2>
        {passwordMsg && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${passwordMsg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {passwordMsg}
          </div>
        )}
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
          </div>
          <button type="submit" disabled={changingPw}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
            {changingPw ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
