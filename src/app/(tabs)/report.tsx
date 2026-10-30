import { router } from 'expo-router';
import { useState } from 'react';

import { Sparkline } from '@/components/charts';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Btn, Card, H3, KV, Legal, Txt } from '@/components/ui';
import { useT } from '@/i18n/useT';
import { EA1C_MIN_READINGS, estimateA1c, reportHtml, shareText, weekly, type ReportLabels } from '@/logic/report';
import { sharePdf, shareWhatsApp } from '@/native/share';
import { useApp, useProfile } from '@/store/useApp';

export default function ReportScreen() {
  const { t } = useT();
  const p = useProfile();
  const today = useApp((s) => s.day);
  const type = useApp((s) => s.setup.type);
  const [busy, setBusy] = useState(false);

  const name = p.name || t('friend');
  const w = weekly(p, today);
  // A month of home readings gives a rough HbA1c; clearly labelled as an estimate.
  const monthReadings = [...p.days.flatMap((d) => d.sugar), ...p.sugar.map((r) => r.v)];
  const a1c = estimateA1c(monthReadings);
  const L: ReportLabels = {
    title: t('repT'), forDoc: t('forDoc'), type: t(type), avgSugar: t('avgSug'), inRange: t('inRange'),
    walkDays: t('walkDays'), medAdh: t('medAdh'), avgScore: t('avgScore'), legal: t('legal'), dash: '–', drinks: t('drinksWk'), treats: t('treatsWk'),
  };

  const pdf = async () => {
    setBusy(true);
    const ok = await sharePdf(reportHtml(name, today, w, L), t('repT'));
    setBusy(false);
    if (!ok) toast(t('pdfFail'));
  };

  return (
    <Screen title={t('repT')} settings>
      <Card>
        <H3>{t('forDoc')}</H3>
        <Txt size={16} color="mute">
          {name} · {t(type)}
        </Txt>
        {w.readings.length > 1 ? <Sparkline values={w.readings} label={t('sugarTrend')} /> : null}
        <KV k={t('avgSug')} v={w.avgSugar === null ? t('noReadings') : `${w.avgSugar} mg/dL`} />
        <KV k={t('inRange')} v={w.inRange === null ? '–' : `${w.inRange}%`} />
        <KV k={t('walkDays')} v={`${w.walkDays} / 7`} />
        <KV k={t('medAdh')} v={w.medPct === null ? '–' : `${w.medPct}%`} />
        <KV k={t('avgScore')} v={String(w.avgScore)} />
        <KV k={t('ea1c')} v={a1c === null ? t('ea1cNeed', { n: EA1C_MIN_READINGS }) : `~${a1c}%`} />
        <KV k={t('treatsWk')} v={String(w.treats)} last={!w.drinks} />
        {w.drinks ? <KV k={t('drinksWk')} v={String(w.drinks)} last /> : null}
      </Card>
      {a1c !== null ? (
        <Txt size={13} color="mute" style={{ marginBottom: 10 }}>
          {t('ea1cNote', { n: monthReadings.length })}
        </Txt>
      ) : null}
      <Btn kind="alt" label={`🩺 ${t('ckT')}`} onPress={() => router.push('/checkups')} style={{ marginBottom: 10 }} />
      <Btn label={`💬 ${t('wa')}`} onPress={() => shareWhatsApp(shareText(name, w, L))} style={{ marginBottom: 10 }} />
      <Btn kind="alt" label={`📄 ${t('pdf')}`} disabled={busy} onPress={pdf} />
      <Legal />
    </Screen>
  );
}
