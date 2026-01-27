import MarkdownIt from "markdown-it";
import katexPlugin from "@vscode/markdown-it-katex";
import { normalizeLocalImageSrc } from "./markdown_images.js";

type ImageMode = "dark" | "light";
type ImageInfo = { fileName: string; mode?: ImageMode };

type RenderEnv = {
  headingSlugs?: string[];
  headingSlugIndex?: number;
  headingSlugCounts?: Record<string, number>;
};

type RenderOptions = {
  throwOnError?: boolean;
  macros?: Record<string, string>;
  headingSlugs?: string[];
  images?: ImageInfo[];
};

export function renderMarkdown(markdown: string, options: RenderOptions = {}): string {
  const md = new MarkdownIt({ html: true });
  md.use(katexPlugin.default, {
    throwOnError: options.throwOnError ?? true,
    macros: options.macros ?? {},
  });
  md.use(headingIdPlugin);
  md.use(imageClassPlugin, options.images ?? []);

  const env: RenderEnv = { headingSlugs: options.headingSlugs };
  return md.render(markdown, env);
}

function headingIdPlugin(md: MarkdownIt): void {
  const original = md.renderer.rules.heading_open ?? ((tokens, idx, opts, env, self) => {
    return self.renderToken(tokens, idx, opts);
  });

  md.renderer.rules.heading_open = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const renderEnv = env as RenderEnv;
    const inlineToken = tokens[idx + 1];
    const headingText = inlineToken?.type === "inline" ? inlineText(inlineToken.children ?? []) : "";
    const slug = nextHeadingSlug(renderEnv, headingText);
    if (slug) {
      token.attrSet("id", slug);
    }
    return original(tokens, idx, opts, env, self);
  };
}

function nextHeadingSlug(env: RenderEnv, text: string): string {
  if (env.headingSlugs && env.headingSlugs.length > 0) {
    const index = env.headingSlugIndex ?? 0;
    const slug = env.headingSlugs[index] ?? "";
    env.headingSlugIndex = index + 1;
    return slug;
  }

  env.headingSlugCounts = env.headingSlugCounts ?? {};
  return slugify(text, env.headingSlugCounts);
}

function inlineText(
  tokens: Array<{ type?: string; content?: string; children?: unknown[] | null }>,
): string {
  const parts: string[] = [];
  for (const token of tokens) {
    if (token.type === "text" || token.type === "code_inline" || token.type === "math_inline") {
      parts.push(token.content ?? "");
    }
  }
  return parts.join("");
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

function imageClassPlugin(md: MarkdownIt, images: ImageInfo[]): void {
  const imageMap = new Map<string, ImageInfo>();
  for (const image of images) {
    imageMap.set(image.fileName, image);
  }

  const original = md.renderer.rules.image ?? ((tokens, idx, opts, env, self) => {
    return self.renderToken(tokens, idx, opts);
  });

  md.renderer.rules.image = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet("src") ?? "";
    const normalized = normalizeLocalImageSrc(src);
    if (!normalized.external && normalized.fileName) {
      const info = imageMap.get(normalized.fileName);
      if (info) {
        const existing = token.attrGet("class");
        const classes = new Set(existing ? existing.split(/\s+/).filter(Boolean) : []);
        classes.add("scimd-image");
        if (info.mode) {
          classes.add(`scimd-image--${info.mode}`);
        }
        token.attrSet("class", Array.from(classes).join(" "));
      }
    }
    return original(tokens, idx, opts, env, self);
  };
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
