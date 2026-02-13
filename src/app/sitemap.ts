import type { MetadataRoute } from 'next';

const POSITIONS = ['utg', 'utg1', 'utg2', 'lj', 'hj', 'co', 'btn', 'sb', 'bb'];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://letsplay.poker';

  const staticRoutes = [
    '',
    '/preflop',
    '/preflop/practice',
    '/tools',
    '/tools/pot-odds',
    '/tools/push-fold',
    '/tools/icm',
    '/scenarios',
    '/scenarios/quiz',
    '/scenarios/replayer',
    '/scenarios/import',
    '/ranges',
    '/play',
  ];

  const positionRoutes = POSITIONS.map(pos => `/preflop/${pos}`);

  return [...staticRoutes, ...positionRoutes].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : route.split('/').length <= 2 ? 0.8 : 0.6,
  }));
}
