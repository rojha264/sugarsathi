import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/** "Online now", "Last seen 5 minutes ago" or "Not seen yet". */
export const presenceText = (online: boolean, lastSeen: string | null) => (online ? 'Online now' : lastSeen ? `Last seen ${dayjs(lastSeen).fromNow()}` : 'Not seen yet');
