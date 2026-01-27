import { parseFrontmatter } from "./markdown_frontmatter.js";
import { buildDocumentMarkdown } from "./markdown_enrich.js";
import { scanMarkdownImages } from "./markdown_images.js";
import { renderMarkdown } from "./markdown_render.js";

type ProcessOptions = {
  throwOnError?: boolean;
  defaultTitle?: string;
  defaultNumberedHeadings?: boolean;
  defaultToc?: boolean;
};

export type MarkdownProcessResult = {
  html: string;
  title: string;
  numberedHeadings: boolean;
  images: ReturnType<typeof scanMarkdownImages>["images"];
  errors: string[];
};

export function processMarkdown(markdown: string, options: ProcessOptions = {}): MarkdownProcessResult {
  const frontmatter = parseFrontmatter(markdown);
  const numberedHeadings = frontmatter.numberedHeadings ?? options.defaultNumberedHeadings ?? true;
  const tocEnabled = frontmatter.toc ?? options.defaultToc ?? false;
  const titleValue = frontmatter.title ?? options.defaultTitle ?? "scimd";

  // Preprocess markdown to inject title/meta/abstract/TOC before rendering.
  const preprocessed = buildDocumentMarkdown(frontmatter, {
    title: titleValue,
    numberedHeadings,
    tocEnabled,
  });

  const imageScan = scanMarkdownImages(preprocessed.markdown);
  const html = renderMarkdown(preprocessed.markdown, {
    throwOnError: options.throwOnError ?? true,
    macros: frontmatter.macros,
    headingSlugs: preprocessed.headingSlugs,
    images: imageScan.images,
  });

  return {
    html,
    title: titleValue,
    numberedHeadings,
    images: imageScan.images,
    errors: [...frontmatter.errors, ...imageScan.errors],
  };
}
