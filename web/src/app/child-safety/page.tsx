"use client";

import { useI18n } from "@/contexts/I18nContext";
import { Shield, Mail } from "lucide-react";

export default function ChildSafetyPage() {
	const { t } = useI18n();

	const sections = [
		{ title: t("childSafety.section1Title"), text: t("childSafety.section1Text") },
		{ title: t("childSafety.section2Title"), text: t("childSafety.section2Text") },
		{ title: t("childSafety.section3Title"), text: t("childSafety.section3Text") },
		{ title: t("childSafety.section4Title"), text: t("childSafety.section4Text") },
		{ title: t("childSafety.section5Title"), text: t("childSafety.section5Text") },
		{ title: t("childSafety.section6Title"), text: t("childSafety.section6Text") },
		{ title: t("childSafety.section7Title"), text: t("childSafety.section7Text") },
		{ title: t("childSafety.section8Title"), text: t("childSafety.section8Text") },
	];

	return (
		<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
			<div className="container mx-auto px-4 md:px-6 max-w-4xl">
				{/* Header */}
				<div className="text-center mb-12">
					<div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-6">
						<Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
					</div>
					<h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
						{t("childSafety.title")}
					</h1>
					<p className="text-xl text-gray-700 dark:text-gray-300">
						{t("childSafety.subtitle")}
					</p>
				</div>

				{/* Introduction */}
				<div className="mb-12 p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
					<p className="text-gray-700 dark:text-gray-300 leading-relaxed">
						{t("childSafety.intro")}
					</p>
				</div>

				{/* Sections */}
				<div className="space-y-8">
					{sections.map((section, index) => (
						<section key={index} className="border-b border-gray-200 dark:border-gray-700 pb-8 last:border-0">
							<h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
								{section.title}
							</h2>
							<p className="text-gray-700 dark:text-gray-300 leading-relaxed">
								{section.text}
							</p>
						</section>
					))}
				</div>

				{/* Contact Section */}
				<section className="mt-12 text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						{t("childSafety.contactTitle")}
					</h2>
					<p className="text-gray-700 dark:text-gray-300 mb-6">
						{t("childSafety.contactText")}
					</p>
					<a
						href={`mailto:${t("childSafety.emergencyEmail")}`}
						className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
					>
						<Mail className="w-5 h-5" />
						{t("childSafety.emergencyEmail")}
					</a>
				</section>
			</div>
		</div>
	);
}
