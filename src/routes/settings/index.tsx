import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@/lib/router';
import {
  Avatar,
  Ellipsis,
  List,
  Picker,
  Skeleton,
  Switch,
  Toast,
} from 'antd-mobile';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { canAccessAdmin } from '../../lib/roleUtils';
import { useRegistration } from '../../hooks/useRegistration';
import { useLineUser, clearStoredAuth } from '../../hooks/useLineUser';
import { useContainer } from '../../hooks/useContainer';
import {
  useAppSettings,
  type AppLanguage,
  type AppTheme,
} from '../../lib/app-settings';
import { copyTextToClipboard } from '../../lib/copy-to-clipboard';
import { useTranslation } from '../../lib/useTranslation';
import { getRouteLabel } from '../../lib/routeSelectors';
import { fetchApi, mutateApi } from '../../lib/queries';
import type { MeResponse } from '@app-types/core';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, loading: lineLoading, isReady } = useLineUser();
  const showProfileSkeleton = lineLoading;
  const isAdmin = isReady && !!user && canAccessAdmin(user.role);
  const { lang, setLang, theme, setTheme } = useAppSettings();
  const queryClient = useQueryClient();
  const t = useTranslation();
  useContainer(t('settings.title'));
  const { registration, loading: registrationLoading } = useRegistration(
    user?.providerUid ?? null,
    t('common.serverError'),
  );

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => fetchApi<MeResponse>('/api/v1/me'),
    enabled: isReady && !!user,
  });

  const prefMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      mutateApi('/api/v1/me/preferences', { method: 'PATCH', body }),
    onSuccess: (_data, body) => {
      queryClient.setQueryData<MeResponse>(['me'], (current) => {
        if (!current) return current;

        const nextLanguage =
          body.preferred_language === 'en' || body.preferred_language === 'ko'
            ? body.preferred_language
            : current.preferredLanguage;
        const nextPushEnabled =
          typeof body.push_notifications_enabled === 'boolean'
            ? body.push_notifications_enabled
            : current.pushNotificationsEnabled;

        return {
          ...current,
          preferredLanguage: nextLanguage,
          pushNotificationsEnabled: nextPushEnabled,
        };
      });
    },
  });

  const [pushPreferenceOverride, setPushPreferenceOverride] = useState<
    boolean | null
  >(null);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const appliedServerLanguageRef = useRef<AppLanguage | null>(null);
  const pushEnabled =
    pushPreferenceOverride ?? meQuery.data?.pushNotificationsEnabled ?? true;
  const langLabel =
    lang === 'ko'
      ? t('settings.languageKorean')
      : t('settings.languageEnglish');
  const themeLabel =
    theme === 'dark'
      ? t('settings.themeDark')
      : theme === 'light'
        ? t('settings.themeLight')
        : t('settings.themeSystem');
  const isLoading = lineLoading || registrationLoading;
  const preferencesLoading = meQuery.isLoading && isReady;

  const listStyle = {
    '--border-radius': '12px',
    background: 'var(--app-color-surface)',
    overflow: 'hidden' as const,
  };

  useEffect(() => {
    const preferredLanguage = meQuery.data?.preferredLanguage;
    if (!preferredLanguage) return;
    if (appliedServerLanguageRef.current === preferredLanguage) return;

    appliedServerLanguageRef.current = preferredLanguage;
    queueMicrotask(() => {
      setLang(preferredLanguage);
    });
  }, [meQuery.data?.preferredLanguage, setLang]);

  const savePushPreference = (checked: boolean) => {
    const previousValue = pushEnabled;
    setPushPreferenceOverride(checked);
    prefMutation.mutate(
      { push_notifications_enabled: checked },
      {
        onSuccess: () => {
          setPushPreferenceOverride(null);
        },
        onError: () => {
          setPushPreferenceOverride(previousValue);
          Toast.show({
            content: t('settings.pushNotificationsSaveFailed'),
            duration: 1600,
          });
        },
      },
    );
  };

  const saveLanguagePreference = (nextLanguage: AppLanguage) => {
    if (nextLanguage === lang) return;

    const previousLanguage = lang;
    setLang(nextLanguage);
    prefMutation.mutate(
      { preferred_language: nextLanguage },
      {
        onError: () => {
          setLang(previousLanguage);
          Toast.show({
            content: t('settings.languageSaveFailed'),
            duration: 1600,
          });
        },
      },
    );
  };

  return (
    <Layout>
      <List header={t('settings.profileHeader')} style={listStyle}>
        {showProfileSkeleton ? (
          <>
            <List.Item
              prefix={
                <Skeleton
                  style={{
                    '--width': '40px',
                    '--height': '40px',
                    '--border-radius': '50%',
                  }}
                  animated
                />
              }
            >
              <Skeleton.Title animated style={{ width: 120, marginBlock: 0 }} />
            </List.Item>
            <List.Item
              clickable={false}
              extra={
                <Skeleton.Paragraph
                  lineCount={1}
                  animated
                  style={{ width: 80, marginBlock: 0 }}
                />
              }
            >
              {t('settings.userId')}
            </List.Item>
            <List.Item
              clickable={false}
              extra={
                <Skeleton.Paragraph
                  lineCount={1}
                  animated
                  style={{ width: 140, marginBlock: 0 }}
                />
              }
            >
              {t('settings.statusMessage')}
            </List.Item>
          </>
        ) : (
          <>
            <List.Item
              prefix={
                user?.pictureUrl ? (
                  <Avatar
                    src={user.pictureUrl}
                    style={{ '--size': '40px', '--border-radius': '50%' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#17b5a6',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 600,
                    }}
                  >
                    {(user?.displayName ?? '?')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )
              }
              extra={
                <span style={{ color: 'var(--app-color-subtle-text)' }}>
                  {t('settings.logout')}
                </span>
              }
              clickable
              onClick={() => {
                Toast.show({
                  content: t('settings.loggingOut'),
                  duration: 1000,
                });
                // Clear stored authentication
                clearStoredAuth();
                // Reload page to trigger fresh OAuth
                window.location.reload();
              }}
            >
              {user?.displayName ?? t('common.loadingUserName')}
            </List.Item>
            <List.Item
              clickable={false}
              extra={
                <span>
                  <Ellipsis
                    style={{ maxWidth: '160px' }}
                    direction="middle"
                    content={user?.userId ?? '-'}
                    onContentClick={() => {
                      if (!user?.userId) return;
                      const ok = copyTextToClipboard(user.userId);
                      Toast.show({
                        content: ok
                          ? t('settings.userIdCopied')
                          : t('settings.userIdCopyFailed'),
                        duration: 1000,
                      });
                    }}
                  />
                </span>
              }
            >
              {t('settings.userId')}
            </List.Item>
            <List.Item
              clickable={false}
              extra={
                <span style={{ color: 'var(--app-color-subtle-text)' }}>
                  {user?.statusMessage ?? '-'}
                </span>
              }
            >
              {t('settings.statusMessage')}
            </List.Item>
          </>
        )}
      </List>

      <List header={t('settings.routeHeader')} style={listStyle}>
        {isLoading ? (
          <div style={{ padding: 16 }}>
            <Skeleton.Title animated />
            <Skeleton.Paragraph lineCount={3} animated />
          </div>
        ) : (
          <>
            <List.Item
              extra={
                <span style={{ color: 'var(--app-color-subtle-text)' }}>
                  {registration
                    ? getRouteLabel(registration.route)
                    : t('settings.noRouteSelected')}
                </span>
              }
            >
              {t('settings.currentRoute')}
            </List.Item>
            <List.Item
              extra={
                <span style={{ color: 'var(--app-color-subtle-text)' }}>
                  {registration
                    ? (registration.route_stop.place.display_name ??
                      registration.route_stop.place.name)
                    : '-'}
                </span>
              }
            >
              {t('settings.currentStop')}
            </List.Item>
            <List.Item
              clickable
              onClick={() => {
                navigate('/search');
              }}
            >
              {t('settings.changeRoute')}
            </List.Item>
          </>
        )}
      </List>

      <List header={t('settings.preferencesHeader')} style={listStyle}>
        <List.Item
          extra={
            <Switch
              checked={pushEnabled}
              disabled={preferencesLoading || prefMutation.isPending}
              onChange={savePushPreference}
            />
          }
          description={
            preferencesLoading
              ? t('settings.preferencesLoading')
              : t('settings.pushNotificationsHint')
          }
        >
          {t('settings.pushNotifications')}
        </List.Item>
        <List.Item
          extra={
            <span style={{ color: 'var(--app-color-subtle-text)' }}>
              {langLabel}
            </span>
          }
          description={
            preferencesLoading
              ? t('settings.preferencesLoading')
              : t('settings.languageHint')
          }
          onClick={() => {
            setLanguagePickerVisible(true);
          }}
        >
          {t('settings.language')}
        </List.Item>
        <List.Item
          extra={
            <span style={{ color: 'var(--app-color-subtle-text)' }}>
              {themeLabel}
            </span>
          }
          description={t('settings.themeHint')}
          onClick={() => {
            setThemePickerVisible(true);
          }}
        >
          {t('settings.theme')}
        </List.Item>
      </List>

      {isAdmin && (
        <List header={t('settings.developerSection')} style={listStyle}>
          <List.Item
            clickable
            onClick={() => {
              navigate('/admin');
            }}
          >
            {t('admin.title')}
          </List.Item>
        </List>
      )}

      {/* Bottom tab bar spacer */}
      <div
        style={{
          height:
            'calc(var(--app-tab-bar-height) + env(safe-area-inset-bottom, 0px) + 16px)',
        }}
      />

      <Picker
        columns={[
          [
            { label: t('settings.languageEnglish'), value: 'en' },
            { label: t('settings.languageKorean'), value: 'ko' },
          ],
        ]}
        visible={languagePickerVisible}
        onClose={() => {
          setLanguagePickerVisible(false);
        }}
        value={[lang]}
        onConfirm={(value) => {
          const nextLanguage = value[0];

          if (nextLanguage === 'en' || nextLanguage === 'ko') {
            saveLanguagePreference(nextLanguage as AppLanguage);
          }
        }}
      />

      <Picker
        columns={[
          [
            { label: t('settings.themeSystem'), value: 'system' },
            { label: t('settings.themeLight'), value: 'light' },
            { label: t('settings.themeDark'), value: 'dark' },
          ],
        ]}
        visible={themePickerVisible}
        onClose={() => {
          setThemePickerVisible(false);
        }}
        value={[theme]}
        onConfirm={(value) => {
          const nextTheme = value[0];

          if (
            nextTheme === 'system' ||
            nextTheme === 'light' ||
            nextTheme === 'dark'
          ) {
            setTheme(nextTheme as AppTheme);
          }
        }}
      />
    </Layout>
  );
}
