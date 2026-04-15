import { type ReactNode, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { useGrabUser } from '../hooks/useGrabUser';
import { useTranslation } from '../lib/useTranslation';
import { canAccessAdmin } from '../lib/roleUtils';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isReady } = useGrabUser();
  const t = useTranslation();
  const navigate = useNavigate();
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user || !canAccessAdmin(user.role)) {
      if (!toastShownRef.current) {
        toastShownRef.current = true;
        Toast.show({
          content: t('common.adminRequired'),
          icon: 'fail',
        });
      }
      navigate('/', { replace: true });
    }
  }, [isReady, user, t, navigate]);

  if (!isReady || !user || !canAccessAdmin(user.role)) return null;
  return <>{children}</>;
}
