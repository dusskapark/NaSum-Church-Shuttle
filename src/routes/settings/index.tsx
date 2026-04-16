import { useEffect, useState } from 'react';
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
import { useMutation } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { canAccessAdmin } from '../../lib/roleUtils';
import { useRegistration } from '../../hooks/useRegistration';
import { useLineUser, clearStoredAuth } from '../../hooks/useLineUser';
import { useContainer } from '../../hooks/useContainer';
import { useAppSettings, type AppLanguage } from '../../lib/app-settings';
import { copyTextToClipboard } from '../../lib/copy-to-clipboard';
import { useTranslation } from '../../lib/useTranslation';
import { getRouteLabel } from '../../lib/routeSelectors';
import { mutateApi } from '../../lib/queries';

const PUSH_PREF_KEY = 'line-shuttle:push-notifications-enabled';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, loading: lineLoading, isReady } = useLineUser();
  const showProfileSkeleton = lineLoading;
  const isAdmin = isReady && !!user && canAccessAdmin(user.role);
  const { lang, setLang, isDark, toggleTheme } = useAppSettings();
  const t = useTranslation();
  useContainer(t('settings.title'));
  const { registration, loading: registrationLoading } = useRegistration(
    user?.userId ?? null,
    t('common.serverError'),
  );

  const prefMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      mutateApi('/api/v1/me/preferences', { method: 'PATCH', body }),
  });

  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const langLabel =
    lang === 'ko'
      ? t('settings.languageKorean')
      : t('settings.languageEnglish');
  useEffect(() => {
    const storedValue = window.localStorage.getItem(PUSH_PREF_KEY);
    setPushEnabled(storedValue === null ? true : storedValue === 'true');
  }, []);

  const isLoading = lineLoading || registrationLoading;

  const listStyle = {
    '--border-radius': '12px',
    background: 'var(--app-color-surface)',
    overflow: 'hidden' as const,
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
              onChange={(checked) => {
                setPushEnabled(checked);
                window.localStorage.setItem(PUSH_PREF_KEY, String(checked));
                prefMutation.mutate({ push_notifications_enabled: checked });
              }}
            />
          }
          description={t('settings.pushNotificationsHint')}
        >
          {t('settings.pushNotifications')}
        </List.Item>
        {/* </List> */}
        {/* <List header={t('settings.themeHeader')} style={listStyle}> */}
        <List.Item
          extra={
            <span style={{ color: 'var(--app-color-subtle-text)' }}>
              {langLabel}
            </span>
          }
          onClick={() => {
            setPickerVisible(true);
          }}
        >
          {t('settings.language')}
        </List.Item>
        <List.Item
          extra={
            <Switch
              checked={isDark}
              onChange={(checked) => {
                if (checked !== isDark) {
                  toggleTheme();
                }
              }}
            />
          }
        >
          {t('settings.darkMode')}
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
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
        }}
        value={[lang]}
        onConfirm={(value) => {
          const nextLanguage = value[0];

          if (nextLanguage === 'en' || nextLanguage === 'ko') {
            setLang(nextLanguage as AppLanguage);
            prefMutation.mutate({ preferred_language: nextLanguage });
          }
        }}
      />
    </Layout>
  );
}
