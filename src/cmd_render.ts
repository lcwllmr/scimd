import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import commandLineArgs from "command-line-args";
import { processMarkdown } from "./markdown_process.js";

const usage = "Usage: scimd render <file.md> [-o <output-dir>]";

type RenderOptions = {
  input?: string;
  output?: string;
};

export function runRender(argv: string[]): void {
  let filePath: string | undefined;
  let outputDir = process.cwd();

  try {
    const renderDefinitions = [
      { name: "input", defaultOption: true },
      { name: "output", alias: "o" },
    ];
    const renderOptions = commandLineArgs(renderDefinitions, { argv }) as RenderOptions;

    filePath = renderOptions.input;
    if (renderOptions.output) {
      outputDir = renderOptions.output;
    }
  } catch {
    console.error(usage);
    process.exit(1);
  }

  if (!filePath) {
    console.error(usage);
    process.exit(1);
  }

  if (extname(filePath) !== ".md") {
    console.error("File must have a .md extension.");
    process.exit(1);
  }

  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      console.error("Path must be a file.");
      process.exit(1);
    }
  } catch {
    console.error("File does not exist.");
    process.exit(1);
  }

  const markdown = readFileSync(filePath, "utf8");
  const result = processMarkdown(markdown);
  if (result.errors.length > 0) {
    for (const message of result.errors) {
      console.log(message);
    }
  }

  const templateUrl = new URL("./template.html", import.meta.url);
  const templateHtml = readFileSync(templateUrl, "utf8");
  const bodyClass = result.numberedHeadings ? " numbered-headings" : "";
  const outputHtml = templateHtml
    .replace("{{TITLE}}", escapeHtml(result.title))
    .replace("{{BODY_CLASS}}", bodyClass)
    .replace("{{CONTENT}}", result.html);

  mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, "index.html");
  writeFileSync(outputPath, outputHtml, "utf8");

  const styleUrl = new URL("./style.css", import.meta.url);
  const stylePath = join(outputDir, "style.css");
  copyFileSync(styleUrl, stylePath);

  const inputDir = dirname(filePath);
  for (const image of result.images) {
    const srcPath = join(inputDir, image.fileName);
    const destPath = join(outputDir, image.fileName);
    if (!existsSync(srcPath)) {
      console.log(`Missing image file: ${image.fileName}`);
      continue;
    }
    copyFileSync(srcPath, destPath);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
