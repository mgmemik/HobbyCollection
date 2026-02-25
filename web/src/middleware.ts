import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Port numarasını temizle
  const cleanHostname = hostname.split(':')[0];

  // Localhost ve development için bypass
  if (cleanHostname === 'localhost' || cleanHostname === '127.0.0.1') {
    return NextResponse.next();
  }

  // Root domain (save-all.com) isteklerini www'ye yönlendir
  if (cleanHostname === 'save-all.com') {
    url.hostname = 'www.save-all.com';
    url.port = ''; // Port numarasını kaldır
    return NextResponse.redirect(url, 301); // 301 Permanent Redirect
  }

  // www olmadan gelen istekleri www'ye yönlendir (güvenlik için)
  if (cleanHostname && !cleanHostname.startsWith('www.') && cleanHostname.includes('save-all.com') && !cleanHostname.includes('api.') && !cleanHostname.includes('backoffice.')) {
    url.hostname = `www.${cleanHostname}`;
    url.port = ''; // Port numarasını kaldır
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
