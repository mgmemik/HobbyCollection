"use client";

import { useI18n } from "@/contexts/I18nContext";

export default function AccountDeletionPage() {
	const { t } = useI18n();

	const sections = [
		{ title: t("accountDeletion.section1Title"), text: t("accountDeletion.section1Text") },
		{ title: t("accountDeletion.section2Title"), text: t("accountDeletion.section2Text") },
		{ title: t("accountDeletion.section3Title"), text: t("accountDeletion.section3Text") },
		{ title: t("accountDeletion.section4Title"), text: t("accountDeletion.section4Text") },
		{ title: t("accountDeletion.section5Title"), text: t("accountDeletion.section5Text") },
		{ title: t("accountDeletion.section6Title"), text: t("accountDeletion.section6Text") },
		{ title: t("accountDeletion.section7Title"), text: t("accountDeletion.section7Text") },
		{ title: t("accountDeletion.section8Title"), text: t("accountDeletion.section8Text") },
	];

	return (
		<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
			<div className="container mx-auto px-4 md:px-6 max-w-4xl">
				{/* Header */}
				<div className="text-center mb-12">
					<h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
						{t("accountDeletion.title")}
					</h1>
					<p className="text-xl text-gray-700 dark:text-gray-300">
						{t("accountDeletion.subtitle")}
					</p>
					<p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
						{t("common.lastUpdated")}: January 2026
					</p>
				</div>

				{/* Warning Box */}
				<div className="mb-12 p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
					<h2 className="text-xl font-bold text-red-900 dark:text-red-200 mb-3">
						⚠️ {t("accountDeletion.warningTitle")}
					</h2>
					<p className="text-red-800 dark:text-red-300 leading-relaxed">
						{t("accountDeletion.warningText")}
					</p>
				</div>

				{/* Introduction */}
				<div className="mb-12 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
					<p className="text-gray-700 dark:text-gray-300 leading-relaxed">
						{t("accountDeletion.intro")}
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

				{/* Contact Section */}
				<div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
					<h2 className="text-xl font-bold text-blue-900 dark:text-blue-200 mb-3">
						{t("accountDeletion.section8Title")}
					</h2>
					<p className="text-blue-800 dark:text-blue-300 mb-4">
						{t("accountDeletion.section8Text")}
					</p>
					<a
						href="mailto:support@save-all.com?subject=Account%20Deletion%20Request"
						className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
					>
						{t("common.contactUs")}
					</a>
				</div>
			</div>
		</div>
	);
}
