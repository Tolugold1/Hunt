import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Only imports auth.config — no pg/Prisma, safe for Edge Runtime
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
