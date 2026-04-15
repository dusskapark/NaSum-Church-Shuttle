declare interface GrabConfig {
  uri?: string;
  appId?: string;
  appEnv?: string;
  basePath?: string;
  webKitConfig?: Record<string, any>;
  google?: {
    clientId: string;
  };
}

declare interface Grab {
  config: GrabConfig;
  storage: Storage;
}

declare interface Window {
  Grab?: Grab & typeof Grab;
}
