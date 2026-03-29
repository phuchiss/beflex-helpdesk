'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { EmailAccount, ApiListResponse } from '@/types';
import { formatDate } from '@/lib/utils';
import { Plus, Trash2, Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EmailAccountForm {
  name: string;
  email: string;
  imap_host: string;
  imap_port: string;
  imap_username: string;
  imap_password: string;
  imap_tls: boolean;
}

const defaultForm: EmailAccountForm = {
  name: '', email: '', imap_host: '', imap_port: '993',
  imap_username: '', imap_password: '', imap_tls: true,
};

export default function EmailAccountsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<EmailAccountForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery<ApiListResponse<EmailAccount>>({
    queryKey: ['email-accounts'],
    queryFn: async () => {
      const res = await api.get('/email-accounts');
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/email-accounts/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-accounts'] }),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/email-accounts', {
        ...form,
        imap_port: parseInt(form.imap_port),
      });
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setShowModal(false);
      setForm(defaultForm);
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email Accounts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure IMAP accounts to auto-create tickets from emails</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.data?.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
              <Mail className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No email accounts configured</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add an IMAP account to start receiving tickets via email</p>
            </div>
          )}
          {data?.data?.map((account) => (
            <div key={account.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{account.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      account.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{account.email}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {account.imap_host}:{account.imap_port} • {account.imap_tls ? 'TLS' : 'No TLS'}
                  </p>
                  {account.last_polled_at && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Last polled: {formatDate(account.last_polled_at)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => deleteMutation.mutate(account.id)}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) setForm(defaultForm); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Email Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label htmlFor="acct-name">Account Name</Label>
              <input id="acct-name" type="text" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Support Inbox" />
            </div>
            <div>
              <Label htmlFor="acct-email">Email Address</Label>
              <input id="acct-email" type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="support@company.com" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label htmlFor="acct-host">IMAP Host</Label>
                <input id="acct-host" type="text" required value={form.imap_host}
                  onChange={e => setForm(f => ({ ...f, imap_host: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  placeholder="imap.gmail.com" />
              </div>
              <div>
                <Label htmlFor="acct-port">Port</Label>
                <input id="acct-port" type="number" required value={form.imap_port}
                  onChange={e => setForm(f => ({ ...f, imap_port: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
              </div>
            </div>
            <div>
              <Label htmlFor="acct-username">Username</Label>
              <input id="acct-username" type="text" required value={form.imap_username}
                onChange={e => setForm(f => ({ ...f, imap_username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="support@company.com" />
            </div>
            <div>
              <Label htmlFor="acct-password">Password / App Password</Label>
              <input id="acct-password" type="password" required value={form.imap_password}
                onChange={e => setForm(f => ({ ...f, imap_password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="tls"
                checked={form.imap_tls}
                onCheckedChange={(checked) => setForm(f => ({ ...f, imap_tls: checked }))}
              />
              <Label htmlFor="tls">Use TLS/SSL</Label>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                {submitting ? 'Adding...' : 'Add Account'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
