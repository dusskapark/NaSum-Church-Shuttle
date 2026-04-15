'use client';

import { getLiff } from '@/lib/liff';

type ResultShape<T> =
  | { status_code: 200; result: T; error?: undefined }
  | { status_code: 204; result?: undefined; error?: undefined }
  | { status_code: number; result?: undefined; error: string };

type DownloadArgs = { fileUrl: string; fileName?: string };

export function isSuccess<T>(
  value: ResultShape<T>,
): value is { status_code: 200; result: T } {
  return value.status_code === 200;
}

export function isNoContent<T>(
  value: ResultShape<T>,
): value is { status_code: 204 } {
  return value.status_code === 204;
}

export function isError<T>(
  value: ResultShape<T>,
): value is { status_code: number; error: string } {
  return value.status_code >= 400;
}

export class IdentityModule {
  async authorize(): Promise<ResultShape<{ redirected: true }>> {
    const liff = await getLiff();
    if (!liff) return { status_code: 501, error: 'LIFF unavailable' };
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href });
      return { status_code: 302, error: 'redirecting' };
    }
    return { status_code: 200, result: { redirected: true } };
  }

  async clearAuthorizationArtifacts(): Promise<ResultShape<boolean>> {
    return { status_code: 200, result: true };
  }

  async getAuthorizationArtifacts(): Promise<
    ResultShape<{ redirectUri: string }>
  > {
    return { status_code: 200, result: { redirectUri: window.location.href } };
  }
}

export class ProfileModule {
  async fetchEmail(): Promise<ResultShape<{ email?: string | null }>> {
    const liff = await getLiff();
    if (!liff?.isLoggedIn()) return { status_code: 204 };
    const decoded = liff.getDecodedIDToken();
    return { status_code: 200, result: { email: decoded?.email ?? null } };
  }
}

export class ContainerModule {
  async isConnected(): Promise<ResultShape<boolean>> {
    const liff = await getLiff();
    return { status_code: 200, result: !!liff?.isInClient() };
  }

  async showBackButton(): Promise<ResultShape<boolean>> {
    return { status_code: 200, result: true };
  }

  async hideBackButton(): Promise<ResultShape<boolean>> {
    return { status_code: 200, result: true };
  }

  async showRefreshButton(): Promise<ResultShape<boolean>> {
    return { status_code: 200, result: true };
  }

  async hideRefreshButton(): Promise<ResultShape<boolean>> {
    return { status_code: 200, result: true };
  }

  async hideLoader(): Promise<ResultShape<boolean>> {
    return { status_code: 200, result: true };
  }

  async onContentLoaded(): Promise<ResultShape<boolean>> {
    return { status_code: 200, result: true };
  }

  async setBackgroundColor(_color?: string): Promise<ResultShape<boolean>> {
    return { status_code: 200, result: true };
  }

  async setTitle(title: string): Promise<ResultShape<boolean>> {
    document.title = title;
    return { status_code: 200, result: !!title };
  }

  async getSessionParams(): Promise<ResultShape<string>> {
    const params = Object.fromEntries(new URLSearchParams(window.location.search));
    if (Object.keys(params).length === 0) return { status_code: 204 };
    return { status_code: 200, result: JSON.stringify(params) };
  }
}

export class ScopeModule {
  async reloadScopes(): Promise<ResultShape<boolean>> {
    return { status_code: 200, result: true };
  }

  async hasAccessTo(
    _module?: string,
    _method?: string,
  ): Promise<ResultShape<{ hasAccess: boolean }>> {
    return { status_code: 200, result: { hasAccess: true } };
  }
}

export class CameraModule {
  async scanQRCode(
    _options?: { title?: string },
  ): Promise<ResultShape<{ qrCode: string }>> {
    const liff = await getLiff();
    if (!liff) return { status_code: 501, error: 'LIFF unavailable' };
    if (liff.isApiAvailable('scanCodeV2')) {
      const result = await liff.scanCodeV2();
      if (!result?.value) return { status_code: 204 };
      return { status_code: 200, result: { qrCode: result.value } };
    }
    return { status_code: 403, error: 'QR scanner unavailable' };
  }
}

export class LocationModule {
  async getCoordinate(): Promise<
    ResultShape<{ latitude: number; longitude: number }>
  > {
    if (!navigator.geolocation) {
      return { status_code: 501, error: 'Geolocation unavailable' };
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            status_code: 200,
            result: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          });
        },
        (error) => {
          resolve({ status_code: 403, error: error.message });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
      );
    });
  }
}

export class SystemWebViewKitModule {
  async redirectToSystemWebView({
    url,
  }: {
    url: string;
  }): Promise<ResultShape<boolean>> {
    const liff = await getLiff();
    if (liff) {
      liff.openWindow({ url, external: true });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    return { status_code: 200, result: true };
  }
}

export class LocaleModule {
  async getLanguageLocaleIdentifier(): Promise<ResultShape<string>> {
    const liff = await getLiff();
    const lang =
      liff?.getLanguage() ??
      navigator.language ??
      navigator.languages?.[0] ??
      'en';
    return { status_code: 200, result: lang };
  }
}

export class SplashScreenModule {
  async dismiss(): Promise<ResultShape<boolean>> {
    return { status_code: 200, result: true };
  }
}

export class FileModule {
  async downloadFile({
    fileUrl,
    fileName,
  }: DownloadArgs): Promise<ResultShape<boolean>> {
    const anchor = document.createElement('a');
    anchor.href = fileUrl;
    if (fileName) anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return { status_code: 200, result: true };
  }
}
