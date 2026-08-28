import { appendFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type ViteDevServer } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PERF_LOG_FILE = path.resolve(__dirname, ".perf-logs.ndjson");

// Приёмник перф-логов из браузера: игра шлёт записи о медленных кадрах и
// зависаниях (watchdog-воркер) ДО того, как вкладка умрёт — владелец игры
// ничего нажимать не должен, лог читается с файла напрямую.
const perfLogReceiver = {
  name: "perf-log-receiver",
  configureServer(server: ViteDevServer) {
    server.middlewares.use("/__perf_log", (req, res) => {
      const writeRecord = (raw: string) => {
        const record = JSON.parse(raw);
        const line = JSON.stringify({ at: new Date().toISOString(), ...record });
        appendFileSync(PERF_LOG_FILE, line + "\n");
        console.log(`[perf] ${line.slice(0, 300)}`);
      };
      if (req.method === "GET") {
        // Фолбэк-канал: /__perf_log?d=<urlencode(json)> — на случай, если
        // прокси превью не пропускает POST-запросы из iframe.
        try {
          const url = new URL(req.url ?? "/", "http://localhost");
          const data = url.searchParams.get("d");
          if (data) writeRecord(decodeURIComponent(data));
          else throw new Error("no data");
          res.statusCode = 204;
          res.end();
          return;
        } catch {
          res.statusCode = 400;
          res.end();
          return;
        }
      }
      if (req.method !== "POST") {
        res.statusCode = 404;
        res.end();
        return;
      }
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
        if (body.length > 200_000) req.destroy();
      });
      req.on("end", () => {
        try {
          writeRecord(body);
          res.statusCode = 204;
          res.end();
        } catch {
          res.statusCode = 400;
          res.end();
        }
      });
    });
  },
};

// https://vite.dev/config/
export default defineConfig({
  // Relative paths and one self-contained HTML file make the build portable in
  // Yandex Games' CDN/iframe and eliminate asset-loading round trips.
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile(), perfLogReceiver],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
