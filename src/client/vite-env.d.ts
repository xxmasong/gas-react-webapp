/// <reference types="vite/client" />

// The `google` global only exists inside the deployed GAS iframe runtime.
// Declared loosely here so TypeScript accepts the runtime feature-detection
// in server.ts without pulling in DOM-incompatible GAS types.
declare const google:
  | {
      script?: {
        run: Record<string, unknown>;
        host?: unknown;
      };
    }
  | undefined;
