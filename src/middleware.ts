import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'


// Permission mapping for each endpoint and method
const PERMISSIONS: Record<string, Record<string, string>> = {
  "/api/user": {
    GET: "view:user",
    POST: "edit:user", 
    PUT: "add:user",
    DELETE: "delete:user"
  },
  // "/api/role": {
  //   GET: "view:role",
  //   POST: "edit:role",
  //   PUT: "edit:role", 
  //   DELETE: "delete:role"
  // },
  // "/api/company": {
  //   GET: "view:company",
  //   POST: "edit:company",
  //   PUT: "edit:company",
  //   DELETE: "delete:company"
  // },
  // "/api/example": {
  //   GET: "view:user",
  //   POST: "edit:company",
  //   PUT: "edit:company",
  //   DELETE: "delete:company"
  // },
  // "/api/vehicle": {
  //   GET: "view:vehicle",
  //   POST: "edit:vehicle",
  //   PUT: "edit:vehicle",
  //   DELETE: "delete:vehicle"
  // },
  // "/api/brand": {
  //   GET: "view:brand",
  //   POST: "edit:brand",
  //   PUT: "edit:brand",
  //   DELETE: "delete:brand"
  // },
  // "/api/permission": {
  //   GET: "view:permission",
  //   POST: "edit:permission",
  //   PUT: "edit:permission",
  //   DELETE: "delete:permission"
  // }
};

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/public'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  
  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip middleware for non-API routes (pages) - they can handle their own auth
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  try {
    // Get the JWT token
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });

    // REJECT if no authentication for API routes
    if (!token || !token.sub) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get the base path without query parameters
    const basePath = pathname.split('?')[0];
    
    // Check if permission is required for this endpoint
    if (PERMISSIONS[basePath] && PERMISSIONS[basePath][method]) {
      const requiredPermission = PERMISSIONS[basePath][method];
      const userPermissions = token.permissions as string[] || [];
      
      // Check if user has the required permission
      if (!userPermissions.includes(requiredPermission)) {
        return NextResponse.json(
          { 
            error: `Access denied. Required permission: ${requiredPermission}` 
          },
          { status: 403 }
        );
      }
    }

    // Add session data to headers so API routes can access it
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.sub);
    requestHeaders.set('x-user-name', token.name || '');
    requestHeaders.set('x-user-role', token.role as string || '');
    requestHeaders.set('x-user-permissions', JSON.stringify(token.permissions || []));
    requestHeaders.set('x-company-id', String(token.companyId || ''));
    requestHeaders.set('x-company-name', token.company as string || '');

    // Continue with the request
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  } catch (error) {
    console.error("Middleware error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Configure which paths this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}