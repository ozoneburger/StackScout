import { absoluteUrl, publicSitemapPages } from "../lib/seo.js";

export default function sitemap() {
  const now = new Date();
  return publicSitemapPages.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
