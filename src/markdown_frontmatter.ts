type FrontmatterResult = {
  body: string;
  title?: string;
  author?: string;
  date?: string;
  abstract?: string;
  macros: Record<string, string>;
  numberedHeadings?: boolean;
  toc?: boolean;
  errors: string[];
};

export function parseFrontmatter(markdown: string): FrontmatterResult {
  const errors: string[] = [];
  const lines = markdown.split(/\r?\n/);
  const macros: Record<string, string> = {};
  let numberedHeadings: boolean | undefined;
  let toc: boolean | undefined;
  let title: string | undefined;
  let author: string | undefined;
  let date: string | undefined;
  let abstract: string | undefined;

  if (lines[0] !== "---") {
    return { body: markdown, macros, numberedHeadings, toc, errors };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    errors.push("Frontmatter block is missing closing '---'.");
    return { body: markdown, macros, numberedHeadings, toc, errors };
  }

  let inMacrosBlock = false;
  let inAbstractBlock = false;
  let abstractLines: string[] = [];
  let i = 1;
  while (i < endIndex) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      i += 1;
      continue;
    }

    if (inMacrosBlock) {
      if (!/^\s+/.test(rawLine)) {
        inMacrosBlock = false;
        continue;
      }

      const match = /^\s*([^:]+)\s*:\s*(.*)$/.exec(rawLine);
      if (!match) {
        errors.push(`Invalid frontmatter macros line: ${rawLine}`);
        i += 1;
        continue;
      }

      const key = stripQuotes(match[1].trim());
      const value = stripQuotes(match[2].trim());
      if (!key) {
        errors.push("Frontmatter macros key cannot be empty.");
        i += 1;
        continue;
      }

      if (!value) {
        errors.push(`Frontmatter macros value cannot be empty for "${key}".`);
        i += 1;
        continue;
      }

      if (macros[key]) {
        errors.push(`Duplicate frontmatter macro: ${key}`);
        i += 1;
        continue;
      }

      macros[key] = value;
      i += 1;
      continue;
    }

    if (inAbstractBlock) {
      if (!/^\s+/.test(rawLine)) {
        inAbstractBlock = false;
        abstract = abstractLines.join("\n").trimEnd();
        if (!abstract) {
          errors.push("Frontmatter abstract cannot be empty.");
        }
        abstractLines = [];
        continue;
      }

      abstractLines.push(rawLine.replace(/^\s+/, ""));
      i += 1;
      continue;
    }

    const match = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(rawLine);
    if (!match) {
      errors.push(`Invalid frontmatter line: ${rawLine}`);
      i += 1;
      continue;
    }

    const key = match[1];
    const value = match[2].trim();

    switch (key) {
      case "title":
        title = setStringField(title, key, value, errors);
        i += 1;
        continue;
      case "author":
        author = setStringField(author, key, value, errors);
        i += 1;
        continue;
      case "date":
        date = setStringField(date, key, value, errors);
        i += 1;
        continue;
      case "abstract":
        if (abstract !== undefined) {
          errors.push("Duplicate frontmatter field: abstract");
          i += 1;
          continue;
        }
        if (value && !isBlockIndicator(value)) {
          abstract = stripQuotes(value);
          i += 1;
          continue;
        }
        inAbstractBlock = true;
        abstractLines = [];
        i += 1;
        continue;
      case "numbered_headings":
        numberedHeadings = setBooleanField(numberedHeadings, key, value, errors);
        i += 1;
        continue;
      case "toc":
        toc = setBooleanField(toc, key, value, errors);
        i += 1;
        continue;
      case "macros":
        if (value && value !== "{}") {
          errors.push("Frontmatter macros must be a mapping block.");
        } else {
          inMacrosBlock = true;
        }
        i += 1;
        continue;
      default:
        errors.push(`Unknown frontmatter field: ${key}`);
        i += 1;
        continue;
    }
  }

  if (inAbstractBlock) {
    abstract = abstractLines.join("\n").trimEnd();
    if (!abstract) {
      errors.push("Frontmatter abstract cannot be empty.");
    }
  }

  const body = lines.slice(endIndex + 1).join("\n");
  return { body, title, author, date, abstract, macros, numberedHeadings, toc, errors };
}

function stripQuotes(value: string): string {
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return value.slice(1, -1);
  }
  return value;
}

function setStringField(
  current: string | undefined,
  key: string,
  value: string,
  errors: string[],
): string | undefined {
  if (current !== undefined) {
    errors.push(`Duplicate frontmatter field: ${key}`);
    return current;
  }
  if (!value) {
    errors.push(`Frontmatter ${key} cannot be empty.`);
    return current;
  }
  return stripQuotes(value);
}

function setBooleanField(
  current: boolean | undefined,
  key: string,
  value: string,
  errors: string[],
): boolean | undefined {
  if (current !== undefined) {
    errors.push(`Duplicate frontmatter field: ${key}`);
    return current;
  }
  if (!value) {
    errors.push(`Frontmatter ${key} cannot be empty.`);
    return current;
  }
  const parsed = parseBoolean(value);
  if (parsed === null) {
    errors.push(`Invalid frontmatter ${key} value: ${value}`);
    return current;
  }
  return parsed;
}

function parseBoolean(value: string): boolean | null {
  const normalized = stripQuotes(value).trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function isBlockIndicator(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "|" || trimmed === ">" || trimmed === "|-" || trimmed === "|+" || trimmed === ">-";
}

export type { FrontmatterResult };
