"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Users, Shield, TrendingUp } from "lucide-react";
import { RecentProducts } from "@/components/RecentProducts";
import { PopularCategories } from "@/components/PopularCategories";
import { useI18n } from "@/contexts/I18nContext";

export default function HomePage() {
	const { t } = useI18n();
	
	return (
		<div className="flex flex-col bg-white dark:bg-gray-900">
			{/* Hero Section */}
			<section className="relative bg-indigo-50 dark:bg-gray-800 py-20 md:py-32">
				<div className="container mx-auto px-4 md:px-6">
					<div className="flex flex-col items-center text-center space-y-8">
						<div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-full text-sm font-medium text-blue-800 dark:text-blue-100">
							<Sparkles className="w-4 h-4" />
							{t("home.badge")}
						</div>
						
						<h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white max-w-4xl">
							{t("home.title")}{" "}
							<span className="text-blue-600 dark:text-blue-400">{t("home.titleHighlight")}</span>
						</h1>
						
						<p className="text-xl text-gray-700 dark:text-gray-300 max-w-2xl">
							{t("home.subtitle")}
						</p>
						
						<div className="flex flex-col sm:flex-row gap-4">
							<Link
								href="/products"
								className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
							>
								{t("home.exploreCollections")}
								<ArrowRight className="w-5 h-5" />
							</Link>
							<Link
								href="/about"
								className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-gray-400 dark:border-gray-600 hover:border-blue-600 dark:hover:border-blue-400 text-gray-900 dark:text-white font-medium rounded-lg transition-colors bg-white/50 dark:bg-transparent"
							>
								{t("home.learnMore")}
							</Link>
						</div>
						
						<div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12 w-full max-w-4xl">
							<div className="text-center">
								<div className="text-3xl font-bold text-blue-600 dark:text-blue-400">10K+</div>
								<div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("home.collections")}</div>
							</div>
							<div className="text-center">
								<div className="text-3xl font-bold text-blue-600 dark:text-blue-400">5K+</div>
								<div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("home.users")}</div>
							</div>
							<div className="text-center">
								<div className="text-3xl font-bold text-blue-600 dark:text-blue-400">50+</div>
								<div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("home.categoriesCount")}</div>
							</div>
							<div className="text-center">
								<div className="text-3xl font-bold text-blue-600 dark:text-blue-400">100K+</div>
								<div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("home.itemsCount")}</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="py-20 bg-white dark:bg-gray-900">
				<div className="container mx-auto px-4 md:px-6">
					<div className="text-center mb-16">
						<h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
							{t("home.whyChoose")}
						</h2>
						<p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
							{t("home.whyChooseSubtitle")}
						</p>
					</div>
					
					<div className="grid md:grid-cols-3 gap-8">
						<div className="p-8 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-900 rounded-2xl shadow-sm">
							<div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
								<Sparkles className="w-6 h-6 text-white" />
							</div>
							<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
								{t("home.aiInsights")}
							</h3>
							<p className="text-gray-700 dark:text-gray-300">
								{t("home.aiInsightsDesc")}
							</p>
						</div>
						
						<div className="p-8 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-900 rounded-2xl shadow-sm">
							<div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
								<Users className="w-6 h-6 text-white" />
							</div>
							<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
								{t("home.connectShare")}
							</h3>
							<p className="text-gray-700 dark:text-gray-300">
								{t("home.connectShareDesc")}
							</p>
						</div>
						
						<div className="p-8 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-900 rounded-2xl shadow-sm">
							<div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
								<TrendingUp className="w-6 h-6 text-white" />
							</div>
							<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
								{t("home.trackValue")}
							</h3>
							<p className="text-gray-700 dark:text-gray-300">
								{t("home.trackValueDesc")}
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Recent Products Section */}
			<section className="py-20 bg-gray-100 dark:bg-gray-800">
				<div className="container mx-auto px-4 md:px-6">
					<div className="flex items-center justify-between mb-12">
						<div>
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
								{t("home.recentlyAdded")}
							</h2>
							<p className="text-gray-700 dark:text-gray-300">
								{t("home.recentlyAddedSubtitle")}
							</p>
						</div>
						<Link
							href="/products"
							className="hidden md:inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
						>
							{t("home.viewAll")}
							<ArrowRight className="w-4 h-4" />
						</Link>
					</div>
					
					<RecentProducts />
					
					<div className="text-center mt-8 md:hidden">
						<Link
							href="/products"
							className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
						>
							{t("home.viewAllProducts")}
							<ArrowRight className="w-4 h-4" />
						</Link>
					</div>
				</div>
			</section>

			{/* Categories Section */}
			<section className="py-20 bg-white dark:bg-gray-900">
				<div className="container mx-auto px-4 md:px-6">
					<div className="text-center mb-12">
						<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
							{t("home.popularCategories")}
						</h2>
						<p className="text-gray-700 dark:text-gray-300">
							{t("home.popularCategoriesSubtitle")}
						</p>
					</div>
					
					<PopularCategories />
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-900 dark:to-indigo-950">
				<div className="container mx-auto px-4 md:px-6">
					<div className="flex flex-col items-center text-center space-y-6">
						<h2 className="text-3xl md:text-5xl font-bold text-white max-w-3xl">
							{t("home.ctaTitle")}
						</h2>
						<p className="text-xl text-blue-100 max-w-2xl">
							{t("home.ctaSubtitle")}
						</p>
						<div className="flex flex-col sm:flex-row gap-4">
							<a
								href="https://apps.apple.com/app/save-all"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
							>
								<Shield className="w-5 h-5" />
								{t("home.downloadIOS")}
							</a>
							<a
								href="https://play.google.com/store/apps/details?id=com.saveall"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
							>
								<Shield className="w-5 h-5" />
								{t("home.downloadAndroid")}
							</a>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
