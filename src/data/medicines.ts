/**
 * Common medicines for diabetes, blood pressure and cholesterol in India, for name autocomplete
 * (English generic name, Hindi spelling, popular brand names). Not advice: only helps typing.
 */
export type MedName = { en: string; hi: string; brands: string[] };

export const MED_NAMES: MedName[] = [
  { en: 'Metformin', hi: 'मेटफ़ॉर्मिन', brands: ['Glycomet', 'Glyciphage', 'Obimet'] },
  { en: 'Glimepiride', hi: 'ग्लिमेपिराइड', brands: ['Amaryl', 'Glimisave', 'Zoryl'] },
  { en: 'Gliclazide', hi: 'ग्लिक्लाज़ाइड', brands: ['Diamicron', 'Glizid', 'Reclide'] },
  { en: 'Glibenclamide', hi: 'ग्लिबेनक्लामाइड', brands: ['Daonil', 'Euglucon'] },
  { en: 'Glipizide', hi: 'ग्लिपिज़ाइड', brands: ['Glynase'] },
  { en: 'Metformin + Glimepiride', hi: 'मेटफ़ॉर्मिन + ग्लिमेपिराइड', brands: ['Glycomet GP', 'Gemer', 'Amaryl M'] },
  { en: 'Sitagliptin', hi: 'सिटाग्लिप्टिन', brands: ['Januvia', 'Istavel', 'Zita'] },
  { en: 'Sitagliptin + Metformin', hi: 'सिटाग्लिप्टिन + मेटफ़ॉर्मिन', brands: ['Janumet', 'Istamet', 'Zita Met'] },
  { en: 'Vildagliptin', hi: 'विल्डाग्लिप्टिन', brands: ['Galvus', 'Jalra'] },
  { en: 'Vildagliptin + Metformin', hi: 'विल्डाग्लिप्टिन + मेटफ़ॉर्मिन', brands: ['Galvus Met', 'Jalra M'] },
  { en: 'Teneligliptin', hi: 'टेनेलिग्लिप्टिन', brands: ['Tenepride', 'Teneza', 'Dynaglipt'] },
  { en: 'Linagliptin', hi: 'लिनाग्लिप्टिन', brands: ['Trajenta'] },
  { en: 'Dapagliflozin', hi: 'डैपाग्लिफ़्लोज़िन', brands: ['Forxiga', 'Oxra', 'Gledepa'] },
  { en: 'Empagliflozin', hi: 'एम्पाग्लिफ़्लोज़िन', brands: ['Jardiance', 'Gibtulio'] },
  { en: 'Pioglitazone', hi: 'पियोग्लिटाज़ोन', brands: ['Pioz', 'Piozed'] },
  { en: 'Voglibose', hi: 'वोग्लिबोस', brands: ['Volix', 'Vobose'] },
  { en: 'Acarbose', hi: 'एकार्बोस', brands: ['Glucobay', 'Rebose'] },
  { en: 'Insulin glargine', hi: 'इंसुलिन ग्लार्जिन', brands: ['Lantus', 'Basalog', 'Glaritus'] },
  { en: 'Insulin (premixed 30/70)', hi: 'इंसुलिन (मिक्स 30/70)', brands: ['Mixtard', 'Huminsulin 30/70', 'Insugen 30/70'] },
  { en: 'Insulin aspart', hi: 'इंसुलिन एस्पार्ट', brands: ['NovoRapid', 'NovoMix'] },
  { en: 'Insulin lispro', hi: 'इंसुलिन लिस्प्रो', brands: ['Humalog'] },
  { en: 'Semaglutide', hi: 'सेमाग्लूटाइड', brands: ['Rybelsus', 'Ozempic'] },
  { en: 'Telmisartan', hi: 'टेल्मिसार्टन', brands: ['Telma', 'Telsartan', 'Telvas'] },
  { en: 'Amlodipine', hi: 'एम्लोडिपिन', brands: ['Amlong', 'Stamlo', 'Amlopres'] },
  { en: 'Losartan', hi: 'लोसार्टन', brands: ['Losar', 'Repace', 'Covance'] },
  { en: 'Olmesartan', hi: 'ओल्मेसार्टन', brands: ['Olmezest', 'Olsar'] },
  { en: 'Metoprolol', hi: 'मेटोप्रोलोल', brands: ['Met XL', 'Metolar'] },
  { en: 'Atorvastatin', hi: 'एटोरवास्टेटिन', brands: ['Atorva', 'Lipitor', 'Storvas'] },
  { en: 'Rosuvastatin', hi: 'रोसुवास्टेटिन', brands: ['Rosuvas', 'Crestor', 'Rozavel'] },
  { en: 'Aspirin', hi: 'एस्पिरिन', brands: ['Ecosprin', 'Disprin'] },
  { en: 'Clopidogrel', hi: 'क्लोपिडोग्रेल', brands: ['Clopilet', 'Plavix'] },
  { en: 'Thyroxine', hi: 'थायरॉक्सिन', brands: ['Thyronorm', 'Eltroxin'] },
  { en: 'Vitamin B12', hi: 'विटामिन बी12', brands: ['Methycobal', 'Nurokind'] },
  { en: 'Vitamin D3', hi: 'विटामिन डी3', brands: ['Uprise D3', 'Calcirol'] },
];

/** The name saved for a picked medicine: Hindi readers get both scripts so the doctor's name still shows. */
export const medLabel = (m: MedName, lang: 'en' | 'hi') => (lang === 'hi' ? `${m.hi} (${m.en})` : m.en);
