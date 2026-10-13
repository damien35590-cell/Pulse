import { createHash, timingSafeEqual } from "crypto";
import { getServerSession, type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** App personnelle : une seule personne, définie par ALLOWED_EMAIL, se connecte avec APP_PASSWORD (ou Google si configuré). */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 90 }, // 90 jours : on reste connecté sur le téléphone
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Mot de passe",
      credentials: { password: { label: "Mot de passe", type: "password" } },
      async authorize(c) {
        const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase(), pw = process.env.APP_PASSWORD?.trim(); // trim : tolère un espace ou un retour à la ligne collé par erreur
        if (!email || !pw || !c?.password || !same(c.password.trim(), pw)) { await new Promise((r) => setTimeout(r, 800)); return null; } // frein contre les essais en rafale
        const u = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name: email.split("@")[0] } });
        return { id: u.id, email: u.email, name: u.name };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                scope:
                  "openid profile email https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.location.read",
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    signIn({ user }) { const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase(); return !!allowed && user.email?.toLowerCase() === allowed; },
    jwt({ token, user, account }) {
      if (user) token.uid = user.id;
      if (account?.access_token) token.accessToken = account.access_token;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.uid as string;
      return session;
    },
  },
};

export const auth = () => getServerSession(authOptions);