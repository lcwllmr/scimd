import { copyFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import esbuild from "esbuild";

const distDir = "dist";
mkdirSync(distDir, { recursive: true });
copyFileSync("src/template.html", `${distDir}/template.html`);

await esbuild.build({
  entryPoints: ["src/style.css"],
  bundle: true,
  minify: true,
  outdir: distDir,
});

const tscResult = spawnSync("tsc", ["-p", "tsconfig.json"], { stdio: "inherit" });
process.exit(tscResult.status ?? 1);
