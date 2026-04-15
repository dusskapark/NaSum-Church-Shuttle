import { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Skeleton } from 'antd-mobile';
import { RequireAdmin } from '../components/RequireAdmin';

const ShuttleHome = lazy(() => import('./home'));
const SearchPage = lazy(() => import('./search'));
const StopDetailPage = lazy(() => import('./stops'));
const ScanPage = lazy(() => import('./scan'));
const NotificationsPage = lazy(() => import('./notifications'));
const SettingsPage = lazy(() => import('./settings'));
const AdminPage = lazy(() => import('./admin'));
const AdminRunsPage = lazy(() => import('./admin/runs'));
const AdminRegistrationsPage = lazy(() => import('./admin/registrations'));
const AdminUsersPage = lazy(() => import('./admin/users'));
const AdminRoutesListPage = lazy(() => import('./admin/routes-list'));
const AdminRouteDetailPage = lazy(() => import('./admin/route-detail'));
const AdminScheduleDetailPage = lazy(() => import('./admin/schedules'));
const AdminScheduleRouteDetailPage = lazy(
  () => import('./admin/schedules/route-detail'),
);
const OAuthCallbackPage = lazy(() => import('./oauth-callback'));
const NotFoundPage = lazy(() => import('./not-found'));

const Loading = () => (
  <div style={{ padding: '16px 16px 0' }}>
    <Skeleton.Title animated />
    <Skeleton.Paragraph lineCount={8} animated />
  </div>
);

export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Suspense fallback={<Loading />}>
        <ShuttleHome />
      </Suspense>
    ),
  },
  {
    path: '/search',
    element: (
      <Suspense fallback={<Loading />}>
        <SearchPage />
      </Suspense>
    ),
  },
  {
    path: '/stops',
    element: (
      <Suspense fallback={<Loading />}>
        <StopDetailPage />
      </Suspense>
    ),
  },
  {
    path: '/scan',
    element: (
      <Suspense fallback={<Loading />}>
        <ScanPage />
      </Suspense>
    ),
  },
  {
    path: '/notifications',
    element: (
      <Suspense fallback={<Loading />}>
        <NotificationsPage />
      </Suspense>
    ),
  },
  {
    path: '/settings',
    element: (
      <Suspense fallback={<Loading />}>
        <SettingsPage />
      </Suspense>
    ),
  },
  {
    path: '/admin',
    element: (
      <RequireAdmin>
        <Suspense fallback={<Loading />}>
          <AdminPage />
        </Suspense>
      </RequireAdmin>
    ),
  },
  {
    path: '/admin/runs',
    element: (
      <RequireAdmin>
        <Suspense fallback={<Loading />}>
          <AdminRunsPage />
        </Suspense>
      </RequireAdmin>
    ),
  },
  {
    path: '/admin/registrations',
    element: (
      <RequireAdmin>
        <Suspense fallback={<Loading />}>
          <AdminRegistrationsPage />
        </Suspense>
      </RequireAdmin>
    ),
  },
  {
    path: '/admin/users',
    element: (
      <RequireAdmin>
        <Suspense fallback={<Loading />}>
          <AdminUsersPage />
        </Suspense>
      </RequireAdmin>
    ),
  },
  {
    path: '/admin/routes',
    element: (
      <RequireAdmin>
        <Suspense fallback={<Loading />}>
          <AdminRoutesListPage />
        </Suspense>
      </RequireAdmin>
    ),
  },
  {
    path: '/admin/routes/:routeId',
    element: (
      <RequireAdmin>
        <Suspense fallback={<Loading />}>
          <AdminRouteDetailPage />
        </Suspense>
      </RequireAdmin>
    ),
  },
  {
    path: '/admin/schedules/:scheduleId',
    element: (
      <RequireAdmin>
        <Suspense fallback={<Loading />}>
          <AdminScheduleDetailPage />
        </Suspense>
      </RequireAdmin>
    ),
  },
  {
    path: '/admin/schedules/:scheduleId/routes/:routeId',
    element: (
      <RequireAdmin>
        <Suspense fallback={<Loading />}>
          <AdminScheduleRouteDetailPage />
        </Suspense>
      </RequireAdmin>
    ),
  },
  {
    path: '/oauth-callback',
    element: (
      <Suspense fallback={<Loading />}>
        <OAuthCallbackPage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<Loading />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
];
