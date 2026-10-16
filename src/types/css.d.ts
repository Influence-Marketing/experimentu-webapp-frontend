import type { CSSProperties } from "react";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

export type CssVars = CSSProperties;
