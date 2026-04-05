import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        // Auto-create user if not exists
        const existing = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (!existing) {
          const newUser = await prisma.user.create({
            data: {
              name: user.name || "User",
              email: user.email!,
              password: "", // Google users don't have password
            },
          });

          // Seed default categories
          await prisma.category.createMany({
            data: [
              { name: "Lương", type: "INCOME", icon: "Wallet", color: "#22c55e", isDefault: true, userId: newUser.id },
              { name: "Thu nhập khác", type: "INCOME", icon: "TrendingUp", color: "#06b6d4", isDefault: true, userId: newUser.id },
              { name: "Tiền nhà", type: "INCOME", icon: "Home", color: "#f59e0b", isDefault: true, userId: newUser.id },
              { name: "Ăn uống", type: "EXPENSE", icon: "UtensilsCrossed", color: "#ef4444", isDefault: true, userId: newUser.id },
              { name: "Di chuyển", type: "EXPENSE", icon: "Car", color: "#8b5cf6", isDefault: true, userId: newUser.id },
              { name: "Mua sắm", type: "EXPENSE", icon: "ShoppingBag", color: "#ec4899", isDefault: true, userId: newUser.id },
              { name: "Hóa đơn", type: "EXPENSE", icon: "Receipt", color: "#f97316", isDefault: true, userId: newUser.id },
              { name: "Giải trí", type: "EXPENSE", icon: "Gamepad2", color: "#06b6d4", isDefault: true, userId: newUser.id },
              { name: "Sức khỏe", type: "EXPENSE", icon: "Heart", color: "#14b8a6", isDefault: true, userId: newUser.id },
              { name: "Khác", type: "EXPENSE", icon: "MoreHorizontal", color: "#6b7280", isDefault: true, userId: newUser.id },
            ],
          });

          user.id = newUser.id;
        } else {
          user.id = existing.id;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
