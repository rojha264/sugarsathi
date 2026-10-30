import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../common/prisma.service';

type Message = { title: string; body: string; data?: Record<string, unknown> };

/** Expo push service (works for both Android/FCM and iOS/APNs tokens). */
@Injectable()
export class PushService {
  private readonly log = new Logger('Push');
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Sends to every device of these users; returns how many messages Expo accepted. */
  async toUsers(userIds: string[], msg: Message | ((userId: string) => Message)): Promise<number> {
    if (!userIds.length) return 0;
    const devices = await this.db.device.findMany({ where: { userId: { in: userIds } } });
    const messages = devices.map((d) => {
      const m = typeof msg === 'function' ? msg(d.userId) : msg;
      return { to: d.token, title: m.title, body: m.body, data: m.data ?? {}, sound: 'default', priority: 'high', channelId: 'family' };
    });
    let ok = 0;
    const token = this.config.get<string>('EXPO_ACCESS_TOKEN');
    for (let i = 0; i < messages.length; i += 100) {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(messages.slice(i, i + 100)),
        });
        const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
        for (const [j, t] of (json.data ?? []).entries()) {
          if (t.status === 'ok') ok++;
          // Remove tokens for uninstalled apps.
          else if (t.details?.error === 'DeviceNotRegistered') await this.db.device.deleteMany({ where: { token: messages[i + j].to } });
        }
      } catch (e) {
        this.log.warn(`push failed: ${String(e)}`);
      }
    }
    return ok;
  }
}
