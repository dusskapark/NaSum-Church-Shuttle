const supabasePublishableKeyEnvNames = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
] as const;

const requiredEnvNames = [
  "LINE_LOGIN_CHANNEL_ID",
  "LINE_LOGIN_CHANNEL_SECRET",
  "LIFF_ID",
  "MESSAGING_API_CHANNEL_ID",
  "MESSAGING_API_CHANNEL_SECRET",
  "MESSAGING_API_CHANNEL_ACCESS_TOKEN",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
] as const;

type EnvMap = Record<string, string | undefined>;

function readEnv(name: string, env: EnvMap = process.env): string {
  return env[name]?.trim() ?? "";
}

export function getMissingRequiredEnvNames(env: EnvMap = process.env): string[] {
  const missing: string[] = requiredEnvNames.filter(
    (envName) => !readEnv(envName, env),
  );
  const hasSupabasePublishableKey = supabasePublishableKeyEnvNames.some((envName) =>
    Boolean(readEnv(envName, env)),
  );

  if (!hasSupabasePublishableKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return missing;
}

export function getSupabasePublishableKey(env: EnvMap = process.env): string {
  for (const envName of supabasePublishableKeyEnvNames) {
    const value = readEnv(envName, env);
    if (value) {
      return value;
    }
  }

  return "";
}

export function getInternalServiceToken(env: EnvMap = process.env): string {
  return readEnv("SUPABASE_SERVICE_ROLE_KEY", env);
}

export function getMessagingAccessToken(env: EnvMap = process.env): string {
  return readEnv("MESSAGING_API_CHANNEL_ACCESS_TOKEN", env);
}

export function getMessagingSecret(env: EnvMap = process.env): string {
  return readEnv("MESSAGING_API_CHANNEL_SECRET", env);
}
