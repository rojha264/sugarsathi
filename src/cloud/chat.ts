import { newId } from '@/logic/ids';
import { api } from './client';
import { useCloud, type ChatMsg } from './store';

const KEEP = 200;

type Receipt = { id: string; deliveredAt: string | null; readAt: string | null };
type Thread = { dietitian: { name: string; online: boolean; lastSeen: string | null } | null; messages: ChatMsg[]; receipts?: Receipt[] };

/** Loads the conversation (all of it, or only what is new) and marks the dietitian's messages as read. */
export async function refreshChat(): Promise<boolean> {
  const local = useCloud.getState().chatMessages.filter((m) => !m.pending && !m.failed);
  const after = local.at(-1)?.at;
  try {
    const t = await api<Thread>(`/chat${after ? `?after=${encodeURIComponent(after)}` : ''}`);
    useCloud.setState((s) => {
      const known = new Set(t.messages.map((m) => m.id));
      // Ticks on my older messages change too: the server sends their latest status with each fetch.
      const ticks = new Map((t.receipts ?? []).map((r) => [r.id, r]));
      const old = s.chatMessages.filter((m) => !known.has(m.id)).map((m) => {
        const r = ticks.get(m.id);
        return r ? { ...m, deliveredAt: r.deliveredAt, readAt: r.readAt } : m;
      });
      const merged = after ? [...old, ...t.messages] : [...t.messages, ...s.chatMessages.filter((m) => m.pending || m.failed)];
      const sorted = merged.sort((a, b) => (a.pending || a.failed ? 1 : 0) - (b.pending || b.failed ? 1 : 0) || a.at.localeCompare(b.at));
      return { chatMessages: sorted.slice(-KEEP), chat: { unread: 0, dietitian: t.dietitian } };
    });
    if (t.messages.some((m) => m.fromStaff && !m.readAt)) await api('/chat/read', { json: {} });
    return true;
  } catch {
    return false;
  }
}

/** Full reload, used when the chat screen opens. */
export async function reloadChat() {
  try {
    const t = await api<Thread>('/chat');
    useCloud.setState((s) => ({ chatMessages: [...t.messages, ...s.chatMessages.filter((m) => m.pending || m.failed)].slice(-KEEP), chat: { unread: 0, dietitian: t.dietitian } }));
    if (t.messages.some((m) => m.fromStaff && !m.readAt)) await api('/chat/read', { json: {} });
  } catch {
    // offline: the cached conversation stays on screen
  }
}

/** Shows the message at once, then sends it; on failure it stays with "tap to retry". */
export async function sendChat(text: string, retryId?: string) {
  const id = retryId ?? `local-${newId()}`;
  const local: ChatMsg = { id, text, fromStaff: false, at: new Date().toISOString(), readAt: null, sender: '', pending: true };
  useCloud.setState((s) => ({ chatMessages: [...s.chatMessages.filter((m) => m.id !== id), local] }));
  try {
    const sent = await api<ChatMsg>('/chat', { json: { text } });
    useCloud.setState((s) => ({ chatMessages: s.chatMessages.map((m) => (m.id === id ? sent : m)) }));
  } catch {
    useCloud.setState((s) => ({ chatMessages: s.chatMessages.map((m) => (m.id === id ? { ...m, pending: false, failed: true } : m)) }));
  }
}
