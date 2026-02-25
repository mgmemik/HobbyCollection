"use client";

import { useI18n } from "@/contexts/I18nContext";
import { Sparkles, Users, Shield, Mail } from "lucide-react";

export default function AboutPage() {
	const { t } = useI18n();

	return (
		<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
			<div className="container mx-auto px-4 md:px-6 max-w-4xl">
				{/* Header */}
				<div className="text-center mb-16">
					<h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
						{t("about.title")}
					</h1>
					<p className="text-xl text-gray-700 dark:text-gray-300">
						{t("about.subtitle")}
					</p>
				</div>

				{/* Mission */}
				<section className="mb-16">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						{t("about.missionTitle")}
					</h2>
					<p className="text-gray-700 dark:text-gray-300 leading-relaxed">
						{t("about.missionText")}
					</p>
				</section>

				{/* Story */}
				<section className="mb-16">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						{t("about.storyTitle")}
					</h2>
					<p className="text-gray-700 dark:text-gray-300 leading-relaxed">
						{t("about.storyText")}
					</p>
				</section>

				{/* Values */}
				<section className="mb-16">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
						{t("about.valuesTitle")}
					</h2>
					<div className="grid md:grid-cols-3 gap-8">
						<div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
							<div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
								<Sparkles className="w-6 h-6 text-white" />
							</div>
							<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
								{t("about.value1Title")}
							</h3>
							<p className="text-gray-700 dark:text-gray-300">
								{t("about.value1Text")}
							</p>
						</div>
						<div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
							<div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
								<Users className="w-6 h-6 text-white" />
							</div>
							<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
								{t("about.value2Title")}
							</h3>
							<p className="text-gray-700 dark:text-gray-300">
								{t("about.value2Text")}
							</p>
						</div>
						<div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
							<div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
								<Shield className="w-6 h-6 text-white" />
							</div>
							<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
								{t("about.value3Title")}
							</h3>
							<p className="text-gray-700 dark:text-gray-300">
								{t("about.value3Text")}
							</p>
						</div>
					</div>
				</section>

				{/* Stats */}
				<section className="mb-16">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
						{t("about.statsTitle")}
					</h2>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-8">
						<div className="text-center">
							<div className="text-3xl font-bold text-blue-600 dark:text-blue-400">10K+</div>
							<div className="text-gray-700 dark:text-gray-300">{t("about.statCollections")}</div>
						</div>
						<div className="text-center">
							<div className="text-3xl font-bold text-blue-600 dark:text-blue-400">5K+</div>
							<div className="text-gray-700 dark:text-gray-300">{t("about.statUsers")}</div>
						</div>
						<div className="text-center">
							<div className="text-3xl font-bold text-blue-600 dark:text-blue-400">50+</div>
							<div className="text-gray-700 dark:text-gray-300">{t("about.statCategories")}</div>
						</div>
						<div className="text-center">
							<div className="text-3xl font-bold text-blue-600 dark:text-blue-400">100K+</div>
							<div className="text-gray-700 dark:text-gray-300">{t("about.statItems")}</div>
						</div>
					</div>
				</section>

				{/* Contact */}
				<section className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-2xl">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						{t("about.contactTitle")}
					</h2>
					<p className="text-gray-700 dark:text-gray-300 mb-6">
						{t("about.contactText")}
					</p>
					<a
						href={`mailto:${t("about.contactEmail")}`}
						className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
					>
						<Mail className="w-5 h-5" />
						{t("about.contactEmail")}
					</a>
				</section>
			</div>
		</div>
	);
}
