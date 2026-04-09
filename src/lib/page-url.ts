function normalizeAppUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/\/api\/?$/, "");
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString().replace(/\/$/, "");
}

function slugifyTitle(title?: string): string {
  const raw = (title || "untitled").slice(0, 70).trim().toLowerCase();
  const normalized = raw
    .replace(/[♥🦄]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return normalized || "untitled";
}

export function buildPageSlug(pageSlugId: string, pageTitle?: string): string {
  return `${slugifyTitle(pageTitle)}-${pageSlugId}`;
}

export function buildPageUrl(
  baseUrl: string,
  spaceSlug: string | undefined,
  pageSlugId: string,
  pageTitle?: string,
): string {
  const appUrl = normalizeAppUrl(baseUrl);
  const slug = buildPageSlug(pageSlugId, pageTitle);
  const path = spaceSlug ? `/s/${spaceSlug}/p/${slug}` : `/p/${slug}`;
  return `${appUrl}${path}`;
}

export function extractSlugIdFromPageUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const match = url.pathname.match(/\/p\/([^/?#]+)/);
  if (!match) {
    return null;
  }

  const pageSlug = decodeURIComponent(match[1]);
  const lastDash = pageSlug.lastIndexOf("-");
  if (lastDash === -1 || lastDash === pageSlug.length - 1) {
    return null;
  }

  return pageSlug.slice(lastDash + 1);
}
