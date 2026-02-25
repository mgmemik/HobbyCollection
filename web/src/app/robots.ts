import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/account-deletion', '/support'],
      },
    ],
    sitemap: 'https://save-all.com/sitemap.xml',
  };
}
