import { Metadata } from 'next';
import { apiClient } from '@/lib/api-client';

const BASE_URL = 'https://save-all.com';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const product = await apiClient.getProductById(id);
    
    const title = `${product.name || product.title || 'Product'} - Save All`;
    const description = product.description 
      ? product.description.substring(0, 160) 
      : `View ${product.name || product.title || 'this product'} on Save All. ${product.categoryName ? `Category: ${product.categoryName}.` : ''}`;
    
    const imageUrl = product.photos && product.photos.length > 0
      ? product.photos[0].blobUrl
      : product.imageUrl || `${BASE_URL}/favicon.ico`;
    
    return {
      title,
      description,
      keywords: [
        product.name || product.title || '',
        product.categoryName || '',
        'collection',
        'collector',
        'hobby',
        'save all',
      ].filter(Boolean),
      openGraph: {
        title,
        description,
        type: 'website',
        url: `${BASE_URL}/products/${id}`,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 1200,
            alt: product.name || product.title || 'Product',
          },
        ],
        siteName: 'Save All',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
      alternates: {
        canonical: `${BASE_URL}/products/${id}`,
      },
    };
  } catch (error) {
    console.error('Error generating metadata for product:', error);
    return {
      title: 'Product - Save All',
      description: 'View product on Save All',
    };
  }
}

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
