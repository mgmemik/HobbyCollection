import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_PORT = 5015;
const PRODUCTION_API_URL = 'https://api.save-all.com';
const LOCAL_API_URL = `http://localhost:${DEFAULT_PORT}`;
const isDevelopment = process.env.NODE_ENV !== 'production';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
  (isDevelopment ? LOCAL_API_URL : PRODUCTION_API_URL);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') || '1';

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

    const url = new URL(`${API_BASE_URL}/api/products/category/${categoryId}`);
    url.searchParams.set('page', page);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Next.js server-side fetch, CORS sorunu yok
      cache: 'no-store', // Her zaman fresh data
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API Proxy] Error from backend: ${response.status} ${response.statusText}`, errorText);
      return NextResponse.json(
        { error: errorText || `API Error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Request failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
