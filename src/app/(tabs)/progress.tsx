import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts';
import { Screen } from '@/components/Screen';
import { Card, H3, Stat, styles as ui, Txt } from '@/components/ui';
import { FOOD_BY_ID } from '@/data/foods';
import { dateFormat } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { addDays } from '@/logic/ids';
import { badges, badgeStats, nextBadge, type BadgeId } from '@/logic/badges';
import { score, streakOf } from '@/logic/score';
import { useReels } from '@/cloud/catalog';
import type { TextKey } from '@/i18n/strings';
import { useApp, useProfile } from '@/store/useApp';
import { useColors } from '@/theme/tokens';

const BADGE_LABEL: Record<BadgeId, TextKey> = {
  starter: 'starter', firstCheck: 'badgeFirstCheck', tenChecks: 'badgeTenChecks', walker: 'badgeWalker', fighter: 'fighter',
  learner: 'badgeLearner', champion: 'champion', star60: 'badgeStar60', legend: 'badgeLegend',
};

function Badge({ icon, label, locked }: { icon: string; label: string; locked?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: locked ? c.track : c.haldiSoft, opacity: locked ? 0.65 : 1 }]} accessibilityState={{ disabled: locked }}>
      <Txt size={32} center>
        {icon}
      </Txt>
      <Txt size={15} weight="bold" center>
        {label}
      </Txt>
    </View>
  );
}

export default function ProgressScreen() {
  const { t, lang } = useT();
  const p = useProfile();
  const mode = useApp((s) => s.mode);
  const today = useApp((s) => s.day);

  const past = p.days.slice(-6);
  const values = [...past.map((d) => d.score), score(p, today)];
  const fmt = dateFormat(lang, { weekday: 'short' });
  const labels = values.map((_, i) => {
    const [y, m, d] = addDays(today, i - (values.length - 1)).split('-').map(Number);
    return fmt.format(new Date(y, m - 1, d));
  });
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const best = Math.max(...values);
  const st = streakOf(p, today);
  const savedReels = useReels((s) => s.saved.length);
  const list = badges(badgeStats(p, st, savedReels));
  const next = nextBadge(list);
  const meals = p.meals.map((m) => m.items.map((i) => `${FOOD_BY_ID[i.id]?.e ?? ''} ${FOOD_BY_ID[i.id]?.n[lang] ?? i.id} ×${i.q}`).join(', '));

  return (
    <Screen title={t('progT')} settings>
      <Card>
        <BarChart values={values} labels={labels} />
      </Card>
      <View style={ui.stats}>
        <Stat value={`🔥 ${st}`} label={t('days')} />
        <Stat value={avg} label={t('avg')} />
        <Stat value={best} label={t('best')} />
      </View>
      <H3>{t('badges')}</H3>
      <View style={styles.badges}>
        {list.map((b) => (
          <Badge key={b.id} icon={b.icon} label={t(BADGE_LABEL[b.id])} locked={!b.earned} />
        ))}
      </View>
      <Txt size={16} color="mute" style={{ marginTop: 8, marginBottom: 12 }}>
        {next ? `🎯 ${t('badgeNext', { badge: t(BADGE_LABEL[next.id]), n: next.left })}` : `🎉 ${t('badgeAll')}`}
      </Txt>
      {mode === 'detailed' ? (
        <Card>
          <H3>{t('todayMeals')}</H3>
          <Txt size={16} color="mute">
            {meals.length ? meals.join('\n') : t('noneYet')}
          </Txt>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { width: '31%', flexGrow: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 4 },
});
