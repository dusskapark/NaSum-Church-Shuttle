import { useNavigate } from '@/lib/router';
import Layout from '../../components/Layout';
import { useContainer } from '../../hooks/useContainer';
import { useAppSettings } from '../../lib/app-settings';
import { useTranslation } from '../../lib/useTranslation';

export default function AdminPage() {
  const navigate = useNavigate();
  const { lang } = useAppSettings();
  const t = useTranslation();
  useContainer(t('admin.title'));

  const cards = [
    {
      key: 'runs',
      icon: '🚌',
      title: t('admin.runsSection'),
      description: t('admin.runsDescription'),
      path: '/admin/runs',
      span: false,
    },
    {
      key: 'registrations',
      icon: '📋',
      title: t('admin.subtitle'),
      description: t('admin.registrationsDescription'),
      path: '/admin/registrations',
      span: false,
    },
    {
      key: 'users',
      icon: '👥',
      title: t('admin.usersSection'),
      description: t('admin.usersDescription'),
      path: '/admin/users',
      span: false,
    },
    {
      key: 'routes',
      icon: '🗺️',
      title: lang === 'ko' ? '노선·정류장' : 'Routes & Stops',
      description:
        lang === 'ko'
          ? '노선 등록, 정류장 관리 및 Google Maps 동기화'
          : 'Register routes, manage stops, and sync from Google Maps.',
      path: '/admin/routes',
      span: false,
    },
  ];

  return (
    <Layout showTabBar={false}>
      <div style={{ padding: '16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {cards.map((card) => (
            <div
              key={card.key}
              role="button"
              tabIndex={0}
              onClick={() => navigate(card.path)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(card.path)}
              style={{
                gridColumn: card.span ? '1 / -1' : 'auto',
                background: 'var(--adm-color-background)',
                border: '1px solid var(--app-color-border)',
                borderRadius: 16,
                padding: '20px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: card.span ? 'row' : 'column',
                alignItems: card.span ? 'center' : 'flex-start',
                gap: card.span ? 14 : 10,
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  width: 52,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  background: 'var(--app-color-background-secondary)',
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--app-color-title)',
                    marginBottom: 4,
                  }}
                >
                  {card.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--app-color-subtle-text)',
                    lineHeight: 1.4,
                  }}
                >
                  {card.description}
                </div>
              </div>
              {card.span && (
                <span
                  style={{
                    color: 'var(--app-color-subtle-text)',
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  ›
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
