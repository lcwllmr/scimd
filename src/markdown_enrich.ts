import type { FrontmatterResult } from "./markdown_frontmatter.js";

type HeadingInfo = {
  level: number;
  text: string;
  slug: string;
};

type PreprocessResult = {
  markdown: string;
  headingSlugs: string[];
};

type EnrichOptions = {
  title: string;
  numberedHeadings: boolean;
  tocEnabled: boolean;
};

export function buildDocumentMarkdown(
  frontmatter: FrontmatterResult,
  options: EnrichOptions,
): PreprocessResult {
  const parts: string[] = [];
  const tocMarker = "[scimd-toc]";

  parts.push(`# ${options.title}`);

  const metaLine = buildMetaLine(frontmatter.author, frontmatter.date);
  if (metaLine) {
    parts.push(metaLine);
  }

  if (frontmatter.abstract) {
    parts.push(frontmatter.abstract.trim());
  }

  if (options.tocEnabled) {
    parts.push(tocMarker);
  }

  const body = frontmatter.body.trimStart();
  if (body) {
    parts.push(body);
  }

  const baseMarkdown = parts.filter(Boolean).join("\n\n");
  const headings = extractHeadings(baseMarkdown);
  let markdown = baseMarkdown;

  if (options.tocEnabled) {
    const tocMarkdown = buildTocMarkdown(headings, options.numberedHeadings);
    markdown = baseMarkdown.replace(tocMarker, tocMarkdown);
  }

  return { markdown, headingSlugs: headings.map((heading) => heading.slug) };
}

function buildMetaLine(author?: string, date?: string): string {
  const parts: string[] = [];
  if (author) {
    parts.push(`by ${escapeHtml(author)}`);
  }
  if (date) {
    parts.push(`on ${escapeHtml(date)}`);
  }
  if (parts.length === 0) {
    return "";
  }
  return `<p class="title-meta">published ${parts.join(" ")}</p>`;
}

function buildTocMarkdown(headings: HeadingInfo[], numberedHeadings: boolean): string {
  const tocHeadings = headings.filter((heading) => heading.level >= 2);
  if (tocHeadings.length === 0) {
    return "";
  }

  const minLevel = tocHeadings.reduce((min, heading) => Math.min(min, heading.level), tocHeadings[0].level);
  const lines: string[] = ["<p class=\"toc-marker\"></p>", ""];
  const bullet = numberedHeadings ? "1." : "-";

  for (const heading of tocHeadings) {
    const indent = "    ".repeat(Math.max(heading.level - minLevel, 0));
    const label = escapeMarkdownLinkText(heading.text);
    lines.push(`${indent}${bullet} [${label}](#${heading.slug})`);
  }

  return lines.join("\n");
}

function extractHeadings(markdown: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const slugCounts: Record<string, number> = {};
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fenceMarker = "";

  for (const line of lines) {
    const fenceMatch = /^(```+|~~~+)/.exec(line.trim());
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = "";
      }
      continue;
    }

    if (inFence) {
      continue;
    }

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const level = match[1].length;
    const rawText = match[2].replace(/\s+#+\s*$/, "").trim();
    if (!rawText) {
      continue;
    }

    const slug = slugify(rawText, slugCounts);
    headings.push({ level, text: rawText, slug });
  }

  return headings;
}

function slugify(text: string, counts: Record<string, number>): string {
  const base = stripMarkdown(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "-");
  const normalized = base || "section";
  const count = counts[normalized] ?? 0;
  counts[normalized] = count + 1;
  if (count === 0) {
    return normalized;
  }
  return `${normalized}-${count}`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^\)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_~]/g, "")
    .replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1");
}

function escapeMarkdownLinkText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type { PreprocessResult };
