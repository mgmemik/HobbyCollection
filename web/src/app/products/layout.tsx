import { Metadata } from 'next';

export const metadata: Metadata = {
	title: "Products - Browse Collections",
	description: "Browse and discover amazing collections from collectors around the world. Find rare items, connect with collectors, and build your own collection.",
	openGraph: {
		title: "Products - Browse Collections | Save All",
		description: "Browse and discover amazing collections from collectors around the world.",
		type: "website",
		url: "https://save-all.com/products",
	},
	alternates: {
		canonical: "https://save-all.com/products",
	},
};

export default function ProductsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
