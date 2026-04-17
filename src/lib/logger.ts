function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function logDebug(message: string, ...args: unknown[]): void {
  if (!isDev()) {
    return;
  }

  console.log(message, ...args);
}

export function logInfo(message: string, ...args: unknown[]): void {
  if (!isDev()) {
    return;
  }

  console.info(message, ...args);
}

export function logWarn(message: string, ...args: unknown[]): void {
  if (!isDev()) {
    return;
  }

  console.warn(message, ...args);
}

export function logDevError(message: string, ...args: unknown[]): void {
  if (!isDev()) {
    return;
  }

  console.error(message, ...args);
}

export function logError(message: string, ...args: unknown[]): void {
  console.error(message, ...args);
}
