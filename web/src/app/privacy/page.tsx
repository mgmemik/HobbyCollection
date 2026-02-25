"use client";

import { useI18n } from "@/contexts/I18nContext";

export default function PrivacyPage() {
	const { t } = useI18n();

	const sections = [
		{ title: t("privacy.section1Title"), text: t("privacy.section1Text") },
		{ title: t("privacy.section2Title"), text: t("privacy.section2Text") },
		{ title: t("privacy.section3Title"), text: t("privacy.section3Text") },
		{ title: t("privacy.section4Title"), text: t("privacy.section4Text") },
		{ title: t("privacy.section5Title"), text: t("privacy.section5Text") },
		{ title: t("privacy.section6Title"), text: t("privacy.section6Text") },
		{ title: t("privacy.section7Title"), text: t("privacy.section7Text") },
		{ title: t("privacy.section8Title"), text: t("privacy.section8Text") },
	];

	return (
		<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
			<div className="container mx-auto px-4 md:px-6 max-w-4xl">
				{/* Header */}
				<div className="text-center mb-12">
					<h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
						{t("privacy.title")}
					</h1>
					<p className="text-xl text-gray-700 dark:text-gray-300">
						{t("privacy.subtitle")}
					</p>
					<p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
						{t("common.lastUpdated")}: January 2026
					</p>
				</div>

				{/* Introduction */}
				<div className="mb-12 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
					<p className="text-gray-700 dark:text-gray-300 leading-relaxed">
						{t("privacy.intro")}
					</p>
				</div>

				{/* Sections */}
				<div className="space-y-8">
					{sections.map((section, index) => (
						<section key={index} className="border-b border-gray-200 dark:border-gray-700 pb-8 last:border-0">
							<h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
								{index + 1}. {section.title}
							</h2>
							<p className="text-gray-700 dark:text-gray-300 leading-relaxed">
								{section.text}
							</p>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
