import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { bmi, bpBand } from '@shared/presence';
import { sugarStatus } from '@shared/sugar';
import { dateFormat, type TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { a1cDue, bmiBand, lastSugar, weightStatus } from '@/logic/numbers';
import { useApp, useDiabetesType, useProfile } from '@/store/useApp';
import { useColors, type Colors } from '@/theme/tokens';
import type { Vital } from '@/types';
import { Card, Txt } from './ui';

type Tile = { icon: string; label: string; value: string | null; sub: string; tone?: keyof Colors; route: Href; a11y: string };

const BMI_KEY = { under: 'bmiUnder', normal: 'bmiNormal', over: 'bmiOver', obese: 'bmiObese' } as const satisfies Record<string, TextKey>;

/**
 * "My numbers": the readings that matter at a glance (sugar, weight, BP, HbA1c), each one tap to
 * record. Age, height and BMI sit on top as context, editable from Health details.
 */
export function VitalsCard() {
  const { t, lang } = useT();
  const c = useColors();
  const p = useProfile();
  const diabetesType = useDiabetesType();
  const setup = useApp((s) => s.setup);
  const isMe = useApp((s) => s.cur === 'me');
  const today = useApp((s) => s.day);
  const vitals = p.vitals ?? [];
  const w = [...vitals].reverse().find((v): v is Extract<Vital, { kind: 'weight' }> => v.kind === 'weight');
  const wPrev = [...vitals].reverse().filter((v): v is Extract<Vital, { kind: 'weight' }> => v.kind === 'weight')[1];
  const bp = [...vitals].reverse().find((v): v is Extract<Vital, { kind: 'bp' }> => v.kind === 'bp');
  const sugar = lastSugar(p, today);
  const a1c = p.checkupValues?.a1c;
  const a1cDate = p.checkups.a1c;
  const short = dateFormat(lang, { day: 'numeric', month: 'short' });
  const month = dateFormat(lang, { month: 'short', year: 'numeric' });

  const level = sugar ? sugarStatus(sugar.v, sugar.ctx ?? 'random', { type: diabetesType }).l : null;
  // Weight is judged against height (healthy range), only for the main user whose height we know.
  const ws = isMe && w ? weightStatus(w.weightKg, setup.heightCm, { age: setup.birthYear ? new Date().getFullYear() - setup.birthYear : null, pregnant: setup.flags?.includes('pregnant') }) : null;
  const band = bp ? bpBand(bp.sys, bp.dia) : null;
  const diff = w && wPrev ? Math.round((w.weightKg - wPrev.weightKg) * 10) / 10 : null;
  const sugarWhen = sugar ? (sugar.day === 'today' ? t('today') : sugar.day === 'yesterday' ? t('dayYesterday') : short.format(new Date(`${sugar.day}T12:00:00`))) : '';

  const tiles: Tile[] = [
    {
      icon: '🩸', label: t('numSugar'), route: '/sugar',
      value: sugar ? `${sugar.v}` : null,
      sub: sugar ? `${sugar.ctx ? `${t(sugar.ctx)} · ` : ''}${sugarWhen}` : t('numSugarAdd'),
      tone: level === 'r' ? 'chilli' : level === 'a' ? 'haldi' : level === 'g' ? 'leaf' : undefined,
      a11y: sugar ? `${t('numSugar')} ${sugar.v}, ${sugarWhen}` : t('numSugarAdd'),
    },
    {
      icon: '⚖️', label: t('weightQ'), route: '/vitals',
      value: w ? `${w.weightKg} kg` : null,
      sub: ws
        ? ws.offBy > 0 ? t('wAbove', { n: ws.offBy }) : ws.offBy < 0 ? t('wBelow', { n: -ws.offBy }) : `✓ ${t('wInRange')}`
        : diff === null ? (w ? short.format(new Date(w.createdAt)) : t('numAdd')) : diff === 0 ? t('numSame') : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)} kg`,
      // Amber, never red: weight is a long journey, not an alarm.
      tone: ws ? (ws.offBy === 0 ? 'leaf' : 'haldi') : undefined,
      a11y: w ? `${t('weightQ')} ${w.weightKg} kg${ws ? `. ${t('wHealthy', { min: ws.min, max: ws.max })}` : ''}` : t('numAdd'),
    },
    {
      icon: '❤️', label: t('numBp'), route: '/vitals',
      value: bp ? `${bp.sys}/${bp.dia}` : null,
      sub: bp ? short.format(new Date(bp.createdAt)) : t('numAdd'),
      tone: band === 'crisis' || band === 'high2' ? 'chilli' : band === 'high1' || band === 'elevated' ? 'haldi' : band === 'normal' ? 'leaf' : undefined,
      a11y: bp ? `${t('numBp')} ${bp.sys} ${t('bpOver')} ${bp.dia}` : t('numAdd'),
    },
    {
      icon: '🧪', label: 'HbA1c', route: '/checkups',
      value: a1c ? `${a1c}%` : null,
      sub: a1c && a1cDate && !a1cDue(a1cDate, today) ? month.format(new Date(`${a1cDate}T12:00:00`)) : t(a1c ? 'numA1cDue' : 'numAdd'),
      tone: a1c ? (a1c >= 9 ? 'chilli' : a1c >= 7 ? 'haldi' : 'leaf') : undefined,
      a11y: a1c ? `HbA1c ${a1c} ${t('percent')}` : t('numAdd'),
    },
  ];

  // Context line for the main user only (family members' details live on the Family tab).
  const age = isMe && setup.birthYear ? new Date().getFullYear() - setup.birthYear : null;
  const b = isMe && w ? bmi(w.weightKg, setup.heightCm) : null;
  const context = [age ? `${age} ${t('years')}` : null, isMe && setup.heightCm ? `${setup.heightCm} cm` : null, b ? `BMI ${b} (${t(BMI_KEY[bmiBand(b)])})` : null].filter(Boolean).join(' · ');

  return (
    <Card>
      <View style={styles.head}>
        <Txt size={18} weight="bold" style={{ flex: 1 }}>
          📊 {t('numT')}
        </Txt>
        {isMe ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('healthEdit')} onPress={() => router.push('/health')} hitSlop={10}>
            <Txt size={15} weight="bold" color="leaf">
              ✏️ {context ? '' : t('numAddAge')}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {context ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/health')}>
          <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
            {context}
          </Txt>
        </Pressable>
      ) : null}
      <View style={styles.grid}>
        {tiles.map((x) => (
          <Pressable
            key={x.label}
            accessibilityRole="button"
            accessibilityLabel={`${x.a11y}. ${t('numTapAdd')}`}
            onPress={() => router.push(x.route)}
            style={({ pressed }) => [styles.tile, { backgroundColor: x.tone ? c[`${x.tone}Soft` as keyof Colors] : c.bg, borderColor: x.tone ? c[x.tone] : c.line, opacity: pressed ? 0.85 : 1 }]}>
            <View style={styles.tileTop}>
              <Txt size={15} weight="semibold" color="mute">
                {x.icon} {x.label}
              </Txt>
              <View style={[styles.plus, { backgroundColor: c.leaf }]}>
                <Txt size={18} weight="bold" style={{ color: c.onLeaf, lineHeight: 22 }}>
                  ＋
                </Txt>
              </View>
            </View>
            <Txt size={x.value ? 24 : 17} weight="bold" color={x.value ? x.tone ?? 'ink' : 'leaf'}>
              {x.value ?? t('numAddShort')}
            </Txt>
            <Txt size={13} color="mute" numberOfLines={1}>
              {x.sub}
            </Txt>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 104, borderWidth: 1.5, borderRadius: 16, padding: 10, gap: 2 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plus: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
