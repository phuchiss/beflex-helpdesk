export type UserRole = 'admin' | 'agent' | 'customer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  requester_id: string | null;
  assignee_id: string | null;
  team_id: string | null;
  category_id: string | null;
  project_id: string | null;
  source: string;
  email_message_id: string | null;
  due_date: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketListResponse {
  data: Ticket[];
  total: number;
  page: number;
  per_page: number;
}

export interface Attachment {
  id: string;
  ticket_id: string | null;
  comment_id: string | null;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface EmailAccount {
  id: string;
  name: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_tls: boolean;
  smtp_host: string | null;
  smtp_port: number | null;
  is_active: boolean;
  last_polled_at: string | null;
  created_at: string;
}

export interface DashboardStats {
  stats: {
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  };
  recent_tickets: Ticket[];
}

export interface TicketHistory {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiListResponse<T> {
  data: T[];
}
