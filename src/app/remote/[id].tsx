import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ALERT_KINDS, DIGEST_AT, type AlertKind } from '@shared/family';
import { loadRemote, refreshFollowing, savePrefs, sendMessage, unfollow } from '@/cloud/link';
import { useCloud } from '@/cloud/store';
import { CareHero } from '@/components/CareHero';
import { Screen } from '@/components/Screen';
import { toast } from '@/components/Toast';
import { Banner, Btn, Card, H3, Legal, styles as ui, Txt } from '@/components/ui';
import { dateFormat, type TextKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { timeline, todayOf, weekScores, type DoseView, type TimelineItem } from '@/logic/careView';
import { dayDate, localDate } from '@/logic/ids';
import { sugarStatus } from '@/logic/sugar';
import { callNumber } from '@/native/share';
import { useColors, type Colors } from '@/theme/tokens';
import type { MealSlot } from '@/types';

const SLOT_KEY: Record<MealSlot, TextKey> = { breakfast: 'bf', lunch: 'ln', dinner: 'dn', snack: 'sn' };
const KIND_KEY: Record<AlertKind, TextKey> = {
  sugar_alert: 'akSugar', unwell_alert: 'akUnwell', sos_alert: 'akSos', missed_medicine: 'akMed', no_checkin: 'akCheckin', daily_digest: 'akDigest',
};
const DOSE: Record<DoseView, { icon: string; key: TextKey; color: keyof Colors }> = {
  taken: { icon: '✅', key: 'taken', color: 'leaf' },
  skipped: { icon: '❌', key: 'skipped', color: 'chilli' },
  late: { icon: '⚠️', key: 'doseLate', color: 'chilli' },
  due: { icon: '⏳', key: 'doseWait', color: 'mute' },
};

/** Approval status first, so a just-approved follower sees the data straight away. */
const load = (id: string) =>
  refreshFollowing()
    .then(() => loadRemote(id))
    .catch(() => null);

function ActionButton({ icon, label, onPress, primary }: { icon: string; label: string; onPress(): void; primary?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: primary ? c.leaf : c.card, borderColor: primary ? c.leaf : c.line, opacity: pressed ? 0.85 : 1 }]}>
      <Txt size={30} style={{ lineHeight: 36 }}>
        {icon}
      </Txt>
      <Txt size={15} weight="bold" center style={primary ? { color: c.onLeaf } : undefined}>
        {label}
      </Txt>
    </Pressable>
  );
}

function Tile({ icon, title, value, sub, bg, alert }: { icon: string; title: string; value: string; sub?: string; bg: keyof Colors; alert?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: c[bg], borderColor: alert ? c.chilli : 'transparent' }]}>
      <Txt size={15} weight="bold" color="mute">
        {icon} {title}
      </Txt>
      <Txt size={26} weight="heavy" style={alert ? { color: c.chilli } : undefined}>
        {value}
      </Txt>
      {sub ? (
        <Txt size={14} color="mute" numberOfLines={1}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

/** Caregiver view of one elder's day: verdict first, then the day in order, then the week. */
export default function RemoteScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const follow = useCloud((s) => s.following.find((f) => f.patientId === id));
  const data = useCloud((s) => s.remote[id] ?? null);
  const [tab, setTab] = useState<'today' | 'week'>('today');
  const [now, setNow] = useState(() => Date.now());
  const [showAlerts, setShowAlerts] = useState(false);

  const reload = useCallback(() => {
    load(id).then(() => setNow(Date.now()));
  }, [id]);

  // Live enough for a caregiver: refresh every 20 seconds while the screen is open.
  useEffect(() => {
    load(id).then(() => setNow(Date.now()));
    const t = setInterval(reload, 20_000);
    return () => clearInterval(t);
  }, [id, reload]);

  const name = data?.name || follow?.name || t('family');

  if (!follow || follow.status !== 'active') {
    const gone = !follow || follow.status === 'gone';
    return (
      <Screen title={name} back>
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
          <Txt size={64}>{gone ? '🚫' : '⏳'}</Txt>
          <Txt size={20} weight="bold" center>
            {gone ? t('remoteGone') : t('remoteWait', { n: name })}
          </Txt>
          {gone ? null : (
            <Txt color="mute" center>
              {t('remoteWaitSub')}
            </Txt>
          )}
        </View>
        {gone ? (
          <Btn kind="alt" label={t('unfollow')} onPress={() => unfollow(id).then(() => router.back())} />
        ) : (
          <Btn kind="alt" label={`🔄 ${t('shareRefresh')}`} onPress={reload} />
        )}
      </Screen>
    );
  }

  const today = localDate(new Date(now));
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const snap = data?.snap ?? null;
  const day = todayOf(snap, today);
  const st = data?.state ?? null;
  const time = dateFormat(lang, { hour: 'numeric', minute: '2-digit' });
  const fmt = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return time.format(d);
  };
  const meals = day ? new Set(day.meals.filter((m) => m.slot !== 'snack').map((m) => m.slot)).size : 0;
  const taken = day?.doses.filter((d) => d.s === 'taken').length ?? 0;
  const lastSugar = day?.sugar.at(-1);
  const items = timeline(snap, data?.events ?? [], today, nowMin);
  const week = weekScores(snap, st, today);

  const message = async (kind: 'cheer' | 'remind') => {
    try {
      await sendMessage(id, kind);
      toast(t(kind === 'cheer' ? 'cheerSent' : 'remindSent', { n: name }));
    } catch {
      toast(t('netFail'));
    }
  };
  const toggle = (k: AlertKind, on: boolean) =>
    savePrefs({ ...follow, prefs: { ...follow.prefs, lang, off: on ? follow.prefs.off.filter((x) => x !== k) : [...follow.prefs.off, k] } }).catch(() => toast(t('netFail')));

  const row = (it: TimelineItem, i: number) => {
    let icon = '';
    let title = '';
    let sub = '';
    let right: { text: string; color: keyof Colors } | null = null;
    if (it.type === 'dose') {
      const d = DOSE[it.view];
      icon = '💊';
      title = it.name;
      right = { text: `${d.icon} ${t(d.key)}`, color: d.color };
    } else if (it.type === 'meal') {
      icon = it.kind === 'treat' ? '🎉' : it.kind === 'drink' ? '🍺' : '🍽️';
      title = t(SLOT_KEY[it.slot]);
      sub = `${it.foods.map((f) => `${f.e} ${f[lang]}${f.q !== 1 ? ` ×${f.q}` : ''}`).join(', ')} · ~${it.c} g ${t('carbs')}`;
    } else if (it.type === 'sugar') {
      icon = '🩸';
      title = `${t('sug')} ${it.v} mg/dL`;
      sub = t(it.ctx);
      right = { text: t(it.level === 'g' ? 'tlOk' : it.level === 'a' ? 'tlHigh' : 'tlDanger'), color: it.level === 'g' ? 'leaf' : it.level === 'a' ? 'haldi' : 'chilli' };
    } else {
      icon = it.kind === 'sos' ? '🚨' : '😟';
      title = t(it.kind === 'sos' ? 'evSos' : 'evUnwell');
      right = { text: '!', color: 'chilli' };
    }
    return (
      <View key={i} style={[styles.tl, i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.line }]}>
        <Txt size={15} weight="bold" color="mute" style={styles.tlTime}>
          {fmt(it.time)}
        </Txt>
        <View style={[styles.tlIcon, { backgroundColor: c.bg }]}>
          <Txt size={22}>{icon}</Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="bold">{title}</Txt>
          {sub ? (
            <Txt size={15} color="mute">
              {sub}
            </Txt>
          ) : null}
        </View>
        {right ? (
          <Txt size={15} weight="bold" color={right.color}>
            {right.text}
          </Txt>
        ) : null}
      </View>
    );
  };

  return (
    <Screen title={name} back>
      <CareHero name={name} data={data} now={now} />

      <View style={styles.actions}>
        {data?.phone ? <ActionButton primary icon="📞" label={t('callShort')} onPress={() => callNumber(data.phone)} /> : null}
        <ActionButton icon="💛" label={t('cheer')} onPress={() => message('cheer')} />
        <ActionButton icon="💊" label={t('remindMed')} onPress={() => message('remind')} />
      </View>

      <View style={[styles.seg, { backgroundColor: c.track }]}>
        {(['today', 'week'] as const).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === k }}
            onPress={() => setTab(k)}
            style={[styles.segBtn, tab === k && { backgroundColor: c.card }]}>
            <Txt weight="bold" color={tab === k ? 'ink' : 'mute'}>
              {k === 'today' ? `📋 ${t('tabToday')}` : `📅 ${t('remoteWeek')}`}
            </Txt>
          </Pressable>
        ))}
      </View>

      {tab === 'today' ? (
        day ? (
          <>
            <View style={styles.grid}>
              <Tile icon="🍽️" title={t('eat')} value={`${meals} / 3`} sub={t('mealsWord')} bg="haldiSoft" />
              <Tile icon="💊" title={t('med')} value={`${taken} / ${day.doses.length}`} sub={t('dosesTaken')} bg="leafSoft" alert={items.some((x) => x.type === 'dose' && x.view === 'late')} />
              <Tile icon="🚶" title={t('walk')} value={`${day.walkMin} ${t('min')}`} sub={`${day.steps} ${t('stepsShort')}`} bg="skySoft" />
              <Tile
                icon="🩸"
                title={t('sug')}
                value={lastSugar ? String(lastSugar.v) : '–'}
                sub={lastSugar ? t(lastSugar.ctx) : t('remoteNoSugar')}
                bg="plumSoft"
                alert={!!lastSugar && sugarStatus(lastSugar.v, lastSugar.ctx).l !== 'g'}
              />
            </View>
            <Card style={ui.row}>
              <Txt size={18} weight="bold" style={{ flex: 1 }}>
                💧 {t('waterOf', { n: day.water })}
              </Txt>
              <Txt size={18}>{'🥛'.repeat(Math.min(day.water, 8))}</Txt>
            </Card>
            <Card>
              <H3>🕒 {t('herDay')}</H3>
              {items.length ? items.map(row) : <Txt color="mute">{t('remoteNoFood')}</Txt>}
            </Card>
          </>
        ) : (
          <Banner tone="amber">
            <Txt size={17} weight="semibold">
              {t('remoteNoToday', { n: name })}
            </Txt>
          </Banner>
        )
      ) : (
        <Card>
          <H3>📅 {t('remoteWeek')}</H3>
          <View style={styles.bars}>
            {week.map((d) => {
              const col = d.score >= 60 ? c.leaf : d.score >= 40 ? c.haldi : c.chilli;
              return (
                <View key={d.date} style={styles.barCol}>
                  <Txt size={14} weight="bold">
                    {d.score}
                  </Txt>
                  <View style={[styles.barTrack, { backgroundColor: c.track }]}>
                    <View style={{ height: `${Math.max(4, d.score)}%`, backgroundColor: col, borderRadius: 8 }} />
                  </View>
                  <Txt size={13} color="mute">
                    {dateFormat(lang, { weekday: 'short' }).format(dayDate(d.date))}
                  </Txt>
                </View>
              );
            })}
          </View>
          {(st?.week ?? []).slice().reverse().map((d) => (
            <View key={d.date} style={[styles.weekRow, { borderTopColor: c.line }]}>
              <Txt weight="bold" style={{ width: 90 }}>
                {dateFormat(lang, { weekday: 'short', day: 'numeric' }).format(dayDate(d.date))}
              </Txt>
              <Txt size={15} style={{ flex: 1 }}>
                💊 {d.medTaken}/{d.medTotal} · 🚶 {d.walkMin} {t('min')}
                {d.sugar.length ? ` · 🩸 ${d.sugar.join(', ')}` : ''}
              </Txt>
            </View>
          ))}
          <Txt size={14} color="mute" style={{ marginTop: 8 }}>
            {t('weekNote')}
          </Txt>
        </Card>
      )}

      <Card>
        <Pressable accessibilityRole="button" onPress={() => setShowAlerts((s) => !s)} style={ui.row}>
          <Txt size={18} weight="bold" style={{ flex: 1 }}>
            🔔 {t('alertSet')}
          </Txt>
          <Txt size={20}>{showAlerts ? '▾' : '▸'}</Txt>
        </Pressable>
        {showAlerts
          ? ALERT_KINDS.map((k) => {
              const on = !follow.prefs.off.includes(k);
              return (
                <View key={k} style={[styles.alertRow, { borderTopColor: c.line }]}>
                  <Txt style={{ flex: 1 }}>{t(KIND_KEY[k], { t: DIGEST_AT })}</Txt>
                  <Switch accessibilityLabel={t(KIND_KEY[k], { t: DIGEST_AT })} value={on} onValueChange={(v) => toggle(k, v)} trackColor={{ true: c.leaf, false: c.track }} />
                </View>
              );
            })
          : null}
      </Card>

      <Btn kind="alt" small label={`🔄 ${t('shareRefresh')}`} onPress={reload} style={{ marginBottom: 10 }} />
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          Alert.alert(t('unfollowQ', { n: name }), undefined, [
            { text: t('cancel'), style: 'cancel' },
            { text: t('unfollow'), style: 'destructive', onPress: () => unfollow(id).then(() => router.back()) },
          ])
        }
        style={{ paddingVertical: 10 }}>
        <Txt size={15} color="mute" center>
          {t('unfollow')}
        </Txt>
      </Pressable>
      <Legal />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  action: { flex: 1, minHeight: 92, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 2 },
  seg: { flexDirection: 'row', borderRadius: 16, padding: 4, marginBottom: 12 },
  segBtn: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  tile: { width: '48.5%', flexGrow: 1, borderRadius: 20, borderWidth: 2, padding: 14, gap: 2 },
  tl: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  tlTime: { width: 74 },
  tlIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: 6, height: 170, alignItems: 'flex-end', marginBottom: 8 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '70%', flex: 1, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1 },
});
