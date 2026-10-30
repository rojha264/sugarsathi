import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Screen } from '@/components/Screen';
import { SugarEveryChips } from '@/components/SugarEveryChips';
import { TimeStepper } from '@/components/TimeStepper';
import { toast } from '@/components/Toast';
import { Btn, Card, ChipRow, Field, H3, Legal, Txt } from '@/components/ui';
import { DietPicker } from '@/components/DietPicker';
import { useT } from '@/i18n/useT';
import { deleteAccount, logout } from '@/cloud/auth';
import { api, cloudEnabled, getSession } from '@/cloud/client';
import { useCloud, useSignedIn } from '@/cloud/store';
import { exportBackup, exportServerData, pickBackup } from '@/native/backup';
import { cancelAllReminders } from '@/native/reminders';
import { APP_LINK, shareWhatsApp } from '@/native/share';
import { track } from '@/cloud/analytics';
import { useApp } from '@/store/useApp';
import { useColors } from '@/theme/tokens';
import type { Lang, Mode, TextSize } from '@/types';

const MODE_ICON: Record<Mode, string> = { easy: '👵', simple: '🗣️', detailed: '📊' };

/** Everything chosen at onboarding, editable later; changes apply immediately. */
export default function SettingsScreen() {
  const { t } = useT();
  const c = useColors();
  const restart = useApp((s) => s.restart);
  const lang = useApp((s) => s.lang);
  const mode = useApp((s) => s.mode);
  const setup = useApp((s) => s.setup);
  const setLang = useApp((s) => s.setLang);
  const setMode = useApp((s) => s.setMode);
  const update = useApp((s) => s.updateSetup);
  const restore = useApp((s) => s.restore);
  const circleId = useCloud((s) => s.circleId);
  const authed = useSignedIn();
  const dietitian = useCloud((s) => s.dietitian);
  const tier = useCloud((s) => s.tier);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const s = useApp.getState();
    const ok = await exportBackup({ lang: s.lang, mode: s.mode, onboarded: s.onboarded, setup: s.setup, cur: s.cur, day: s.day, profiles: s.profiles }, t('backupSave'));
    setBusy(false);
    if (!ok) toast(t('backupFail'));
  };
  const load = async () => {
    setBusy(true);
    const data = await pickBackup();
    setBusy(false);
    if (data === 'canceled') return;
    if (!data) return toast(t('backupBad'));
    Alert.alert(t('backupLoadQ'), t('backupLoadB'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('backupLoad'),
        style: 'destructive',
        onPress: () => {
          restore(data);
          toast(t('backupDone'));
        },
      },
    ]);
  };

  // One line of the signup answers ("50 y · Woman · 160 cm · 70 kg · Tablets · North Indian").
  const healthSummary = [
    setup.birthYear ? `${new Date().getFullYear() - setup.birthYear} ${t('years')}` : null,
    setup.sex ? t(setup.sex === 'female' ? 'sexF' : setup.sex === 'male' ? 'sexM' : 'sexO').replace(/^\S+\s/, '') : null,
    setup.heightCm ? `${setup.heightCm} cm` : null,
    setup.weightKg ? `${setup.weightKg} kg` : null,
    setup.meds ? t(setup.meds === 'none' ? 'medsNone' : setup.meds === 'tablets' ? 'medsTablets' : 'medsInsulin') : null,
    setup.region ? t(({ north: 'rNorth', south: 'rSouth', east: 'rEast', west: 'rWest', northeast: 'rNortheast' } as const)[setup.region]) : null,
  ].filter(Boolean).join(' · ');

  return (
    <Screen title={t('setT')} back>
      {/* Word of mouth is how diabetes apps spread in India: one tap to tell a friend on WhatsApp. */}
      <Card style={{ borderColor: c.leaf, borderWidth: 1.5 }}>
        <H3>📤 {t('inviteT')}</H3>
        <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
          {t('inviteSub')}
        </Txt>
        <Btn
          small
          label={`💬 ${t('inviteBtn')}`}
          onPress={() => {
            track('invite_share', { from: 'settings' });
            shareWhatsApp(t('inviteMsg', { link: APP_LINK }));
          }}
        />
      </Card>
      <Card>
        <H3>🌐 {t('language')}</H3>
        <ChipRow<Lang> value={lang} options={['hi', 'en']} onChange={setLang} label={(l) => (l === 'hi' ? 'हिन्दी' : 'English')} />
        <H3>👀 {t('setMode')}</H3>
        <ChipRow<Mode> value={mode} options={['easy', 'simple', 'detailed']} onChange={setMode} label={(m) => `${MODE_ICON[m]} ${t(m)}`} />
        <H3>🔠 {t('textSizeQ')}</H3>
        <ChipRow<TextSize>
          value={setup.textSize}
          options={['normal', 'large', 'xl']}
          onChange={(textSize) => update({ textSize })}
          label={(s) => t(s === 'normal' ? 'tsNormal' : s === 'large' ? 'tsLarge' : 'tsXl')}
        />
        <Txt weight="semibold">{t('tsPreview')}</Txt>
      </Card>

      <Card>
        <H3>🙂 {t('setProfile')}</H3>
        <Field value={setup.name} onChangeText={(name) => update({ name })} placeholder={t('namePh')} autoCapitalize="words" style={{ marginBottom: 10 }} />
        <Txt weight="bold" style={{ marginBottom: 4 }}>{t('healthT')}</Txt>
        <Txt size={15} color="mute" style={{ marginBottom: 6 }}>
          {healthSummary || t('healthEmpty')}
        </Txt>
        <Btn small kind="alt" label={`✏️ ${t('healthEdit')}`} onPress={() => router.push('/health')} style={{ marginBottom: 10 }} />
        <Txt weight="bold" style={{ marginBottom: 6 }}>{t('dietQ')}</Txt>
        <DietPicker compact value={setup.diet} onChange={(diet) => update({ diet })} />
      </Card>

      <Card>
        <H3>⏰ {t('setRem')}</H3>
        <TimeStepper icon="🚶" label={t('rWalk')} value={setup.tw} onChange={(tw) => update({ tw })} />
        <TimeStepper icon="🩸" label={t('rSug')} value={setup.ts} onChange={(ts) => update({ ts })} />
        <TimeStepper icon="🍽️" label={t('rSugAfter')} value={setup.ta} onChange={(ta) => update({ ta })} />
        <Btn small kind="alt" label={`💊 ${t('medTimesLink')}`} onPress={() => router.push('/medicine')} style={{ marginVertical: 6 }} />
        <Btn small kind="alt" label={`🩺 ${t('ckT')}`} onPress={() => router.push('/checkups')} style={{ marginBottom: 6 }} />
        <Txt weight="bold" style={{ marginTop: 8, marginBottom: 6 }}>📅 {t('sugEveryQ')}</Txt>
        <SugarEveryChips value={setup.sugarEvery} onChange={(sugarEvery) => update({ sugarEvery })} />
      </Card>

      {cloudEnabled ? (
        <Card>
          <H3>👤 {t('accountT')}</H3>
          {authed ? (
            <>
              <Txt weight="semibold">📱 {getSession()?.user.phone}</Txt>
              <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
                {dietitian ? `👩‍⚕️ ${t('planBy', { n: dietitian })} · ` : ''}
                {t(tier === 'FREE' ? 'tierFree' : tier === 'PRO' ? 'tierPro' : 'tierBasic')}
              </Txt>
              <Btn
                small
                kind="alt"
                label={t('signOut')}
                onPress={() =>
                  Alert.alert(t('signOutQ'), t('signOutB'), [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('signOut'), style: 'destructive', onPress: () => logout() },
                  ])
                }
              />
              <Btn
                small
                kind="alt"
                label={`📥 ${t('myDataBtn')}`}
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  const ok = await api('/me/export').then((d) => exportServerData(d, t('myDataBtn'))).catch(() => false);
                  setBusy(false);
                  if (!ok) toast(t('netFail'));
                }}
                style={{ marginTop: 8 }}
              />
              <Btn
                small
                kind="alt"
                label={`🗑️ ${t('deleteAcc')}`}
                onPress={() =>
                  Alert.alert(t('deleteAccQ'), t('deleteAccB'), [
                    { text: t('cancel'), style: 'cancel' },
                    {
                      text: t('deleteAcc'),
                      style: 'destructive',
                      // Asked twice: this cannot be undone.
                      onPress: () =>
                        Alert.alert(t('deleteAccSure'), undefined, [
                          { text: t('cancel'), style: 'cancel' },
                          {
                            text: t('deleteAccYes'),
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await deleteAccount();
                                toast(t('deleteAccDone'));
                              } catch {
                                toast(t('netFail'));
                              }
                            },
                          },
                        ]),
                    },
                  ])
                }
                style={{ marginTop: 8 }}
              />
            </>
          ) : (
            <>
              <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
                {t('signInWhy')}
              </Txt>
              <Btn small label={`📱 ${t('signIn')}`} onPress={() => router.push('/onboarding/phone')} />
            </>
          )}
        </Card>
      ) : null}

      {cloudEnabled && authed ? (
        <Card>
          <H3>👨‍👩‍👦 {t('shareT')}</H3>
          <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
            {t(circleId ? 'shareOn' : 'shareSub')}
          </Txt>
          <Btn small label={t(circleId ? 'shareManage' : 'shareStart')} onPress={() => router.push('/share')} style={{ marginBottom: 8 }} />
          <Btn small kind="alt" label={`👵 ${t('followT')}`} onPress={() => router.push('/follow')} />
        </Card>
      ) : null}

      <Card>
        <H3>{t('setFamily')}</H3>
        <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
          {t('famAlertSub')}
        </Txt>
        <Field
          value={setup.caregiver.name}
          onChangeText={(name) => update({ caregiver: { ...setup.caregiver, name } })}
          placeholder={t('cgName')}
          autoCapitalize="words"
          style={{ marginBottom: 8 }}
        />
        <Field
          value={setup.caregiver.phone}
          onChangeText={(phone) => update({ caregiver: { ...setup.caregiver, phone } })}
          placeholder={t('cgPhone')}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </Card>

      <Card>
        <H3>{t('setData')}</H3>
        <Txt size={15} color="mute" style={{ marginBottom: 10 }}>
          {t('dataNote')}
        </Txt>
        <Btn small label={`📤 ${t('backupSave')}`} disabled={busy} onPress={save} style={{ marginBottom: 8 }} />
        <Btn small kind="alt" label={`📥 ${t('backupLoad')}`} disabled={busy} onPress={load} />
        <Txt size={14} color="mute" style={{ marginTop: 8 }}>
          {t('backupNote')}
        </Txt>
      </Card>
      {/* Danger zone: erases everything on this phone (not the server account). Asks twice. */}
      <Card style={{ borderColor: c.chilli, borderWidth: 1.5 }}>
        <H3>⚠️ {t('dangerZone')}</H3>
        <Txt size={15} color="mute" style={{ marginBottom: 8 }}>
          {t('restartNote')}
        </Txt>
        <Btn
          small
          kind="alt"
          label={`🧹 ${t('restart')}`}
          onPress={() =>
            Alert.alert(t('restart'), t('restartNote'), [
              { text: t('cancel'), style: 'cancel' },
              {
                text: t('restart'),
                style: 'destructive',
                onPress: () =>
                  Alert.alert(t('deleteAccSure'), undefined, [
                    { text: t('cancel'), style: 'cancel' },
                    {
                      text: t('restart'),
                      style: 'destructive',
                      onPress: () => {
                        cancelAllReminders();
                        restart();
                        router.replace('/onboarding/lang');
                      },
                    },
                  ]),
              },
            ])
          }
        />
      </Card>
      <Legal />
    </Screen>
  );
}
