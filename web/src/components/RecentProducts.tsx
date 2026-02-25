"use client";

import { useEffect, useState } from "react";
import { apiClient, Product } from "@/lib/api-client";
import Link from "next/link";
import Image from "next/image";
import { Heart, MessageCircle } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useRouter } from "next/navigation";

export function RecentProducts() {
	const { t } = useI18n();
	const router = useRouter();
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadProducts = async () => {
			try {
				const response = await apiClient.getPublicFeed(1, 8);
				setProducts(response?.products || []);
			} catch (error) {
				console.error("Failed to load products:", error);
				setProducts([]);
			} finally {
				setLoading(false);
			}
		};

		loadProducts();
	}, []);

	if (loading) {
		return (
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{[...Array(8)].map((_, i) => (
					<div key={i} className="animate-pulse">
						<div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
						<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
						<div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
					</div>
				))}
			</div>
		);
	}

	if (products.length === 0) {
		return (
			<div className="text-center py-12 text-gray-600 dark:text-gray-300">
				No products found. Be the first to share your collection!
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
			{products.map((product) => (
				<Link
					key={product.id}
					href={`/products/${product.id}`}
					className="group"
				>
					<div className="relative aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden mb-2">
						{product.imageUrl ? (
							<Image
								src={product.imageUrl}
								alt={product.name || product.title || "Product"}
								fill
								className="object-cover group-hover:scale-105 transition-transform duration-300"
								sizes="(max-width: 768px) 50vw, 25vw"
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
								No Image
							</div>
						)}
						{product.badges && product.badges.length > 0 && (
							<div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded">
								{product.badges[0].displayName}
							</div>
						)}
					</div>
					<h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
						{product.name || product.title}
					</h3>
					<p className="text-xs text-gray-600 dark:text-gray-400 mb-1 truncate">
						{t("products.by")}{" "}
						{product.canViewProfile === true && (product.userName || product.userId) ? (
							<span
								onClick={(e) => {
									e.stopPropagation();
									e.preventDefault();
									router.push(`/u/${product.userName || product.userId}`);
								}}
								className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors cursor-pointer"
							>
								{product.userDisplayName || product.user || "Unknown"}
							</span>
						) : (
							<span>{product.userDisplayName || product.user || "Unknown"}</span>
						)}
					</p>
					<div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
						<span className="flex items-center gap-1">
							<Heart className="w-3.5 h-3.5" />
							{product.likeCount}
						</span>
						<span className="flex items-center gap-1">
							<MessageCircle className="w-3.5 h-3.5" />
							{product.commentCount}
						</span>
					</div>
				</Link>
			))}
		</div>
	);
}
