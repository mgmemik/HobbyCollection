"use client";

import { useEffect, useState } from "react";
import { apiClient, Category } from "@/lib/api-client";
import Link from "next/link";
import { Package } from "lucide-react";

export function PopularCategories() {
	const [categories, setCategories] = useState<Category[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadCategories = async () => {
			try {
				const data = await apiClient.getCategories();
				// Limit to 6 categories for display
				setCategories(Array.isArray(data) ? data.slice(0, 6) : []);
			} catch (error) {
				console.error("Failed to load categories:", error);
				setCategories([]);
			} finally {
				setLoading(false);
			}
		};

		loadCategories();
	}, []);

	if (loading) {
		return (
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
				{[...Array(6)].map((_, i) => (
					<div key={i} className="animate-pulse">
						<div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
						<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
					</div>
				))}
			</div>
		);
	}

	if (categories.length === 0) {
		return (
			<div className="text-center py-12 text-gray-600 dark:text-gray-300">
				No categories available
			</div>
		);
	}

	const colors = [
		"from-blue-500 to-blue-600",
		"from-purple-500 to-purple-600",
		"from-green-500 to-green-600",
		"from-orange-500 to-orange-600",
		"from-pink-500 to-pink-600",
		"from-teal-500 to-teal-600",
	];

	return (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
			{categories.map((category, index) => (
				<Link
					key={category.id}
					href={`/categories/${category.id}`}
					className="group"
				>
					<div className={`aspect-square bg-gradient-to-br ${colors[index % colors.length]} rounded-lg flex items-center justify-center mb-2 group-hover:scale-105 transition-transform duration-300`}>
						<Package className="w-12 h-12 text-white" />
					</div>
					<h3 className="font-medium text-center text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
						{category.name}
					</h3>
					{category.productCount !== undefined && (
						<p className="text-sm text-center text-gray-600 dark:text-gray-300">
							{category.productCount} items
						</p>
					)}
				</Link>
			))}
		</div>
	);
}
