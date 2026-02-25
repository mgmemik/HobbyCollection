import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(({ locale }) => ({
	locale: locale ?? 'en',
	messages: {
		welcome: 'Welcome'
	}
}));
