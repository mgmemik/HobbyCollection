"use client";

import { useEffect, useState } from "react";
import { apiClient, Product } from "@/lib/api-client";
import Link from "next/link";
import Image from "next/image";
import { Heart, MessageCircle, ArrowLeft, Calendar, DollarSign, Tag } from "lucide-react";
import { useParams } from "next/navigation";
import { useI18n } from "@/contexts/I18nContext";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import { StructuredData } from "@/components/StructuredData";

export default function ProductDetailPage() {
	const params = useParams();
	const productId = params.id as string;
	const { t } = useI18n();
	
	const [product, setProduct] = useState<Product | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (productId) {
			loadProduct();
		}
	}, [productId]);

	const loadProduct = async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await apiClient.getProductById(productId);
			console.log('[ProductDetail] Loaded product:', {
				id: data.id,
				userId: data.userId,
				userName: data.userName,
				canViewProfile: data.canViewProfile,
				isWebProfilePublic: data.isWebProfilePublic
			});
			setProduct(data);
		} catch (err: any) {
			console.error("Failed to load product:", err);
			setError(err.message || t("productDetail.notExist"));
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
				<div className="container mx-auto px-4 md:px-6 max-w-6xl">
					<div className="animate-pulse">
						<div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-8" />
						<div className="grid md:grid-cols-2 gap-8">
							<div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg" />
							<div className="space-y-4">
								<div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
								<div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
								<div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error || !product) {
		return (
			<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
				<div className="container mx-auto px-4 md:px-6 max-w-6xl">
					<div className="text-center py-20">
						<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
							{t("productDetail.notFound")}
						</h3>
						<p className="text-gray-700 dark:text-gray-300 mb-8">
							{error || t("productDetail.notExist")}
						</p>
						<Link
							href="/products"
							className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
						>
							{t("productDetail.browseCollections")}
						</Link>
					</div>
				</div>
			</div>
		);
	}

	const breadcrumbs = product.categoryPath
		? [
				{ name: 'Home', url: 'https://save-all.com' },
				{ name: 'Products', url: 'https://save-all.com/products' },
				...product.categoryPath.map(cat => ({
					name: cat.name,
					url: `https://save-all.com/categories/${cat.id}`,
				})),
				{ name: product.name || product.title || 'Product', url: `https://save-all.com/products/${product.id}` },
			]
		: [
				{ name: 'Home', url: 'https://save-all.com' },
				{ name: 'Products', url: 'https://save-all.com/products' },
				{ name: product.name || product.title || 'Product', url: `https://save-all.com/products/${product.id}` },
			];

	return (
		<>
			<StructuredData product={product} type="product" />
			<StructuredData type="breadcrumb" breadcrumbs={breadcrumbs} />
			<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
				<div className="container mx-auto px-4 md:px-6 max-w-6xl">
				{/* Back Button */}
				<Link
					href="/products"
					className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-8"
				>
					<ArrowLeft className="w-4 h-4" />
					{t("productDetail.backToCollections")}
				</Link>

				<div className="grid md:grid-cols-2 gap-8 lg:gap-12">
					{/* Image Gallery */}
					<div className="sticky top-24 self-start">
						{product.photos && product.photos.length > 0 ? (
							<ProductImageGallery
								photos={product.photos}
								alt={product.name || product.title || "Product"}
								badges={product.badges}
							/>
						) : product.imageUrl ? (
							<div className="relative aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
								<Image
									src={product.imageUrl}
									alt={product.name || product.title || "Product"}
									fill
									className="object-cover"
									sizes="(max-width: 768px) 100vw, 50vw"
									priority
								/>
								{product.badges && product.badges.length > 0 && (
									<div className="absolute top-4 right-4 flex flex-wrap gap-2">
										{product.badges.map((badge, index) => (
											<div
												key={index}
												className="px-3 py-1 bg-yellow-500 text-white text-sm font-bold rounded-full shadow-lg"
											>
												{badge.displayName}
											</div>
										))}
									</div>
								)}
							</div>
						) : (
							<div className="relative aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
								<div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
									{t("productDetail.noImage")}
								</div>
							</div>
						)}
					</div>

					{/* Details */}
					<div>
						{/* Title */}
						<h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
							{product.name || product.title}
						</h1>

						{/* User Info */}
						{product.canViewProfile === true && 
							(product.userName || product.userId) && 
							product.isWebProfilePublic !== false ? (
							<Link
								href={`/u/${product.userName || product.userId}`}
								className="flex items-center gap-3 mb-6 group w-fit"
							>
								{product.userAvatarUrl ? (
									<Image
										src={product.userAvatarUrl}
										alt={product.userDisplayName || product.user || "User"}
										width={40}
									height={40}
									className="rounded-full"
								/>
							) : (
								<div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
									<span className="text-gray-600 dark:text-gray-300 font-bold">
										{(product.userDisplayName || product.user || "U")[0].toUpperCase()}
									</span>
								</div>
							)}
							<div>
								<p className="text-sm text-gray-600 dark:text-gray-400">{t("productDetail.ownedBy")}</p>
								<p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
									{product.userDisplayName || product.user || t("productDetail.unknownUser")}
								</p>
							</div>
						</Link>
						) : (
							<div className="flex items-center gap-3 mb-6 w-fit">
								{product.userAvatarUrl ? (
									<Image
										src={product.userAvatarUrl}
										alt={product.userDisplayName || product.user || "User"}
										width={40}
										height={40}
										className="rounded-full"
									/>
								) : (
									<div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
										<span className="text-gray-600 dark:text-gray-300 font-bold">
											{(product.userDisplayName || product.user || "U")[0].toUpperCase()}
										</span>
									</div>
								)}
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-400">{t("productDetail.ownedBy")}</p>
									<p className="font-semibold text-gray-900 dark:text-white">
										{product.userDisplayName || product.user || t("productDetail.unknownUser")}
									</p>
								</div>
							</div>
						)}

						{/* Stats */}
						<div className="flex items-center gap-6 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
							<div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
								<Heart className="w-5 h-5" />
								<span className="font-semibold">{product.likeCount ?? 0}</span>
								<span className="text-sm">{t("products.likes")}</span>
							</div>
							<div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
								<MessageCircle className="w-5 h-5" />
								<span className="font-semibold">{product.commentCount ?? 0}</span>
								<span className="text-sm">{t("products.comments")}</span>
							</div>
						</div>

						{/* Description */}
						{product.description && (
							<div className="mb-6">
								<h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
									{t("productDetail.description")}
								</h2>
								<p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-bold">
									{product.description}
								</p>
							</div>
						)}

						{/* Details Grid */}
						<div className="grid grid-cols-2 gap-4 mb-6">
							{product.categoryPath && product.categoryPath.length > 0 ? (
								<div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg col-span-2">
									<div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
										<Tag className="w-4 h-4" />
										<span className="text-sm">{t("productDetail.category")}</span>
									</div>
									<div className="flex items-center gap-2 flex-wrap">
										{product.categoryPath.map((cat, index) => (
											<div key={cat.id} className="flex items-center gap-2">
												<Link
													href={`/categories/${cat.id}`}
													className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
												>
													{cat.name}
												</Link>
												{index < product.categoryPath!.length - 1 && (
													<span className="text-gray-400 dark:text-gray-500">/</span>
												)}
											</div>
										))}
									</div>
								</div>
							) : product.categoryName ? (
								<div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
									<div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
										<Tag className="w-4 h-4" />
										<span className="text-sm">{t("productDetail.category")}</span>
									</div>
									<p className="font-semibold text-gray-900 dark:text-white">
										{product.categoryName}
									</p>
								</div>
							) : null}
							{product.purchasePrice && (
								<div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
									<div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
										<DollarSign className="w-4 h-4" />
										<span className="text-sm">{t("productDetail.purchasePrice")}</span>
									</div>
									<p className="font-semibold text-gray-900 dark:text-white">
										${product.purchasePrice.toLocaleString()}
									</p>
								</div>
							)}
							{product.estimatedValue && (
								<div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
									<div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
										<DollarSign className="w-4 h-4" />
										<span className="text-sm">{t("productDetail.estimatedValue")}</span>
									</div>
									<p className="font-semibold text-gray-900 dark:text-white">
										${product.estimatedValue.toLocaleString()}
									</p>
								</div>
							)}
						</div>

						{/* Date */}
						<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
							<Calendar className="w-4 h-4" />
							<span>
								{t("productDetail.added")} {new Date(product.createdAt).toLocaleDateString('en-US', { 
									year: 'numeric', 
									month: 'long', 
									day: 'numeric' 
								})}
							</span>
						</div>
					</div>
				</div>
				</div>
			</div>
		</>
	);
}
