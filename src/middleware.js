import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Permission mapping for each endpoint and method
const PERMISSIONS = {
  "/api/user": {
    GET: "view:user",
    POST: "edit:user",
    PUT: "add:user",
    DELETE: "delete:user",
  },
  "/api/role": {
    GET: "view:role",
    POST: "edit:role",
    PUT: "add:role",
    DELETE: "delete:role",
  },
  "/api/company": {
    GET: "view:company",
    POST: "edit:company",
    PUT: "add:company",
    DELETE: "delete:company",
  },
  "/api/vehicle": {
    GET: "view:vehicle",
    POST: "edit:vehicle",
    PUT: "add:vehicle",
    DELETE: "delete:vehicle",
  },
  "/api/customer": {
    GET: "view:customer",
    POST: "edit:customer",
    PUT: "add:customer",
    DELETE: "delete:customer",
  },
  // Vehicle-related endpoints
  "/api/vehicleInlineUpdate": { POST: "edit:vehicle" },
  "/api/vehicleSuggestions": { GET: "view:vehicle" },
  "/api/vehiclePayments": { GET: "view:vehicle", POST: "edit:vehicle", PUT: "edit:vehicle", DELETE: "edit:vehicle" },
  "/api/vehicleAuditLog": { GET: "view:vehicle" },
  "/api/vehicleExport": { GET: "view:vehicle", POST: "view:vehicle" },
  "/api/exportTemplate": { GET: "view:vehicle", POST: "edit:vehicle", PUT: "add:vehicle", DELETE: "delete:vehicle" },
  // Invoice & document endpoints
  "/api/paymentConfirmation": { PUT: "edit:vehicle", PATCH: "edit:vehicle" },
  "/api/createVehiclesFromInvoice": { POST: "add:vehicle" },
  "/api/addDocument": { PUT: "add:vehicle" },
  "/api/InvoiceJobs": { GET: "view:vehicle", POST: "edit:vehicle" },
  "/api/linkDocumentToVehicle": { POST: "edit:vehicle" },
  // AI / admin endpoints
  "/api/promptVersion": { GET: "view:vehicle", POST: "edit:vehicle", PUT: "add:vehicle" },
  "/api/evaluationDataset": { GET: "view:vehicle", POST: "edit:vehicle" },
  "/api/accuracyStats": { GET: "view:vehicle" },
  // Utility endpoints
  "/api/brand": { GET: "view:vehicle" },
  "/api/permission": { GET: "view:role" },
};

// Prefix-based permissions (for nested routes like /api/gmail/*)
const PERMISSION_PREFIXES = {
  "/api/gmail/": { GET: "edit:user", POST: "edit:user", DELETE: "edit:user" },
};

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/api/auth"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  try {
    // Get the JWT token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // REJECT if no authentication for API routes
    if (!token || !token.sub) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get the base path without query parameters
    const basePath = pathname.split("?")[0];

    // Resolve required permission: exact match first, then prefix match
    let requiredPermission = PERMISSIONS[basePath]?.[method] || null;
    if (!requiredPermission) {
      for (const [prefix, methods] of Object.entries(PERMISSION_PREFIXES)) {
        if (basePath.startsWith(prefix) && methods[method]) {
          requiredPermission = methods[method];
          break;
        }
      }
    }

    // Enforce permission if one is mapped
    if (requiredPermission) {
      const userPermissions = token.permissions || [];
      if (token.role !== "Sadmin" && !userPermissions.includes(requiredPermission)) {
        return NextResponse.json(
          { error: `Access denied. Required permission: ${requiredPermission}` },
          { status: 403 }
        );
      }
    }

    // Add session data to headers so API routes can access it
    // const requestHeaders = new Headers(request.headers);

    // Continue with the request
    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Only run middleware on API routes
export const config = {
  matcher: ["/api/:path*"],
};
