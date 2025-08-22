import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string; // required so you can rely on it
      email?: string; // optional if Super Admin may not have one
      image?: string; // optional if Super Admin may not have one
      companyId?: number; 
      company?:string// optional if Super Admin may not have one
      role?: string;
      permissions?: string[];
    } & DefaultSession["user"]; // keeps name/email/image optional as before
  }

  interface User extends DefaultUser {
    id: string;
    name: string; // yaou return a string id in authorize()
    companyId?: number;
    company?:string
    role?: string;
    permissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name: string; // required so you can rely on it
    email?: string; // optional if Super Admin may not have one
    image?: string; // optional if Super Admin may not have one
    companyId?: number;
    company?:string
    role?: string;
    permissions?: string[];
  }
}
