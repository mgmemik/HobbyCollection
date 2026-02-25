"use client";

import { useEffect, useState } from "react";
import { apiClient, Category } from "@/lib/api-client";
import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";

export default function CategoriesPage() {
	const [categories, setCategories] = useState<Category[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadCategories();
	}, []);

	const loadCategories = async () => {
		try {
			setLoading(true);
			const data = await apiClient.getCategories();
			setCategories(data);
		} catch (error) {
			console.error("Failed to load categories:", error);
			setCategories([]);
		} finally {
			setLoading(false);
		}
	};

	const colors = [
		"from-blue-500 to-blue-600",
		"from-purple-500 to-purple-600",
		"from-green-500 to-green-600",
		"from-orange-500 to-orange-600",
		"from-pink-500 to-pink-600",
		"from-teal-500 to-teal-600",
		"from-red-500 to-red-600",
		"from-indigo-500 to-indigo-600",
		"from-cyan-500 to-cyan-600",
		"from-amber-500 to-amber-600",
	];

	return (
		<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
			<div className="container mx-auto px-4 md:px-6">
				{/* Header */}
				<div className="mb-12">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
						Browse by Category
					</h1>
					<p className="text-lg text-gray-700 dark:text-gray-300">
						Explore collections organized by category
					</p>
				</div>

				{/* Categories Grid */}
				{loading ? (
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
						{[...Array(10)].map((_, i) => (
							<div key={i} className="animate-pulse">
								<div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
								<div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
								<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
							</div>
						))}
					</div>
				) : categories.length === 0 ? (
					<div className="text-center py-20">
						<div className="mb-4 text-gray-500 dark:text-gray-400">
							<Package className="w-16 h-16 mx-auto" />
						</div>
						<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
							No categories available
						</h3>
						<p className="text-gray-700 dark:text-gray-300">
							Categories will appear here once items are added
						</p>
					</div>
				) : (
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
						{categories.map((category, index) => (
							<Link
								key={category.id}
								href={`/categories/${category.id}`}
								className="group"
							>
								<div className={`aspect-square bg-gradient-to-br ${colors[index % colors.length]} rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-300 shadow-lg`}>
									<Package className="w-16 h-16 text-white" />
								</div>
								<h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
									{category.name}
								</h3>
								{category.productCount !== undefined && (
									<p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
										{category.productCount} items
										<ChevronRight className="w-3 h-3" />
									</p>
								)}
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
