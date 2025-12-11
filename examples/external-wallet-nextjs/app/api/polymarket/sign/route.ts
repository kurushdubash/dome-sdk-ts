import { NextRequest, NextResponse } from 'next/server';

/**
 * Builder signing proxy endpoint
 *
 * This route proxies signing requests to Dome's builder-signer service.
 * No local credentials are needed - Dome handles the builder signing.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Proxy to Dome's builder-signer service
    const response = await fetch(
      'https://builder-signer.domeapi.io/builder-signer/sign',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Builder signer error:', errorText);
      return NextResponse.json(
        { error: 'Builder signing failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Signing proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy signing request' },
      { status: 500 }
    );
  }
}
