import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";
import fs from "node:fs/promises";

// Build config that discovers all .html files under src/ui and creates
// a named Rollup input for each so Vite emits build/ui/<name>.html
const uiSrcDir = path.resolve(process.cwd(), "src", "ui");

async function buildInputs() {
  try {
    const files = await fs.readdir(uiSrcDir);
    const entries: Record<string, string> = {};
    for (const f of files) {
      if (f.toLowerCase().endsWith(".html")) {
        const name = path.basename(f, path.extname(f));
        entries[name] = path.join(uiSrcDir, f);
      }
    }
    return entries;
  } catch (err) {
    return {};
  }
}

export default defineConfig(async () => {
  const inputs = await buildInputs();

  return {
    plugins: [
      viteSingleFile(),
      {
        name: "move-html-to-root-multi",
        async closeBundle() {
          try {
            const outDir = path.resolve(process.cwd(), "build", "ui");
            for (const name of Object.keys(inputs)) {
              const nestedHtml = path.join(outDir, "src", "ui", `${name}.html`);
              const targetHtml = path.join(outDir, `${name}.html`);
              try {
                await fs.mkdir(path.dirname(targetHtml), { recursive: true });
                await fs.rename(nestedHtml, targetHtml);
              } catch (err) {
                // ignore missing or already-moved files
              }
            }
            try {
              await fs.rm(path.join(outDir, "src"), { recursive: true, force: true });
            } catch (err) {
              // ignore
            }
          } catch (err) {
            // best-effort only
          }
        },
      },
    ],
    build: {
      outDir: "build/ui",
      rollupOptions: {
        input: inputs,
      },
    },
  };
});