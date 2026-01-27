import MarkdownIt from "markdown-it";

export type ImageMode = "dark" | "light";

export type MarkdownImageRef = {
  fileName: string;
  mode?: ImageMode;
};

export type ImageScanResult = {
  images: MarkdownImageRef[];
  errors: string[];
};

type NormalizeResult = {
  fileName?: string;
  error?: string;
  external: boolean;
};

const schemePattern = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function scanMarkdownImages(markdown: string): ImageScanResult {
  const md = new MarkdownIt({ html: true });
  const tokens = md.parse(markdown, {});
  const images: MarkdownImageRef[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  walkTokens(tokens, (token) => {
    if (token.type !== "image") {
      return;
    }
    const src = token.attrGet("src") ?? "";
    const normalized = normalizeLocalImageSrc(src);
    if (normalized.external) {
      return;
    }
    if (normalized.error) {
      if (!errors.includes(normalized.error)) {
        errors.push(normalized.error);
      }
      return;
    }
    if (!normalized.fileName || seen.has(normalized.fileName)) {
      return;
    }
    images.push({ fileName: normalized.fileName, mode: detectImageMode(normalized.fileName) });
    seen.add(normalized.fileName);
  });

  return { images, errors };
}

export function normalizeLocalImageSrc(src: string): NormalizeResult {
  const trimmed = src.trim();
  if (!trimmed) {
    return { external: false };
  }
  if (schemePattern.test(trimmed) || trimmed.startsWith("//")) {
    return { external: true };
  }

  let fileName = trimmed;
  while (fileName.startsWith("./")) {
    fileName = fileName.slice(2);
  }

  if (!fileName || /[?#]/.test(fileName) || /[\\/]/.test(fileName)) {
    return {
      external: false,
      error: `Image references must point to sibling files next to the markdown file: ${src}`,
    };
  }

  return { external: false, fileName };
}

function detectImageMode(fileName: string): ImageMode | undefined {
  const match = fileName.match(/\.(dark|light)(?=\.[^.]+$)/i);
  if (!match) {
    return undefined;
  }
  return match[1].toLowerCase() as ImageMode;
}

type MarkdownToken = {
  type: string;
  attrGet(name: string): string | null;
  children: MarkdownToken[] | null;
};

function walkTokens(tokens: MarkdownToken[], visit: (token: MarkdownToken) => void): void {
  for (const token of tokens) {
    visit(token);
    if (token.children && token.children.length > 0) {
      walkTokens(token.children, visit);
    }
  }
}
