import { getLiff } from './liff';

export async function openExternalUrl(url: string): Promise<void> {
  const liff = await getLiff();
  if (liff) {
    liff.openWindow({ url, external: true });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
