import { Product } from "@/lib/api-client";

interface StructuredDataProps {
  product?: Product;
  type?: 'product' | 'organization' | 'breadcrumb';
  breadcrumbs?: Array<{ name: string; url: string }>;
}

export function StructuredData({ product, type = 'product', breadcrumbs }: StructuredDataProps) {
  const BASE_URL = 'https://save-all.com';

  if (type === 'product' && product) {
    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name || product.title || "Product",
      "description": product.description || "",
      "image": product.photos && product.photos.length > 0
        ? product.photos.map(p => p.blobUrl)
        : product.imageUrl
        ? [product.imageUrl]
        : [],
      "offers": {
        "@type": "Offer",
        "price": product.purchasePrice || product.estimatedValue || 0,
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
      },
      "category": product.categoryName || product.category || "",
      "brand": {
        "@type": "Brand",
        "name": product.userDisplayName || product.user || "Save All",
      },
      "aggregateRating": product.likeCount > 0 ? {
        "@type": "AggregateRating",
        "ratingValue": "4.5",
        "reviewCount": product.likeCount,
      } : undefined,
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
    );
  }

  if (type === 'organization') {
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Save All",
      "url": BASE_URL,
      "logo": `${BASE_URL}/favicon.ico`,
      "description": "Organize, track, and share your collections with AI-powered insights. Perfect for collectors, hobbyists, and enthusiasts.",
      "sameAs": [
        // Add social media links if available
      ],
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
    );
  }

  if (type === 'breadcrumb' && breadcrumbs) {
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": crumb.name,
        "item": crumb.url,
      })),
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    );
  }

  return null;
}
