import { View } from 'react-native';

import { rulesFor } from '@/cloud/catalog';
import { allowed, FOOD_BY_ID } from '@/data/foods';
import { useT } from '@/i18n/useT';
import { say } from '@/native/tts';
import { useDiet } from '@/store/useApp';
import type { SugarCtx } from '@/types';
import { Card, Chip, styles as ui, Txt } from './ui';

/** "What to eat now" for a fresh reading, from the dietitian's food rules. */
export function EatNow({ v, ctx }: { v: number; ctx: SugarCtx }) {
  const { t, lang } = useT();
  const diet = useDiet();
  const rule = rulesFor(v, ctx)[0];
  if (!rule) return null;
  const msg = lang === 'hi' ? rule.messageHi : rule.messageEn;
  const name = (id: string) => (FOOD_BY_ID[id] ? `${FOOD_BY_ID[id].e} ${FOOD_BY_ID[id].n[lang]}` : null);
  // Only suggest foods this person eats (a vegetarian is never told to have an egg).
  const good = rule.recommend.filter((id) => FOOD_BY_ID[id] && allowed(FOOD_BY_ID[id], diet)).map(name).filter(Boolean) as string[];
  const bad = rule.avoid.map(name).filter(Boolean) as string[];
  return (
    <Card>
      <View style={ui.row}>
        <Txt size={18} weight="bold" style={{ flex: 1 }}>
          🍽️ {t('eatNowT')}
        </Txt>
        <Chip label="🔊" onPress={() => say(msg, lang)} />
      </View>
      <Txt size={16} style={{ marginVertical: 6 }}>
        {msg}
      </Txt>
      {good.length ? (
        <Txt size={16} weight="semibold">
          ✅ {good.join(' · ')}
        </Txt>
      ) : null}
      {bad.length ? (
        <Txt size={16} weight="semibold" color="chilli" style={{ marginTop: 4 }}>
          ⛔ {bad.join(' · ')}
        </Txt>
      ) : null}
    </Card>
  );
}
