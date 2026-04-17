import { test, expect } from '@playwright/test';

async function fetchJson<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${url}`);
  }
  return response.json() as Promise<T>;
}

test.describe('app smoke', () => {
  test('home renders route list', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/Routes|노선/i)).toBeVisible();

    const summaries = await fetchJson<Array<{ route_code: string }>>(
      `${baseURL}/api/v1/routes/summary`,
    );
    if (summaries[0]?.route_code) {
      await expect(
        page.getByText(summaries[0].route_code, { exact: false }),
      ).toBeVisible();
    }
  });

  test('search renders and a stop detail page opens', async ({ page, baseURL }) => {
    const places = await fetchJson<Array<{ googlePlaceId: string; name: string }>>(
      `${baseURL}/api/v1/places`,
    );
    const firstPlace = places[0];
    test.skip(!firstPlace, 'No place data available');

    await page.goto('/search');
    await expect(page.locator('#search-stops-input')).toBeVisible();
    await page.fill('#search-stops-input', firstPlace.name);
    await expect(page.getByText(firstPlace.name, { exact: false }).first()).toBeVisible();

    await page.goto(`/stops?placeId=${encodeURIComponent(firstPlace.googlePlaceId)}`);
    await expect(page).toHaveURL(/\/stops\?placeId=/);
    await expect(page.getByText(firstPlace.name, { exact: false }).first()).toBeVisible();
  });

  test('notifications and settings render', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.getByText(/Notifications|알림/i).first()).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByText(/Profile|프로필/i).first()).toBeVisible();
    await expect(page.getByText(/Route|노선/i).first()).toBeVisible();
  });

  test('admin pages render with dev bypass', async ({ page, baseURL }) => {
    await page.goto('/admin');
    await expect(page.getByText(/Runs|운행/i).first()).toBeVisible();
    await expect(page.getByText(/Routes & Stops|노선·정류장/i).first()).toBeVisible();

    await page.goto('/admin/runs');
    await expect(page.getByText(/Active|History|Schedule|활성|이력/i).first()).toBeVisible();

    const schedules = await fetchJson<Array<{ id: string }>>(
      `${baseURL}/api/v1/admin/schedules`,
      'dev-bypass-local-admin',
    );
    const firstSchedule = schedules[0];
    test.skip(!firstSchedule, 'No schedule data available');

    await page.goto(`/admin/schedules/${firstSchedule.id}`);
    await expect(page).toHaveURL(new RegExp(`/admin/schedules/${firstSchedule.id}`));
    await expect(page.getByText(/Save & Deploy|저장 & 배포/i).first()).toBeVisible();
  });
});
