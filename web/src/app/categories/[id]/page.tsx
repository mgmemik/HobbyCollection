"use client";

import { useEffect, useState } from "react";
import { apiClient, Product } from "@/lib/api-client";
import Link from "next/link";
import Image from "next/image";
import { Heart, MessageCircle, ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/contexts/I18nContext";

export default function CategoryProductsPage() {
	const params = useParams();
	const categoryId = params.id as string;
	const { t } = useI18n();
	const router = useRouter();
	
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [categoryName, setCategoryName] = useState("");
	const [page, setPage] = useState(1);
	const [totalCount, setTotalCount] = useState(0);
	const pageSize = 24;

	useEffect(() => {
		if (categoryId) {
			loadProducts();
		}
	}, [categoryId, page]);

	const loadProducts = async () => {
		try {
			setLoading(true);
			const response = await apiClient.getProductsByCategory(categoryId, page);
			setProducts(response.products);
			setTotalCount(response.totalCount);
			
			// Kategori adını response'dan al (backend'den geliyor)
			if ((response as any).categoryName) {
				setCategoryName((response as any).categoryName);
			} else if (response.products.length > 0) {
				// Fallback: Ürünlerden al
				setCategoryName(response.products[0].categoryName || response.products[0].category || "Category");
			}
		} catch (error) {
			console.error("Failed to load products:", error);
			setProducts([]);
		} finally {
			setLoading(false);
		}
	};

	const totalPages = Math.ceil(totalCount / pageSize);

	return (
		<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
			<div className="container mx-auto px-4 md:px-6">
				{/* Back Button */}
				<Link
					href="/categories"
					className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-6"
				>
					<ArrowLeft className="w-4 h-4" />
					{t("categoryDetail.backToCategories")}
				</Link>

				{/* Header */}
				<div className="mb-12">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
						{categoryName || t("categories.title")}
					</h1>
					<p className="text-lg text-gray-700 dark:text-gray-300">
						{totalCount.toLocaleString()} {t("categoryDetail.itemsInCategory")}
					</p>
				</div>

				{/* Products Grid */}
				{loading ? (
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{[...Array(12)].map((_, i) => (
							<div key={i} className="animate-pulse">
								<div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
								<div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
								<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
							</div>
						))}
					</div>
				) : products.length === 0 ? (
					<div className="text-center py-20">
						<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
							{t("categoryDetail.noItems")}
						</h3>
						<p className="text-gray-700 dark:text-gray-300 mb-8">
							{t("categoryDetail.noItemsYet")}
						</p>
						<Link
							href="/categories"
							className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
						>
							{t("categoryDetail.browseOther")}
						</Link>
					</div>
				) : (
					<>
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
							{products.map((product) => (
								<Link
									key={product.id}
									href={`/products/${product.id}`}
									className="group"
								>
									<div className="relative aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden mb-3">
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
												{t("productDetail.noImage")}
											</div>
										)}
										{product.badges && product.badges.length > 0 && (
											<div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded">
												{product.badges[0].displayName}
											</div>
										)}
									</div>
									<h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
										{product.name || product.title}
									</h3>
									<p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
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
									<div className="flex items-center gap-4 text-sm text-gray-700 dark:text-gray-300">
										<span className="flex items-center gap-1">
											<Heart className="w-4 h-4" />
											{product.likeCount ?? 0}
										</span>
										<span className="flex items-center gap-1">
											<MessageCircle className="w-4 h-4" />
											{product.commentCount ?? 0}
										</span>
									</div>
								</Link>
							))}
						</div>

						{/* Pagination */}
						{totalPages > 1 && (
							<div className="flex justify-center items-center gap-2">
								<button
									onClick={() => setPage(p => Math.max(1, p - 1))}
									disabled={page === 1}
									className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white"
								>
									{t("common.previous")}
								</button>
								<span className="px-4 py-2 text-gray-900 dark:text-white font-medium">
									{t("common.page")} {page} {t("common.of")} {totalPages}
								</span>
								<button
									onClick={() => setPage(p => Math.min(totalPages, p + 1))}
									disabled={page === totalPages}
									className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white"
								>
									{t("common.next")}
								</button>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
