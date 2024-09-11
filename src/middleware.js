import { NextResponse } from 'next/server';

export function middleware(request) {
  console.log('Middleware executed');
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
