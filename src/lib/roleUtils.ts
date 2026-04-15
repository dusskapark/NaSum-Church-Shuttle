import type { UserRole } from '@app-types/core';

/** driver 또는 admin — 운행 관리 가능 (Start/End Run) */
export const canManageRun = (role: UserRole): boolean =>
  role === 'driver' || role === 'admin';

/** admin 전용 기능 접근 가능 여부 */
export const canAccessAdmin = (role: UserRole): boolean => role === 'admin';
