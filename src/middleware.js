import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'


// Permission mapping for each endpoint and method
const PERMISSIONS = {
  "/api/user": {
    GET: "view:user",
    POST: "edit:user", 
    PUT: "add:user",
    DELETE: "delete:user"
  },
  "/api/role": {
    GET: "",
    POST: "edit:role",
    PUT: "add:role", 
    DELETE: "delete:role"
  },
  "/api/company": {
    GET: "view:company",
    POST: "edit:company",
    PUT: "add:company",
    DELETE: "delete:company"
  },
  "/api/vehicle": {
    GET: "view:vehicle",
    POST: "edit:vehicle",
    PUT: "add:vehicle",
    DELETE: "delete:vehicle"
  },
  "/api/brand": {
    GET: "",
    POST: "edit:brand",
    PUT: "edit:brand",
    DELETE: "delete:brand"
  },
  "/api/permission": {
    GET: "",
    POST: "edit:permission",
    PUT: "edit:permission",
    DELETE: "delete:permission"
  }
};

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/public'
];

export async function middleware(request) {
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
      const userPermissions = token.permissions || [];

      // Skip permission check if user is Sadmin (has all permissions)
      if (token.role === 'Sadmin') {
        // Sadmin has all permissions, continue
      } else {
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
    }

    // Add session data to headers so API routes can access it
    // const requestHeaders = new Headers(request.headers);    

    // Continue with the request
    return NextResponse.next();

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