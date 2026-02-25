"use client";

import { useEffect, useState } from "react";
import { apiClient, Product, UserProfile } from "@/lib/api-client";
import Link from "next/link";
import Image from "next/image";
import { Heart, MessageCircle, Package, Users, UserPlus, ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { useI18n } from "@/contexts/I18nContext";

export default function UserProfilePage() {
	const params = useParams();
	const username = params.username as string;
	const { t } = useI18n();
	
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [productsLoading, setProductsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (username) {
			loadProfile();
			loadProducts();
		}
	}, [username]);

	const loadProfile = async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await apiClient.getUserProfile(username);
			setProfile(data);
		} catch (err: any) {
			console.error("Failed to load profile:", err);
			setError(err.message || t("userProfile.notExist"));
		} finally {
			setLoading(false);
		}
	};

	const loadProducts = async () => {
		try {
			setProductsLoading(true);
			const response = await apiClient.getUserProducts(username, 1);
			setProducts(response.products);
		} catch (err) {
			console.error("Failed to load products:", err);
			setProducts([]);
		} finally {
			setProductsLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
				<div className="container mx-auto px-4 md:px-6 max-w-6xl">
					<div className="animate-pulse">
						<div className="flex items-center gap-6 mb-8">
							<div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
							<div className="flex-1 space-y-3">
								<div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
								<div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error || !profile) {
		return (
			<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
				<div className="container mx-auto px-4 md:px-6 max-w-6xl">
					<div className="text-center py-20">
						<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
							{t("userProfile.notFound")}
						</h3>
						<p className="text-gray-700 dark:text-gray-300 mb-8">
							{error || t("userProfile.notExist")}
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

	return (
		<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
			<div className="container mx-auto px-4 md:px-6 max-w-6xl">
				{/* Back Button */}
				<Link
					href="/products"
					className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-8"
				>
					<ArrowLeft className="w-4 h-4" />
					{t("userProfile.backToCollections")}
				</Link>

				{/* Profile Header */}
				<div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 mb-8 border border-gray-200 dark:border-gray-700">
					<div className="flex flex-col md:flex-row items-start md:items-center gap-6">
						{/* Avatar */}
						<div className="relative flex flex-col items-center">
							{profile.avatarUrl ? (
								<Image
									src={profile.avatarUrl}
									alt={profile.displayName || "User"}
									width={96}
									height={96}
									className="rounded-full"
								/>
							) : (
								<div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
									<span className="text-white text-3xl font-bold">
										{(profile.displayName || profile.email || "U")[0].toUpperCase()}
									</span>
								</div>
							)}
							{/* Plan Badge */}
							{(profile.planStatus || profile.isPremium !== undefined) && (
								<div className={`mt-2 px-3 py-1 rounded-lg text-xs font-bold uppercase ${
									profile.planStatus === 'premium' || profile.isPremium
										? 'bg-black dark:bg-yellow-500/20 border border-yellow-500 dark:border-yellow-500 text-yellow-400 dark:text-yellow-400'
										: 'bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
								}`}>
									{profile.planStatus === 'premium' || profile.isPremium
										? (t("plans.premium") || "Premium")
										: (t("plans.standard") || "Standart")
									}
								</div>
							)}
						</div>

						{/* Info */}
						<div className="flex-1">
							<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
								{profile.displayName || "Collector"}
							</h1>
							{profile.bio && (
								<p className="text-gray-700 dark:text-gray-300 mb-4">
									{profile.bio}
								</p>
							)}

							{/* Stats */}
							<div className="flex flex-wrap gap-6">
								<div className="flex items-center gap-2">
									<Package className="w-5 h-5 text-gray-600 dark:text-gray-400" />
									<span className="font-semibold text-gray-900 dark:text-white">
										{profile.productCount || 0}
									</span>
									<span className="text-gray-700 dark:text-gray-300">{t("userProfile.items")}</span>
								</div>
								{profile.followerCount !== undefined && (
									<div className="flex items-center gap-2">
										<Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
										<span className="font-semibold text-gray-900 dark:text-white">
											{profile.followerCount}
										</span>
										<span className="text-gray-700 dark:text-gray-300">{t("userProfile.followers")}</span>
									</div>
								)}
								{profile.followingCount !== undefined && (
									<div className="flex items-center gap-2">
										<UserPlus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
										<span className="font-semibold text-gray-900 dark:text-white">
											{profile.followingCount}
										</span>
										<span className="text-gray-700 dark:text-gray-300">{t("userProfile.following")}</span>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Products Section */}
				<div>
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
						{t("userProfile.collection")}
					</h2>

					{productsLoading ? (
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
							{[...Array(8)].map((_, i) => (
								<div key={i} className="animate-pulse">
									<div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
									<div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
									<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
								</div>
							))}
						</div>
					) : products.length === 0 ? (
						<div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-lg">
							<Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
							<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
								{t("userProfile.noPublicItems")}
							</h3>
							<p className="text-gray-700 dark:text-gray-300">
								{t("userProfile.notShared")}
							</p>
						</div>
					) : (
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
					)}
				</div>
			</div>
		</div>
	);
}
