const path = require("path")
const crypto = require("crypto")
const express = require("express")
const session = require("express-session")
const passport = require("passport")
const LocalStrategy = require("passport-local").Strategy
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")
require("dotenv").config()

const app = express()
const port = process.env.PORT || 3000
const uri = process.env.MONGO_URI
const sessionSecret = process.env.SESSION_SECRET || "class-app-dev-secret"

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
    console.log("Connected to MongoDB")
}

passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await db.collection("users").findOne({ username })

        if (!user) {
            return done(null, false, { message: "Incorrect username or password." })
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
            username: user.username
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
        sameSite: "lax",
        secure: false
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
            username: req.user.username
        }
    })
})

app.post("/api/signup", async (req, res, next) => {
    try {
        const username = req.body.username?.trim()
        const password = req.body.password

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required." })
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." })
        }

        const { hashedPassword, salt } = await hashPassword(password)
        const insertResult = await db.collection("users").insertOne({
            username,
            hashed_password: hashedPassword,
            salt,
            createdAt: Date.now()
        })

        const user = {
            _id: insertResult.insertedId,
            username
        }

        req.login(user, (error) => {
            if (error) {
                return next(error)
            }

            res.status(201).json({ user })
        })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "That username is already taken." })
        }

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
                    username: user.username
                }
            })
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
