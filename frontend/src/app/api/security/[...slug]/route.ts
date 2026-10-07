import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const path = slug.join('/');
    const url = new URL(request.url);
    const backendTarget = `${BACKEND_URL}/api/security/${path}${url.search}`;

    const res = await fetch(backendTarget, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Security proxy failed', details: message },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const path = slug.join('/');
    const backendTarget = `${BACKEND_URL}/api/security/${path}`;

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const res = await fetch(backendTarget, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Security proxy failed', details: message },
      { status: 502 }
    );
  }
}
