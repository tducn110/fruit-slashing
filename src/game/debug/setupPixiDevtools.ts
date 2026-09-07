import * as PIXI from "pixi.js";

// Polyfill TextureSource.prototype.resource in DEV mode for PixiJS DevTools browser extension compatibility.
// PixiJS v8 stores texture source data on .source, while PixiJS DevTools extension (v2.3.0) checks for .resource.
if (import.meta.env.DEV && !import.meta.env.TEST) {
  try {
    if ("TextureSource" in PIXI) {
      const TextureSourceProto = (PIXI as { TextureSource?: { prototype: { resource?: unknown } } }).TextureSource?.prototype;
      if (TextureSourceProto && !Object.getOwnPropertyDescriptor(TextureSourceProto, "resource")?.get) {
        const resourceMap = new WeakMap<object, unknown>();
        Object.defineProperty(TextureSourceProto, "resource", {
          get(this: { source?: unknown }) {
            return resourceMap.get(this) ?? this.source;
          },
          set(this: object, val: unknown) {
            resourceMap.set(this, val);
          },
          configurable: true,
          enumerable: true,
        });
      }
    }
  } catch {
    // Ignore in environments where PIXI is mocked or unavailable
  }
}

/**
 * Connect the gameplay Pixi Application to the PixiJS DevTools browser extension.
 * Exposes the main gameplay Application exclusively to DevTools while running in DEV mode.
 */
export function setupPixiDevtools(app: PIXI.Application): void {
  if (!import.meta.env.DEV) return;

  const devWindow = window as typeof window & {
    __PIXI_DEVTOOLS__?: {
      app?: PIXI.Application;
      stage?: PIXI.Container;
      renderer?: PIXI.Renderer;
      pixi?: typeof PIXI;
      plugins?: Record<string, unknown>;
      extensions?: unknown[];
    };
    __PIXI_APP__?: PIXI.Application;
    __PIXI_STAGE__?: PIXI.Container;
    __PIXI_RENDERER__?: PIXI.Renderer;
    __PIXI__?: typeof PIXI;
    PIXI?: typeof PIXI;
  };

  // 1. Expose global handles synchronously so DevTools extension picks up everything immediately
  devWindow.__PIXI_APP__ = app;
  devWindow.__PIXI_STAGE__ = app.stage;
  devWindow.__PIXI_RENDERER__ = app.renderer;
  devWindow.__PIXI__ = PIXI;
  devWindow.PIXI = PIXI;

  devWindow.__PIXI_DEVTOOLS__ = {
    ...devWindow.__PIXI_DEVTOOLS__,
    app,
    stage: app.stage,
    renderer: app.renderer,
    pixi: PIXI,
    plugins: devWindow.__PIXI_DEVTOOLS__?.plugins || {},
    extensions: devWindow.__PIXI_DEVTOOLS__?.extensions || [],
  };

  // 2. Official @pixi/devtools initialization (in browser DEV only, skip in unit test environment)
  if (!import.meta.env.TEST && typeof window !== "undefined") {
    void import("@pixi/devtools")
      .then(({ initDevtools }) => {
        if (typeof window === "undefined" || !devWindow.__PIXI_DEVTOOLS__) return;
        void initDevtools({
          app,
          stage: app.stage,
          renderer: app.renderer,
          pixi: PIXI,
        });
      })
      .catch(() => {
        // Ignored if @pixi/devtools fails to load
      });
  }
}

/**
 * Clean up DevTools references on unmount/teardown to prevent stale pointers or memory leaks.
 */
export function teardownPixiDevtools(app: PIXI.Application): void {
  if (!import.meta.env.DEV) return;

  const devWindow = window as typeof window & {
    __PIXI_DEVTOOLS__?: {
      app?: PIXI.Application;
    };
    __PIXI_APP__?: PIXI.Application;
    __PIXI_STAGE__?: unknown;
    __PIXI_RENDERER__?: unknown;
  };

  if (devWindow.__PIXI_DEVTOOLS__?.app === app) {
    Reflect.deleteProperty(devWindow, "__PIXI_DEVTOOLS__");
  }
  if (devWindow.__PIXI_APP__ === app) {
    Reflect.deleteProperty(devWindow, "__PIXI_APP__");
    Reflect.deleteProperty(devWindow, "__PIXI_STAGE__");
    Reflect.deleteProperty(devWindow, "__PIXI_RENDERER__");
  }
}
