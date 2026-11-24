import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

class InvalidLogin extends CredentialsSignin {
  code = "invalid_credentials";
}
class EmailNotVerified extends CredentialsSignin {
  code = "email_not_verified";
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

// A valid bcrypt hash of a random string, used to keep login timing uniform for unknown emails.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-real-password", 12);

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  providers: [
    ...(googleEnabled
      ? [
          Google({
            // Google verifies email ownership, so linking to an existing account with the same email is safe.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidLogin();
        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.passwordHash || !ok || user.isDisabled) throw new InvalidLogin();
        if (!user.emailVerified) throw new EmailNotVerified();
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      if (!token.uid) return token;
      // Re-validate against the database on every request so that disabling an account,
      // changing a role or resetting a password takes effect immediately.
      const dbUser = await db.user.findUnique({
        where: { id: token.uid },
        select: { role: true, isDisabled: true, sessionVersion: true, name: true, email: true, image: true },
      });
      if (!dbUser || dbUser.isDisabled) return null;
      if (user) token.sv = dbUser.sessionVersion;
      else if (token.sv !== dbUser.sessionVersion) return null;
      token.role = dbUser.role;
      token.name = dbUser.name;
      token.email = dbUser.email;
      token.picture = dbUser.image;
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid;
        session.user.role = token.role ?? "PLAYER";
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (!user.id) return;
      await db.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          // Google has already verified the email address.
          ...(account?.provider === "google" ? { emailVerified: new Date() } : {}),
        },
      });
    },
  },
});
