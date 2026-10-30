import { daysBetween } from '@/logic/ids';

/**
 * One short tip a day, read aloud on request. Plain words for every reading level.
 * General education only; a doctor or dietitian should review before release.
 */
export type Tip = { e: string; en: string; hi: string };

export const TIPS: Tip[] = [
  { e: '🚶', en: 'A 10-minute walk after a meal lowers the sugar rise from that meal.', hi: 'खाने के बाद 10 मिनट चलने से उस खाने से शुगर कम बढ़ती है।' },
  { e: '🥗', en: 'Eat salad or sabzi first, roti or rice last. Same food, smaller sugar spike.', hi: 'पहले सलाद या सब्ज़ी, आखिर में रोटी या चावल। वही खाना, शुगर कम बढ़ेगी।' },
  { e: '🥒', en: 'Myth: karela juice cures diabetes. Fact: it is a healthy vegetable, but it cannot replace your medicine.', hi: 'मिथक: करेले का जूस डायबिटीज़ ठीक कर देता है। सच: यह अच्छी सब्ज़ी है, पर दवा की जगह नहीं ले सकता।' },
  { e: '💊', en: 'Never stop or change your medicine on your own, even if sugar looks good. Ask your doctor.', hi: 'शुगर ठीक लगे तब भी दवा खुद से बंद या कम मत कीजिए। डॉक्टर से पूछिए।' },
  { e: '🍯', en: 'Myth: jaggery and honey are safe for diabetes. Fact: they raise sugar just like white sugar.', hi: 'मिथक: गुड़ और शहद डायबिटीज़ में सुरक्षित हैं। सच: ये भी चीनी की तरह शुगर बढ़ाते हैं।' },
  { e: '🍬', en: 'Feeling shaky, sweaty or confused? It may be low sugar. Take 3 glucose tablets or half a cup of juice.', hi: 'काँपना, पसीना या घबराहट? शुगर कम हो सकती है। 3 ग्लूकोज़ गोली या आधा कप जूस लीजिए।' },
  { e: '🦶', en: 'Look at your feet every day for cuts or sores. Diabetes can make wounds heal slowly.', hi: 'रोज़ अपने पैर देखिए, कोई कट या छाला तो नहीं। डायबिटीज़ में घाव देर से भरते हैं।' },
  { e: '👁️', en: 'Get your eyes checked once a year. Diabetes can harm the eyes without any pain.', hi: 'साल में एक बार आँखें जँचवाइए। डायबिटीज़ बिना दर्द के आँखों को नुकसान कर सकती है।' },
  { e: '🧪', en: 'Do the HbA1c blood test every 3 months. It shows your average sugar over that time.', hi: 'हर 3 महीने में HbA1c जाँच कराइए। यह 3 महीने की औसत शुगर बताती है।' },
  { e: '🍚', en: 'Swap white rice for brown rice, millets (jowar, bajra, ragi) or more dal and sabzi.', hi: 'सफ़ेद चावल की जगह ब्राउन राइस, ज्वार, बाजरा, रागी या ज़्यादा दाल-सब्ज़ी लीजिए।' },
  { e: '💧', en: 'Drink water instead of cold drinks and packaged juice. One cold drink has about 7 spoons of sugar.', hi: 'कोल्ड ड्रिंक और पैक जूस की जगह पानी पीजिए। एक कोल्ड ड्रिंक में लगभग 7 चम्मच चीनी होती है।' },
  { e: '😴', en: 'Sleep 7 to 8 hours. Poor sleep makes sugar harder to control.', hi: '7 से 8 घंटे सोइए। कम नींद से शुगर संभालना मुश्किल होता है।' },
  { e: '🍎', en: 'Myth: people with diabetes can never eat fruit. Fact: one whole fruit like guava or apple is fine.', hi: 'मिथक: डायबिटीज़ में फल बिल्कुल नहीं खा सकते। सच: अमरूद या सेब जैसा एक पूरा फल ठीक है।' },
  { e: '🧘', en: 'Stress raises sugar. A few minutes of slow breathing or prayer can help.', hi: 'तनाव से शुगर बढ़ती है। कुछ मिनट धीमी साँस या प्रार्थना से मदद मिलती है।' },
];

/** Today's tip, rotating daily; `offset` lets the user see the next one. */
export function tipFor(date: string, offset = 0): Tip {
  const n = TIPS.length;
  const i = (((daysBetween('2026-01-01', date) + offset) % n) + n) % n;
  return TIPS[i];
}
