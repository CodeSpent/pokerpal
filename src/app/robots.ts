import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/auth/', '/play/tournament/', '/api/'],
    },
    sitemap: 'https://letsplay.poker/sitemap.xml',
  };
}
