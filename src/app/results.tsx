import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, View } from 'react-native';

import { fetchProgram, sendInterest } from '@/cloud/program';
import { useCloud, type ProgramResult } from '@/cloud/store';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, H3, Legal, styles as ui, Txt } from '@/components/ui';
import type { TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { say } from '@/native/tts';
import { useColors } from '@/theme/tokens';
import { APP_LINK } from '@/native/share';

type Row = { key: TextKey; before: number | null; after: number | null; unit: string; lowerIsBetter: boolean };

const rowsOf = (r: ProgramResult): Row[] => [
  { key: 'resFasting', before: r.fastingBefore, after: r.fastingAfter, unit: 'mg/dL', lowerIsBetter: true },
  { key: 'resAfterMeal', before: r.afterMealBefore, after: r.afterMealAfter, unit: 'mg/dL', lowerIsBetter: true },
  { key: 'resInRange', before: r.inRangeBefore, after: r.inRangeAfter, unit: '%', lowerIsBetter: false },
  { key: 'resWeight', before: r.weightBefore, after: r.weightAfter, unit: 'kg', lowerIsBetter: true },
];

/** Day 14: before (days 1–3) vs after (days 12–14), said honestly, then the offer to continue with the dietitian. */
export default function ResultsScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const detail = useCloud((s) => s.programDetail);
  const dietitian = useCloud((s) => s.dietitian);
  const [sending, setSending] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!!detail);
  useEffect(() => {
    fetchProgram().finally(() => setLoaded(true));
  }, []);
  const r = detail?.result ?? null;
  const rows = r ? rowsOf(r).filter((x) => x.before !== null || x.after !== null) : [];
  const headline = r ? (r.improved ? t('resImproved') : t('resThanks')) : t('resNotYet');
  const summary = r
    ? [headline, ...rows.filter((x) => x.before !== null && x.after !== null).map((x) => `${t(x.key)}: ${x.before} → ${x.after} ${x.unit}`), t('resDays', { n: r.daysFollowed })].join('\n')
    : '';

  if (!loaded && !detail) {
    return (
      <Screen title={t('resT')} back>
        <ActivityIndicator size="large" color={c.leaf} style={{ marginTop: 40 }} accessibilityLabel={t('loading')} />
      </Screen>
    );
  }

  return (
    <Screen title={t('resT')} back>
      <Card style={{ borderColor: r?.improved ? c.leaf : c.line, borderWidth: 2 }}>
        <Txt size={40} center>{r?.improved ? '🎉' : '🌱'}</Txt>
        <H3>{headline}</H3>
        {r ? (
          <Txt size={16} color="mute">
            {r.improved ? t('resImprovedSub') : t('resThanksSub')}
          </Txt>
        ) : null}
      </Card>

      {r ? (
        <Card>
          {rows.map((x) => {
            const better = x.before !== null && x.after !== null && (x.lowerIsBetter ? x.after < x.before : x.after > x.before);
            const worse = x.before !== null && x.after !== null && (x.lowerIsBetter ? x.after > x.before : x.after < x.before);
            return (
              <View key={x.key} style={[ui.row, { paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }]}>
                <Txt size={17} weight="semibold" style={{ flex: 1 }}>
                  {t(x.key)}
                </Txt>
                <Txt size={17}>
                  {x.before ?? '–'} → <Txt size={17} weight="bold" color={better ? 'leaf' : worse ? 'chilli' : 'ink'}>{x.after ?? '–'}</Txt> {x.unit}
                </Txt>
              </View>
            );
          })}
          <Txt size={16} weight="semibold" style={{ marginTop: 10 }}>
            ✅ {t('resDays', { n: r.daysFollowed })}
          </Txt>
          <Txt size={14} color="mute" style={{ marginTop: 8 }}>
            🧪 {t('resA1cNote')}
          </Txt>
          <View style={[ui.row, { marginTop: 10, gap: 8 }]}>
            <Btn small kind="alt" label={`🔊 ${t('listenToday')}`} onPress={() => say(summary, lang)} style={{ flex: 1 }} />
            <Btn small kind="alt" label={`📤 ${t('resShare')}`} onPress={() => Share.share({ message: `${t('app')} · ${t('resT')}\n${summary}\n\n${t('inviteMsg', { link: APP_LINK })}` }).catch(() => {})} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}

      {detail?.offer?.length ? (
        <>
          <H3>💚 {dietitian ? t('offerWith', { n: dietitian }) : t('offerT')}</H3>
          <Txt size={16} color="mute" style={{ marginBottom: 8 }}>
            {t('offerSub')}
          </Txt>
          {detail.offer.map((o) => (
            <Card key={o.id}>
              <View style={ui.row}>
                <Txt size={19} weight="bold" style={{ flex: 1 }}>
                  {(lang === 'hi' && o.nameHi) || o.name}
                </Txt>
                <Txt size={19} weight="bold" color="leaf">
                  ₹{o.priceInr}
                  <Txt size={14} color="mute"> / {o.months > 1 ? t('offerMonths', { n: o.months }) : t('offerMonth')}</Txt>
                </Txt>
              </View>
              {(lang === 'hi' && o.featuresHi?.length ? o.featuresHi : o.features).map((f) => (
                <Txt key={f} size={15}>
                  ✓ {f}
                </Txt>
              ))}
              <Btn
                label={t('offerCta')}
                disabled={sending !== null}
                onPress={async () => {
                  setSending(o.id);
                  try {
                    await sendInterest(o.id);
                    toast(t('offerSent'));
                    router.push('/chat');
                  } catch {
                    toast(t('offerFail'));
                  } finally {
                    setSending(null);
                  }
                }}
                style={{ marginTop: 10 }}
              />
            </Card>
          ))}
          <Banner tone="green">
            <Txt size={15}>💬 {t('offerChat')}</Txt>
          </Banner>
        </>
      ) : null}
      <Legal />
    </Screen>
  );
}
