const path = require("path")
const crypto = require("crypto")
const express = require("express")
const session = require("express-session")
const passport = require("passport")
const LocalStrategy = require("passport-local").Strategy
const GoogleStrategy = require("passport-google-oauth20").Strategy
const MicrosoftStrategy = require("passport-microsoft").Strategy
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")
require("dotenv").config()

const app = express()

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1)
}
function envValue(name, fallback = "") {
    return (process.env[name] || fallback).trim()
}

const port = process.env.PORT || 3000
const uri = envValue("MONGO_URI")
const sessionSecret = envValue("SESSION_SECRET", "class-app-dev-secret")
const isProduction = process.env.NODE_ENV === "production"
const frontendURL = envValue("FRONTEND_URL", isProduction ? "https://buchanz.github.io/ingegni/" : "http://localhost:3000")
const apiPublicURL = envValue("API_PUBLIC_URL", isProduction ? "https://ingegni.onrender.com" : "http://localhost:3000")
const resendAPIKey = envValue("RESEND_API_KEY")
const resendFromEmail = envValue("RESEND_FROM_EMAIL", "Ingegni <onboarding@resend.dev>")
const verificationTokenTTL = 1000 * 60 * 60 * 24
const googleClientID = envValue("GOOGLE_CLIENT_ID")
const googleClientSecret = envValue("GOOGLE_CLIENT_SECRET")
const googleCallbackURL = envValue("GOOGLE_CALLBACK_URL", apiPublicURL + "/auth/google/callback")
const microsoftClientID = envValue("MICROSOFT_CLIENT_ID")
const microsoftClientSecret = envValue("MICROSOFT_CLIENT_SECRET")
const microsoftCallbackURL = envValue("MICROSOFT_CALLBACK_URL", apiPublicURL + "/auth/microsoft/callback")

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})

let db

function hashPassword(password, salt = crypto.randomBytes(16)) {
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, 310000, 32, "sha256", (err, hashedPassword) => {
            if (err) {
                reject(err)
                return
            }

            resolve({
                hashedPassword: hashedPassword.toString("base64"),
                salt: salt.toString("base64")
            })
        })
    })
}

async function verifyPassword(password, user) {
    const salt = Buffer.from(user.salt, "base64")
    const { hashedPassword } = await hashPassword(password, salt)
    return crypto.timingSafeEqual(
        Buffer.from(hashedPassword, "base64"),
        Buffer.from(user.hashed_password, "base64")
    )
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex")
}

function createVerificationToken() {
    const token = crypto.randomBytes(32).toString("hex")

    return {
        token,
        tokenHash: hashToken(token),
        expiresAt: Date.now() + verificationTokenTTL
    }
}

async function sendVerificationEmail(user, token) {
    const verificationURL = apiPublicURL + "/api/verify-email?token=" + token

    if (!resendAPIKey) {
        console.log("Email verification link for " + user.email + ": " + verificationURL)
        return
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + resendAPIKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: resendFromEmail,
            to: [user.email],
            subject: "Verify your Ingegni account",
            html: [
                "<h1>Verify your Ingegni account</h1>",
                "<p>Click the link below to finish creating your account.</p>",
                "<p><a href=\"" + verificationURL + "\">Verify email address</a></p>",
                "<p>This link expires in 24 hours.</p>"
            ].join(""),
            text: "Verify your Ingegni account: " + verificationURL
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error("Resend email failed: " + errorText)
    }
}

function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        next()
        return
    }

    res.status(401).json({ message: "You must be logged in to do that." })
}

async function connectDB() {
    await client.connect()
    db = client.db(process.env.MONGO_DB_NAME)
    await db.collection("users").createIndex({ username: 1 }, { unique: true })
    await db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true })
    await db.collection("users").createIndex({ verificationTokenHash: 1 })
    console.log("Connected to MongoDB")
}

async function findOrCreateOAuthUser({ provider, providerId, email, displayName }) {
    const providerIdField = provider + "Id"
    const existingUser = await db.collection("users").findOne({
        $or: [
            { [providerIdField]: providerId },
            { email }
        ]
    })

    if (existingUser) {
        await db.collection("users").updateOne(
            { _id: existingUser._id },
            {
                $set: {
                    [providerIdField]: providerId,
                    email,
                    emailVerified: true,
                    authProvider: existingUser.authProvider || provider
                },
                $unset: { verificationTokenHash: "", verificationExpiresAt: "" }
            }
        )

        return {
            ...existingUser,
            [providerIdField]: providerId,
            email,
            emailVerified: true
        }
    }

    const baseUsername = (displayName || email.split("@")[0])
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 24) || provider + "user"
    let username = baseUsername
    let suffix = 1

    while (await db.collection("users").findOne({ username })) {
        username = baseUsername + suffix
        suffix += 1
    }

    const insertResult = await db.collection("users").insertOne({
        username,
        email,
        emailVerified: true,
        [providerIdField]: providerId,
        authProvider: provider,
        createdAt: Date.now()
    })

    return {
        _id: insertResult.insertedId,
        username,
        email,
        emailVerified: true
    }
}

if (googleClientID && googleClientSecret) {
    passport.use(new GoogleStrategy({
        clientID: googleClientID,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackURL
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value?.toLowerCase()

            if (!email) {
                return done(null, false, { message: "Google account did not provide an email address." })
            }

            const user = await findOrCreateOAuthUser({
                provider: "google",
                providerId: profile.id,
                email,
                displayName: profile.displayName
            })

            done(null, user)
        } catch (error) {
            done(error)
        }
    }))
}

if (microsoftClientID && microsoftClientSecret) {
    passport.use(new MicrosoftStrategy({
        clientID: microsoftClientID,
        clientSecret: microsoftClientSecret,
        callbackURL: microsoftCallbackURL,
        scope: ["user.read"],
        includeUPN: true
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = (profile.emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName || "").toLowerCase()

            if (!email) {
                return done(null, false, { message: "Microsoft account did not provide an email address." })
            }

            const user = await findOrCreateOAuthUser({
                provider: "microsoft",
                providerId: profile.id,
                email,
                displayName: profile.displayName
            })

            done(null, user)
        } catch (error) {
            done(error)
        }
    }))
}

passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const login = username.toLowerCase()
        const user = await db.collection("users").findOne({
            $or: [
                { username },
                { email: login }
            ]
        })

        if (!user || !user.hashed_password || !user.salt) {
            return done(null, false, { message: "Incorrect username or password." })
        }

        if (user.email && !user.emailVerified) {
            return done(null, false, { message: "Please verify your email before logging in." })
        }

        const passwordIsValid = await verifyPassword(password, user)

        if (!passwordIsValid) {
            return done(null, false, { message: "Incorrect username or password." })
        }

        return done(null, user)
    } catch (error) {
        return done(error)
    }
}))

passport.serializeUser((user, done) => {
    done(null, user._id.toString())
})

passport.deserializeUser(async (id, done) => {
    try {
        const user = await db.collection("users").findOne({ _id: new ObjectId(id) })

        if (!user) {
            return done(null, false)
        }

        done(null, {
            _id: user._id,
            username: user.username,
            email: user.email,
            emailVerified: Boolean(user.emailVerified)
        })
    } catch (error) {
        done(error)
    }
})

app.use(express.json())
app.use(express.static(path.join(__dirname, "../frontend")))
app.use((req, res, next) => {
    const allowedOrigins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://buchanz.github.io",
        "null"
    ]
    const origin = req.headers.origin

    if (allowedOrigins.includes(origin)) {
        res.set("Access-Control-Allow-Origin", origin)
    }

    res.set("Access-Control-Allow-Credentials", "true")

    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE")
        res.set("Access-Control-Allow-Headers", "Content-Type")
        return res.sendStatus(204)
    }

    next()
})
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction
    }
}))
app.use(passport.initialize())
app.use(passport.session())

app.get("/api/health", (req, res) => {
    res.json({ message: "The server is running." })
})

app.get("/api/me", (req, res) => {
    if (!req.user) {
        return res.json({ user: null })
    }

    res.json({
        user: {
            _id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            emailVerified: req.user.emailVerified
        }
    })
})

app.post("/api/signup", async (req, res, next) => {
    try {
        const username = req.body.username?.trim()
        const email = req.body.email?.trim().toLowerCase()
        const password = req.body.password

        if (!username || !email || !password) {
            return res.status(400).json({ message: "Username, email, and password are required." })
        }

        if (!email.includes("@")) {
            return res.status(400).json({ message: "Please enter a valid email address." })
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." })
        }

        const { hashedPassword, salt } = await hashPassword(password)
        const verification = createVerificationToken()
        const insertResult = await db.collection("users").insertOne({
            username,
            email,
            emailVerified: false,
            verificationTokenHash: verification.tokenHash,
            verificationExpiresAt: verification.expiresAt,
            hashed_password: hashedPassword,
            salt,
            authProvider: "local",
            createdAt: Date.now()
        })

        await sendVerificationEmail({ email }, verification.token)

        res.status(201).json({
            message: "Account created. Check your email to verify your account before logging in.",
            user: {
                _id: insertResult.insertedId,
                username,
                email,
                emailVerified: false
            }
        })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "That username or email is already taken." })
        }

        next(error)
    }
})

app.get("/api/verify-email", async (req, res, next) => {
    try {
        const token = req.query.token

        if (!token) {
            return res.status(400).send("Missing verification token.")
        }

        const user = await db.collection("users").findOne({
            verificationTokenHash: hashToken(token),
            verificationExpiresAt: { $gt: Date.now() }
        })

        if (!user) {
            return res.status(400).send("This verification link is invalid or expired.")
        }

        await db.collection("users").updateOne(
            { _id: user._id },
            {
                $set: { emailVerified: true, verifiedAt: Date.now() },
                $unset: { verificationTokenHash: "", verificationExpiresAt: "" }
            }
        )

        res.redirect(frontendURL + "?verified=1")
    } catch (error) {
        next(error)
    }
})

app.post("/api/resend-verification", async (req, res, next) => {
    try {
        const email = req.body.email?.trim().toLowerCase()

        if (!email) {
            return res.status(400).json({ message: "Email is required." })
        }

        const user = await db.collection("users").findOne({ email })

        if (!user || user.emailVerified) {
            return res.json({ message: "If that account needs verification, a new email has been sent." })
        }

        const verification = createVerificationToken()
        await db.collection("users").updateOne(
            { _id: user._id },
            {
                $set: {
                    verificationTokenHash: verification.tokenHash,
                    verificationExpiresAt: verification.expiresAt
                }
            }
        )

        await sendVerificationEmail(user, verification.token)
        res.json({ message: "If that account needs verification, a new email has been sent." })
    } catch (error) {
        next(error)
    }
})

app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (error, user, info) => {
        if (error) {
            return next(error)
        }

        if (!user) {
            return res.status(401).json({ message: info?.message || "Login failed." })
        }

        req.login(user, (loginError) => {
            if (loginError) {
                return next(loginError)
            }

            res.json({
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    emailVerified: Boolean(user.emailVerified)
                }
            })
        })
    })(req, res, next)
})

app.get("/auth/google", (req, res, next) => {
    if (!googleClientID || !googleClientSecret) {
        return res.status(503).send("Google OAuth is not configured yet.")
    }

    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next)
})

app.get("/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", { failureRedirect: frontendURL + "?login=failed" }, (error, user) => {
        if (error) {
            return next(error)
        }

        if (!user) {
            return res.redirect(frontendURL + "?login=failed")
        }

        req.login(user, (loginError) => {
            if (loginError) {
                return next(loginError)
            }

            res.redirect(frontendURL + "?login=google")
        })
    })(req, res, next)
})

app.get("/auth/microsoft", (req, res, next) => {
    if (!microsoftClientID || !microsoftClientSecret) {
        return res.status(503).send("Microsoft OAuth is not configured yet.")
    }

    passport.authenticate("microsoft")(req, res, next)
})

app.get("/auth/microsoft/callback", (req, res, next) => {
    passport.authenticate("microsoft", { failureRedirect: frontendURL + "?login=failed" }, (error, user) => {
        if (error) {
            return next(error)
        }

        if (!user) {
            return res.redirect(frontendURL + "?login=failed")
        }

        req.login(user, (loginError) => {
            if (loginError) {
                return next(loginError)
            }

            res.redirect(frontendURL + "?login=microsoft")
        })
    })(req, res, next)
})

app.post("/api/logout", (req, res, next) => {
    req.logout((error) => {
        if (error) {
            return next(error)
        }

        res.json({ message: "Logged out." })
    })
})

app.get("/api/posts", async (req, res, next) => {
    try {
        const posts = await db.collection("posts").find().sort({ timecreated: -1 }).toArray()
        res.json(posts)
    } catch (error) {
        next(error)
    }
})

app.post("/api/posts", requireAuth, async (req, res, next) => {
    try {
        const body = req.body.body?.trim()

        if (!body) {
            return res.status(400).json({ message: "Post body is required." })
        }

        const newPost = {
            body,
            author: req.user.username,
            authorId: req.user._id,
            timecreated: Date.now()
        }

        const insertResult = await db.collection("posts").insertOne(newPost)

        res.status(201).json({
            _id: insertResult.insertedId,
            ...newPost
        })
    } catch (error) {
        next(error)
    }
})

app.delete("/api/posts/:id", requireAuth, async (req, res, next) => {
    try {
        const result = await db.collection("posts").deleteOne({
            _id: new ObjectId(req.params.id),
            authorId: req.user._id
        })

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Post not found." })
        }

        res.sendStatus(204)
    } catch (error) {
        next(error)
    }
})

app.use((error, req, res, next) => {
    console.error(error)
    res.status(500).json({ message: "Something went wrong on the server." })
})

async function startServer() {
    try {
        await connectDB()
        app.listen(port, () => {
            console.log(`Server running on port ${port}`)
        })
    } catch (error) {
        console.log("Failed to start server.", error)
        process.exit(1)
    }
}

startServer()
