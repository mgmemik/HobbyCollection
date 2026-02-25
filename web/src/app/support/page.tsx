"use client";

import { useI18n } from "@/contexts/I18nContext";
import { Mail, Smartphone, HelpCircle, Book, Video, MessageSquare, Lightbulb } from "lucide-react";

export default function SupportPage() {
	const { t } = useI18n();

	const faqs = [
		{ q: t("support.faq1Q"), a: t("support.faq1A") },
		{ q: t("support.faq2Q"), a: t("support.faq2A") },
		{ q: t("support.faq3Q"), a: t("support.faq3A") },
		{ q: t("support.faq4Q"), a: t("support.faq4A") },
		{ q: t("support.faq5Q"), a: t("support.faq5A") },
	];

	return (
		<div className="py-12 bg-white dark:bg-gray-900 min-h-screen">
			<div className="container mx-auto px-4 md:px-6 max-w-4xl">
				{/* Header */}
				<div className="text-center mb-16">
					<h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
						{t("support.title")}
					</h1>
					<p className="text-xl text-gray-700 dark:text-gray-300">
						{t("support.subtitle")}
					</p>
				</div>

				{/* Contact Options */}
				<section className="mb-16">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
						{t("support.contactTitle")}
					</h2>
					<div className="grid md:grid-cols-2 gap-6">
						<a
							href="mailto:support@save-all.com"
							className="flex items-start gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							<div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
								<Mail className="w-6 h-6 text-white" />
							</div>
							<div>
								<h3 className="font-bold text-gray-900 dark:text-white mb-1">
									{t("support.contactEmail")}
								</h3>
								<p className="text-gray-700 dark:text-gray-300 text-sm">
									{t("support.contactEmailDesc")}
								</p>
							</div>
						</a>
						<div className="flex items-start gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
							<div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
								<Smartphone className="w-6 h-6 text-white" />
							</div>
							<div>
								<h3 className="font-bold text-gray-900 dark:text-white mb-1">
									{t("support.contactApp")}
								</h3>
								<p className="text-gray-700 dark:text-gray-300 text-sm">
									{t("support.contactAppDesc")}
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* FAQ */}
				<section className="mb-16">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
						{t("support.faqTitle")}
					</h2>
					<div className="space-y-4">
						{faqs.map((faq, index) => (
							<div key={index} className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
								<div className="flex items-start gap-3">
									<HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
									<div>
										<h3 className="font-bold text-gray-900 dark:text-white mb-2">
											{faq.q}
										</h3>
										<p className="text-gray-700 dark:text-gray-300">
											{faq.a}
										</p>
									</div>
								</div>
							</div>
						))}
					</div>
				</section>

				{/* Resources */}
				<section className="mb-16">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
						{t("support.resourcesTitle")}
					</h2>
					<div className="grid md:grid-cols-2 gap-4">
						<div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
							<Book className="w-5 h-5 text-blue-600 dark:text-blue-400" />
							<span className="text-gray-900 dark:text-white">{t("support.resource1")}</span>
						</div>
						<div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
							<Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />
							<span className="text-gray-900 dark:text-white">{t("support.resource2")}</span>
						</div>
						<div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
							<MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
							<span className="text-gray-900 dark:text-white">{t("support.resource3")}</span>
						</div>
						<div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
							<Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
							<span className="text-gray-900 dark:text-white">{t("support.resource4")}</span>
						</div>
					</div>
				</section>

				{/* Still Need Help */}
				<section className="text-center p-8 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						{t("support.stillNeedHelp")}
					</h2>
					<p className="text-gray-700 dark:text-gray-300 mb-6">
						{t("support.stillNeedHelpText")}
					</p>
					<a
						href="mailto:support@save-all.com"
						className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
					>
						<Mail className="w-5 h-5" />
						{t("support.sendMessage")}
					</a>
				</section>
			</div>
		</div>
	);
}
