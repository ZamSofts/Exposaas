import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/useful";
import { verifyPassword, hashPassword } from "@/lib/password";

if (!process.env.NEXTAUTH_SECRET && typeof window === "undefined") {
  console.error(
    "WARNING: NEXTAUTH_SECRET environment variable is not set. " +
    "Generate one with: openssl rand -base64 32"
  );
}

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
          const sadminUser = process.env.SADMIN_USERNAME;
          const sadminPass = process.env.SADMIN_PASSWORD;
          if (sadminUser && sadminPass &&
              credentials?.username === sadminUser &&
              credentials?.password === sadminPass) {
            const permissions=await prisma.permission.findMany({
              select: { name: true },
            });

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

            if (!user) return null;
            const { valid, needsRehash } = await verifyPassword(credentials.password, user.password);
            if (!valid) return null;

            // Auto-rehash legacy plaintext passwords on successful login
            if (needsRehash) {
              const hashed = await hashPassword(credentials.password);
              await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
            }

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
  secret: process.env.NEXTAUTH_SECRET,
};
