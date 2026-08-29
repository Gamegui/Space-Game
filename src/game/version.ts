import pkg from "../../package.json";

export const APP_VERSION = pkg.version ?? "0.0.0";
export const APP_VERSION_DISPLAY = `v${APP_VERSION}`;
