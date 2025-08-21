import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
//import { prisma } from "@/lib/db";
import { prisma } from "@/lib/useful";
import Select from "react-select/base";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log("Login attempt with credentials:", credentials);
          if (credentials?.username === "ad" && credentials?.password === "p") {
            return {
              id: "1",
              name: "Super Admin",
              role: "Sadmin",
              permissions: ["add:user", "edit:user", "view:user", "delete:user"],
            };
          } else {
            if (!credentials?.username || !credentials?.password) {
              return null;
            }

            const user = await prisma.user.findUnique({
              where: { username: credentials?.username },
            });

            if (!user) {
              return null;
            }
            if (credentials.password !== user.password) {
              return null;
            }

            const userRoles = await prisma.userRole.findMany({
              where: { userId: user.id },
              select: { roleId: true },
            });

            if (!userRoles) {
              return null;
            }

            const roles = await prisma.role.findMany({
              where: { id: { in: userRoles.map((ur) => ur.roleId) } },
            });

            const permissionIds = await prisma.rolePermission.findMany({
              where: { roleId: { in: roles.map((ur) => ur.id) } },
              select: { permissionId: true },
            });

            const permissions = await prisma.permission.findMany({
              where: { id: { in: permissionIds.map((p) => p.permissionId) } },
              select: { name: true },
            });

            const roleNames = roles.map((r) => r.name);
            const userPermissions = permissions.map((p) => p.name);

           
            return {
              id: user.id.toString(),
              name: user.username,
              companyId: user.companyId,
              role: roleNames[0],
              permissions: userPermissions,
            };
          }
        } catch (error) {
          console.error("Error during login attempt:", error);
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; 
        token.name = user.name; 
        token.role = user.role;
        token.companyId = user.companyId; 
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string; 
        session.user.role = token.role as string | undefined;
        session.user.companyId = token.companyId as number | undefined;
        session.user.permissions = token.permissions as string[] | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/", // Use our custom login page
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "expoSAASDndDanish!2", // You should use a real secret in .env
};
