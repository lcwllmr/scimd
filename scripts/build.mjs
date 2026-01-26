import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
if (tscResult.status !== 0) {
  process.exit(tscResult.status ?? 1);
}

const cliPath = `${distDir}/cli.js`;
const shebang = "#!/usr/bin/env node\n";
const cliContents = readFileSync(cliPath, "utf8");
if (!cliContents.startsWith(shebang)) {
  writeFileSync(cliPath, `${shebang}${cliContents}`);
}
chmodSync(cliPath, 0o755);
