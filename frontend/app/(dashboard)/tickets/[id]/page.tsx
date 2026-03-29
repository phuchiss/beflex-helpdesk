'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { getStoredUser } from '@/lib/auth';
import { StatusBadge, PriorityBadge } from '@/components/tickets/ticket-badge';
import { CommentForm } from '@/components/tickets/comment-form';
import { AttachmentItem } from '@/components/tickets/attachment-item';
import { Markdown } from '@/components/markdown';
import type { Ticket, Comment, User as UserType, Project, ApiListResponse } from '@/types';
import { ArrowLeft, Edit, User, Calendar, Tag, Briefcase, Trash2, Plus, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog } from '@/components/ui/alert-dialog';

const STATUS_OPTIONS = ['open', 'in_progress', 'pending', 'resolved', 'closed'];

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ticketId = params.id as string;

  const { data: ticket, isLoading: ticketLoading } = useQuery<Ticket>({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      const res = await api.get(`/tickets/${ticketId}`);
      return res.data;
    },
  });

  const { data: usersData } = useQuery<ApiListResponse<UserType>>({
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

  const currentUser = typeof window !== 'undefined' ? getStoredUser() : null;
  const canDeleteTicket = currentUser?.role === 'admin' || currentUser?.role === 'agent';
  const canEditTicket = currentUser?.role === 'admin' || currentUser?.id === ticket?.requester_id;

  const [deleteTicketDialogOpen, setDeleteTicketDialogOpen] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const { data: commentsData } = useQuery<{ data: Comment[] }>({
    queryKey: ['comments', ticketId],
    queryFn: async () => {
      const res = await api.get(`/tickets/${ticketId}/comments`);
      return res.data;
    },
    enabled: !!ticketId,
  });

  const { data: participantsData } = useQuery<ApiListResponse<UserType>>({
    queryKey: ['participants', ticketId],
    queryFn: async () => {
      const res = await api.get(`/tickets/${ticketId}/participants`);
      return res.data;
    },
    enabled: !!ticketId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await api.put(`/tickets/${ticketId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    },
  });

  if (ticketLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!ticket) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Ticket not found</div>;
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/tickets')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-gray-400 dark:text-gray-500">#{ticket.ticket_number}</span>
            <StatusBadge value={ticket.status} />
            <PriorityBadge value={ticket.priority} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{ticket.subject}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canEditTicket && (
            <Link
              href={`/tickets/${ticketId}/edit`}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Link>
          )}
          {canDeleteTicket && (
            <button
              onClick={() => setDeleteTicketDialogOpen(true)}
              className="flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {ticket.description && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Description</h2>
              <Markdown content={ticket.description} className="text-gray-700 dark:text-gray-300" />
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Replies ({commentsData?.data?.length ?? 0})
            </h2>
            {commentsData?.data?.map((comment) => (
              <div
                key={comment.id}
                className={`bg-white dark:bg-gray-900 rounded-xl border p-4 ${
                  comment.is_internal
                    ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                {comment.is_internal && (
                  <span className="inline-block mb-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded-full font-medium">
                    Internal Note
                  </span>
                )}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {usersData?.data?.find(u => u.id === comment.author_id)?.name ?? 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(comment.created_at)}</span>
                  </div>
                  {(comment.author_id === currentUser?.id || currentUser?.role === 'admin') && (
                    <button
                      onClick={() => setDeleteCommentId(comment.id)}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors"
                      title="Delete reply"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Markdown content={comment.content} className="text-gray-700 dark:text-gray-300" />
                {comment.attachments?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {comment.attachments.map(att => (
                      <AttachmentItem key={att.id} attachment={att} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <CommentForm
            ticketId={ticketId}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['comments', ticketId] })}
          />
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Status</h3>
            {canEditTicket ? (
              <Select value={ticket.status} onValueChange={(v) => updateStatusMutation.mutate(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>
                      {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <StatusBadge value={ticket.status} />
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <User className="h-4 w-4 flex-shrink-0" />
                <span>
                  Created by:{' '}
                  {ticket.requester_id
                    ? usersData?.data?.find(u => u.id === ticket.requester_id)?.name ?? 'Unknown'
                    : 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <User className="h-4 w-4 flex-shrink-0" />
                <span>
                  Assignee:{' '}
                  {ticket.assignee_id
                    ? usersData?.data?.find(u => u.id === ticket.assignee_id)?.name ?? 'Unknown'
                    : 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>Created: {formatDate(ticket.created_at)}</span>
              </div>
              {ticket.due_date && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span>Due: {formatDate(ticket.due_date)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Tag className="h-4 w-4 flex-shrink-0" />
                <span>Source: {ticket.source}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Briefcase className="h-4 w-4 flex-shrink-0" />
                <span>
                  Project: {ticket.project_id
                    ? projectsData?.data?.find(p => p.id === ticket.project_id)?.name ?? 'Unknown'
                    : 'None'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Involved People</h3>

            <div className="space-y-2">
              {participantsData?.data?.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">No one involved yet</p>
              )}
              {participantsData?.data?.map(participant => (
                <div key={participant.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 text-xs font-medium">
                      {participant.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{participant.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{participant.email}</p>
                    </div>
                  </div>
                  {canDeleteTicket && (
                    <button
                      onClick={async () => {
                        await api.delete(`/tickets/${ticketId}/participants/${participant.id}`);
                        queryClient.invalidateQueries({ queryKey: ['participants', ticketId] });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-all"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canDeleteTicket && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                {addingParticipant ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select user...</option>
                      {usersData?.data
                        ?.filter(u => {
                          const alreadyInvolved = participantsData?.data?.some(p => p.id === u.id);
                          const isRequester = u.id === ticket?.requester_id;
                          return u.is_active && !alreadyInvolved && !isRequester;
                        })
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                    </select>
                    <button
                      onClick={async () => {
                        if (!selectedUserId) return;
                        await api.post(`/tickets/${ticketId}/participants`, { user_id: selectedUserId });
                        queryClient.invalidateQueries({ queryKey: ['participants', ticketId] });
                        setSelectedUserId('');
                        setAddingParticipant(false);
                      }}
                      className="px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingParticipant(false); setSelectedUserId(''); }}
                      className="px-2 py-1.5 text-gray-500 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingParticipant(true)}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add person
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={deleteTicketDialogOpen}
        onOpenChange={setDeleteTicketDialogOpen}
        title="Delete Ticket"
        description="Are you sure you want to delete this ticket? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          await api.delete(`/tickets/${ticketId}`);
          await queryClient.invalidateQueries({ queryKey: ['tickets'] });
          router.push('/tickets');
        }}
      />

      <AlertDialog
        open={!!deleteCommentId}
        onOpenChange={(open) => { if (!open) setDeleteCommentId(null); }}
        title="Delete Reply"
        description="Delete this reply? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (!deleteCommentId) return;
          await api.delete(`/tickets/${ticketId}/comments/${deleteCommentId}`);
          queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
          setDeleteCommentId(null);
        }}
      />
    </div>
  );
}
