"use client";

import { createContext, use, type ReactNode } from "react";
import { DEFAULT_APP_CONFIG, type AppConfig } from "@/lib/config";

// Hands the masters (loaded on the server) to Client Components. Outside the
// app shell (sign-in pages, tests) it falls back to the seeded defaults.

const ConfigContext = createContext<AppConfig>(DEFAULT_APP_CONFIG);

export function ConfigProvider({ config, children }: { config: AppConfig; children: ReactNode }) {
  return <ConfigContext value={config}>{children}</ConfigContext>;
}

export function useAppConfig(): AppConfig {
  return use(ConfigContext);
}
