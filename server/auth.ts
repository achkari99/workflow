import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import connectPg from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { authStorage } from "./authStorage";
import { type User as SelectUser } from "@shared/models/auth";

declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const PostgresStore = connectPg(session);
const sessionStore = new PostgresStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: true,
  tableName: "sessions",
});

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "world-class-designer-secret",
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: sessionTtl,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
});

function enforceSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin") || req.get("referer");
  const host = req.get("host");
  if (!origin || !host) return res.status(403).json({ message: "CSRF protection: missing origin" });
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return res.status(403).json({ message: "CSRF protection: invalid origin" });
    }
  } catch {
    return res.status(403).json({ message: "CSRF protection: invalid origin" });
  }
  next();
}

export async function setupAuth(app: Express) {
  app.use(sessionMiddleware);

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(enforceSameOrigin);

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await authStorage.getUserByUsername(username);
        if (!user || user.password === null) {
          return done(null, false, { message: "Invalid username or password" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await authStorage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", authLimiter, async (req, res) => {
    try {
      const { username, password, email, firstName, lastName } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const existingUser = await authStorage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await authStorage.createUser({
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration Error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", authLimiter, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Login failed" });
      req.login(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  app.get("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const user = await authStorage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Profile Fetch Error:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.patch("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { firstName, lastName, email, username, profileImageUrl } = req.body || {};
    const updates: Partial<Pick<SelectUser, "firstName" | "lastName" | "email" | "username" | "profileImageUrl">> = {};

    if (typeof firstName === "string") updates.firstName = firstName || null;
    if (typeof lastName === "string") updates.lastName = lastName || null;
    if (typeof email === "string") updates.email = email || null;
    if (typeof username === "string") updates.username = username || null;
    if (typeof profileImageUrl === "string") updates.profileImageUrl = profileImageUrl || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    try {
      const user = await authStorage.updateUser(req.user!.id, updates);
      res.json(user);
    } catch (error) {
      console.error("Profile Update Error:", error);
      res.status(400).json({ message: "Profile update failed" });
    }
  });
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}
