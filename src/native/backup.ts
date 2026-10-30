import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { decodeBackup, encodeBackup } from '@/logic/backup';
import type { AppState } from '@/types';

/** Writes a backup file and opens the share sheet (WhatsApp to self, Drive, email). */
export async function exportBackup(state: AppState, title: string): Promise<boolean> {
  try {
    const file = new File(Paths.cache, `sugarsaathi-backup-${state.day}.json`);
    file.create({ overwrite: true });
    file.write(encodeBackup(state));
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}

/** Lets the user pick a backup file. 'canceled' when they back out, null when the file is not a backup. */
export async function pickBackup(): Promise<AppState | null | 'canceled'> {
  try {
    const picked = await File.pickFileAsync();
    if (picked.canceled) return 'canceled';
    return decodeBackup(await picked.result.text());
  } catch {
    return null;
  }
}

/** Everything the server holds about this user, as a JSON file to save or share (DPDP data access). */
export async function exportServerData(json: unknown, title: string): Promise<boolean> {
  try {
    const file = new File(Paths.cache, `sugarsaathi-my-data-${new Date().toISOString().slice(0, 10)}.json`);
    file.create({ overwrite: true });
    file.write(JSON.stringify(json, null, 2));
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}
