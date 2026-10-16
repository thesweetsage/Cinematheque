// The SDK ships no types; only its builder is used (src/lib/stremio.ts).
declare module "stremio-addon-sdk/src/builder" {
  type Handler = (args: { type: string; id: string; extra: Record<string, string>; config: Record<string, unknown> }) => Promise<object>;
  export default class AddonBuilder {
    constructor(manifest: Record<string, unknown>);
    defineCatalogHandler(handler: Handler): this;
    getInterface(): { manifest: object; get: (resource: string, type: string, id: string, extra?: Record<string, string>) => Promise<object> };
  }
}
