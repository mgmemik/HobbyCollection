import { MetadataRoute } from 'next';
import { apiClient } from '@/lib/api-client';

const BASE_URL = 'https://save-all.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [];

  // Static pages
  routes.push({
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1.0,
  });

  routes.push({
    url: `${BASE_URL}/products`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.9,
  });

  routes.push({
    url: `${BASE_URL}/categories`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  });

  routes.push({
    url: `${BASE_URL}/about`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.5,
  });

  routes.push({
    url: `${BASE_URL}/privacy`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.3,
  });

  routes.push({
    url: `${BASE_URL}/terms`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.3,
  });

  try {
    // Fetch public products (limit to recent 1000 for sitemap)
    const feedResponse = await apiClient.getPublicFeed(1, 1000);
    
    if (feedResponse.products) {
      feedResponse.products.forEach((product) => {
        if (product.id) {
          routes.push({
            url: `${BASE_URL}/products/${product.id}`,
            lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(product.createdAt),
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      });
    }
  } catch (error) {
    console.error('Error fetching products for sitemap:', error);
  }

  try {
    // Fetch root categories
    const rootCategories = await apiClient.getCategories();
    
    if (rootCategories && Array.isArray(rootCategories)) {
      // Recursively add all categories (including children)
      const addCategoryRecursive = async (category: any) => {
        const categoryId = typeof category.id === 'string' ? category.id : category.id.toString();
        routes.push({
          url: `${BASE_URL}/categories/${categoryId}`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.6,
        });
        
        // Add children if they exist
        if (category.children && Array.isArray(category.children)) {
          for (const child of category.children) {
            await addCategoryRecursive(child);
          }
        } else {
          // Try to fetch children if not included
          try {
            // categoryId string ise Guid'e çevir, number ise direkt kullan
            const categoryIdNum = typeof categoryId === 'string' 
              ? (categoryId.match(/^[0-9]+$/) ? Number(categoryId) : 0)
              : Number(categoryId);
            
            if (categoryIdNum > 0) {
              const children = await apiClient.getCategoryChildren(categoryIdNum);
              for (const child of children) {
                await addCategoryRecursive(child);
              }
            }
          } catch (err) {
            // Ignore errors when fetching children
          }
        }
      };
      
      for (const category of rootCategories) {
        await addCategoryRecursive(category);
      }
    }
  } catch (error) {
    console.error('Error fetching categories for sitemap:', error);
  }

  return routes;
}
