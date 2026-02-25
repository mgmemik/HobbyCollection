"use client";

import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Moon, Sun, Menu, X, Languages } from "lucide-react";
import { useState, useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";

export function Navigation() {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const { locale, setLocale, t } = useI18n();
	const [mounted, setMounted] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [langMenuOpen, setLangMenuOpen] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Use resolvedTheme for display, it handles 'system' properly
	const currentTheme = resolvedTheme || theme;

	return (
		<nav className="sticky top-0 z-50 bg-white dark:bg-gray-900 backdrop-blur-md border-b border-gray-300 dark:border-gray-700">
			<div className="container mx-auto px-4 md:px-6">
				<div className="flex items-center justify-between h-16">
					{/* Logo */}
					<Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900 dark:text-white">
						<Image 
							src="/logo.png" 
							alt="Save All" 
							width={36} 
							height={36} 
							className="rounded-lg"
						/>
						Save All
					</Link>

					{/* Desktop Navigation */}
					<div className="hidden md:flex items-center gap-8">
						<Link href="/products" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
							{t("nav.products")}
						</Link>
						<Link href="/categories" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
							{t("nav.categories")}
						</Link>
						<Link href="/about" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
							{t("nav.about")}
						</Link>
						<Link href="/support" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
							{t("nav.support")}
						</Link>
					</div>

					{/* Right Side: Language, Theme Toggle & Mobile Menu */}
					<div className="flex items-center gap-2">
						{/* Language Selector */}
						<div className="relative">
							<button
								onClick={() => setLangMenuOpen(!langMenuOpen)}
								className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								aria-label="Change language"
							>
								<Languages className="w-5 h-5 text-gray-700 dark:text-gray-300" />
							</button>
							{langMenuOpen && (
								<div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
									<button
										onClick={() => {
											setLocale("en");
											setLangMenuOpen(false);
										}}
										className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
											locale === "en" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
										}`}
									>
										English
									</button>
									<button
										onClick={() => {
											setLocale("tr");
											setLangMenuOpen(false);
										}}
										className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
											locale === "tr" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
										}`}
									>
										Türkçe
									</button>
								</div>
							)}
						</div>
						{mounted && (
							<button
								onClick={() => {
									const newTheme = currentTheme === "dark" ? "light" : "dark";
									console.log("Switching theme from", currentTheme, "to", newTheme);
									setTheme(newTheme);
								}}
								className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								aria-label="Toggle theme"
							>
								{currentTheme === "dark" ? (
									<Sun className="w-5 h-5 text-yellow-500" />
								) : (
									<Moon className="w-5 h-5 text-gray-700" />
								)}
							</button>
						)}
						
						{/* Mobile Menu Button */}
						<button
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							aria-label="Toggle menu"
						>
							{mobileMenuOpen ? (
								<X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
							) : (
								<Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
							)}
						</button>
					</div>
				</div>

				{/* Mobile Menu */}
				{mobileMenuOpen && (
					<div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-800">
						<div className="flex flex-col gap-4">
							<Link
								href="/products"
								className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
								onClick={() => setMobileMenuOpen(false)}
							>
								{t("nav.products")}
							</Link>
							<Link
								href="/categories"
								className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
								onClick={() => setMobileMenuOpen(false)}
							>
								{t("nav.categories")}
							</Link>
							<Link
								href="/about"
								className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
								onClick={() => setMobileMenuOpen(false)}
							>
								{t("nav.about")}
							</Link>
							<Link
								href="/support"
								className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
								onClick={() => setMobileMenuOpen(false)}
							>
								{t("nav.support")}
							</Link>
							{/* Mobile Language Selector */}
							<div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
								<span className="text-sm text-gray-700 dark:text-gray-300">Language:</span>
								<button
									onClick={() => {
										setLocale("en");
										setMobileMenuOpen(false);
									}}
									className={`px-3 py-1 text-sm rounded ${
										locale === "en" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
									}`}
								>
									English
								</button>
								<button
									onClick={() => {
										setLocale("tr");
										setMobileMenuOpen(false);
									}}
									className={`px-3 py-1 text-sm rounded ${
										locale === "tr" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
									}`}
								>
									Türkçe
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</nav>
	);
}
