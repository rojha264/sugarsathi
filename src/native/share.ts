import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

import { waNumber } from '@shared/family';

/** Store link used when patients invite someone or share a video. */
export const APP_LINK = 'https://play.google.com/store/apps/details?id=com.sugarsaathi.app';

/** Opens WhatsApp with the message, addressed to `phone` when given (Indian numbers get +91). */
export async function shareWhatsApp(text: string, phone?: string) {
  const msg = encodeURIComponent(text);
  const to = phone ? waNumber(phone) : '';
  try {
    await Linking.openURL(`whatsapp://send?${to ? `phone=${to}&` : ''}text=${msg}`);
  } catch {
    await Linking.openURL(`https://wa.me/${to}?text=${msg}`);
  }
}


/** Phone call to a family member. */
export function callNumber(phone: string) {
  Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {});
}

export async function sharePdf(html: string, title: string): Promise<boolean> {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}

export function call(number: '108' | '112') {
  Linking.openURL(`tel:${number}`).catch(() => {});
}
