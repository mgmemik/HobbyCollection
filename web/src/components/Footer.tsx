"use client";

import Link from "next/link";
import Image from "next/image";
import { Github, Twitter, Mail } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export function Footer() {
	const { t } = useI18n();
	const currentYear = new Date().getFullYear();

	return (
		<footer className="bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
			<div className="container mx-auto px-4 md:px-6 py-12">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-8">
					{/* Brand */}
					<div className="col-span-1">
						<Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900 dark:text-white mb-4">
							<Image 
								src="/logo.png" 
								alt="Save All" 
								width={32} 
								height={32} 
								className="rounded-lg"
							/>
							{t("footer.brand")}
						</Link>
						<p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
							{t("footer.tagline")}
						</p>
						<div className="flex gap-4">
							<a
								href="https://twitter.com/saveallapp"
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
								aria-label="Twitter"
							>
								<Twitter className="w-5 h-5" />
							</a>
							<a
								href="https://github.com/saveall"
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
								aria-label="GitHub"
							>
								<Github className="w-5 h-5" />
							</a>
							<a
								href="mailto:support@save-all.com"
								className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
								aria-label="Email"
							>
								<Mail className="w-5 h-5" />
							</a>
						</div>
					</div>

					{/* Product */}
					<div>
						<h3 className="font-bold text-gray-900 dark:text-white mb-4">{t("footer.product")}</h3>
						<ul className="space-y-2">
							<li>
								<Link href="/products" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
									{t("footer.exploreCollections")}
								</Link>
							</li>
							<li>
								<Link href="/categories" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
									{t("footer.browseCategories")}
								</Link>
							</li>
							<li>
								<Link href="/about" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
									{t("nav.about")}
								</Link>
							</li>
						</ul>
					</div>

					{/* Legal & Support */}
					<div>
						<h3 className="font-bold text-gray-900 dark:text-white mb-4">{t("footer.legalSupport")}</h3>
						<ul className="space-y-2">
							<li>
								<Link href="/support" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
									{t("footer.helpSupport")}
								</Link>
							</li>
							<li>
								<Link href="/privacy" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
									{t("footer.privacyPolicy")}
								</Link>
							</li>
							<li>
								<Link href="/terms" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
									{t("footer.termsOfService")}
								</Link>
							</li>
							<li>
								<Link href="/child-safety" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
									{t("footer.childSafety")}
								</Link>
							</li>
							<li>
								<Link href="/account-deletion" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
									{t("footer.accountDeletion")}
								</Link>
							</li>
							<li>
								<a href="mailto:support@save-all.com" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
									{t("common.contactUs")}
								</a>
							</li>
						</ul>
					</div>

					{/* Download */}
					<div>
						<h3 className="font-bold text-gray-900 dark:text-white mb-4">{t("footer.downloadApp")}</h3>
						<ul className="space-y-2">
							<li>
								<a
									href="https://apps.apple.com/app/save-all"
									target="_blank"
									rel="noopener noreferrer"
									className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
								>
									iOS App
								</a>
							</li>
							<li>
								<a
									href="https://play.google.com/store/apps/details?id=com.saveall"
									target="_blank"
									rel="noopener noreferrer"
									className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
								>
									Android App
								</a>
							</li>
						</ul>
					</div>
				</div>

				<div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
					<p className="text-sm text-gray-700 dark:text-gray-300">
						© {currentYear} Save All. {t("footer.allRightsReserved")}
					</p>
				</div>
			</div>
		</footer>
	);
}
