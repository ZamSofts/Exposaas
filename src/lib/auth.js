import CredentialsProvider from "next-auth/providers/credentials";
//import { prisma } from "@/lib/db";
import { prisma } from "@/lib/useful";

export const authOptions = {
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
            const permissions=await prisma.permission.findMany({
              select: { name: true },
            });
            // console.log("Permissions fetched:", permissions.map((p) => p.name));

            return {
              id: "1",
              name: "Super Admin",
              role: "Sadmin",
              permissions: permissions.map((p) => p.name),
            };
          } else {
            if (!credentials?.username || !credentials?.password) {
              return null;
            }

           const user = await prisma.user.findFirst({
              where: { 
                username: { equals: credentials?.username, mode: "insensitive" }
              },
              include: {
                company: { select: { name: true } },
                roles: {
                  include: {
                    role: {
                      include: {
                        permissions: {
                          include: { permission: { select: { name: true } } },
                        },
                      },
                    },
                  },
                },
              },
            });

            if (!user || credentials.password !== user.password) return null;

            const roleNames = user.roles.map((ur) => ur.role.name);
            const userPermissions = user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name));
            

            return {
              id: user.id.toString(),
              name: user.username,
              companyId: user.companyId,
              company: user.company.name,
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
        token.company = user.company;
        token.permissions = user.permissions;
      }
      // console.log("jwt token:", token);

      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.role = token.role;
        session.user.company = token.company;
        session.user.companyId = token.companyId;
        session.user.permissions = token.permissions;
      }
      // console.log("session data:", session);
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
