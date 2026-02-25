import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/contexts/I18nContext";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	metadataBase: new URL('https://save-all.com'),
	title: {
		default: "Save All - Your Personal Collection Manager",
		template: "%s | Save All",
	},
	description: "Organize, track, and share your collections with AI-powered insights. Perfect for collectors, hobbyists, and enthusiasts.",
	keywords: ["collection manager", "hobby tracker", "collector app", "AI organization", "collectibles", "hobby collection"],
	authors: [{ name: "Save All Team" }],
	creator: "Save All",
	publisher: "Save All",
	formatDetection: {
		email: false,
		address: false,
		telephone: false,
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		url: "https://save-all.com",
		siteName: "Save All",
		title: "Save All - Your Personal Collection Manager",
		description: "Organize, track, and share your collections with AI-powered insights. Perfect for collectors, hobbyists, and enthusiasts.",
		images: [
			{
				url: "/favicon.ico",
				width: 1200,
				height: 630,
				alt: "Save All",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Save All - Your Personal Collection Manager",
		description: "Organize, track, and share your collections with AI-powered insights.",
		images: ["/favicon.ico"],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
	},
	verification: {
		// Google Search Console verification code buraya eklenecek
		// google: 'your-verification-code',
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const organizationSchema = {
		"@context": "https://schema.org",
		"@type": "Organization",
		"name": "Save All",
		"url": "https://save-all.com",
		"logo": "https://save-all.com/favicon.ico",
		"description": "Organize, track, and share your collections with AI-powered insights. Perfect for collectors, hobbyists, and enthusiasts.",
	};

	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${geistSans.variable} antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
				/>
				<ThemeProvider 
					attribute="class" 
					defaultTheme="light" 
					enableSystem={false}
					storageKey="theme"
					disableTransitionOnChange
				>
					<I18nProvider>
						<div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
							<Navigation />
							<main className="flex-1 bg-white dark:bg-gray-900">
								{children}
							</main>
							<Footer />
						</div>
					</I18nProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
