const form = document.getElementById("new-post-form")
const authForm = document.getElementById("auth-form")
const authCard = document.getElementById("auth-card")
const postPanel = document.getElementById("post-panel")
const authSubmit = document.getElementById("auth-submit")
const authMessage = document.getElementById("auth-message")
const postMessage = document.getElementById("post-message")
const postCount = document.getElementById("post-count")
const sessionStatus = document.getElementById("session-status")
const logoutButton = document.getElementById("logout-button")
const showLogin = document.getElementById("show-login")
const showSignup = document.getElementById("show-signup")
const authEmail = document.getElementById("auth-email")
const authEmailLabel = document.getElementById("auth-email-label")
const resendVerification = document.getElementById("resend-verification")
const googleLogin = document.getElementById("google-login")
const microsoftLogin = document.getElementById("microsoft-login")
const baseURL = window.location.hostname.includes("github.io")
    ? "https://ingegni.onrender.com"
    : window.location.protocol === "file:"
        ? "http://localhost:3000"
        : ""

const authTokenKey = "ingegni_auth_token"

let authMode = "login"
let currentUser = null
let authToken = localStorage.getItem(authTokenKey) || ""

const request = async (path, options = {}) => {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers
    }

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`
    }

    const response = await fetch(`${baseURL}${path}`, {
        credentials: "include",
        headers,
        ...options
    })

    if (response.status === 204) {
        return null
    }

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.message || "Request failed.")
    }

    return data
}

const setAuthMode = (mode) => {
    authMode = mode
    const isLogin = mode === "login"

    showLogin.classList.toggle("active", isLogin)
    showSignup.classList.toggle("active", !isLogin)
    authSubmit.innerText = isLogin ? "Log in" : "Sign up"
    authEmail.hidden = isLogin
    authEmailLabel.hidden = isLogin
    authEmail.required = !isLogin
    resendVerification.hidden = !isLogin
    googleLogin.hidden = !isLogin
    microsoftLogin.hidden = !isLogin
    authForm.elements.username.placeholder = isLogin ? "name@example.com" : "Choose a handle"
    authForm.elements.password.autocomplete = isLogin ? "current-password" : "new-password"
    authMessage.innerText = ""
}

const updateSessionUI = () => {
    if (currentUser) {
        sessionStatus.innerText = `Logged in as ${currentUser.username}`
        logoutButton.hidden = false
        authCard.hidden = true
        postPanel.hidden = false
        return
    }

    sessionStatus.innerText = "Log in or create an account to post."
    logoutButton.hidden = true
    authCard.hidden = false
    postPanel.hidden = true
}

const getSession = async () => {
    const data = await request("/api/me")
    currentUser = data.user
    updateSessionUI()
}

const getPosts = async () => {
    const posts = await request("/api/posts")
    addPostsToPage(posts)
    return posts
}

const getInitials = (name = "?") => {
    return name
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("") || "?"
}

const formatPostAge = (timecreated) => {
    const secondsSincePosted = Math.max(0, Math.round((Date.now() - timecreated) / 1000))
    let unitOfTime = "second"
    let numberOfUnits = secondsSincePosted

    if (numberOfUnits >= 60) {
        unitOfTime = "minute"
        numberOfUnits = Math.round(numberOfUnits / 60)
    }

    if (numberOfUnits >= 60) {
        unitOfTime = "hour"
        numberOfUnits = Math.round(numberOfUnits / 60)
    }

    if (numberOfUnits >= 24) {
        unitOfTime = "day"
        numberOfUnits = Math.round(numberOfUnits / 24)
    }

    return `posted ${numberOfUnits} ${unitOfTime}${numberOfUnits !== 1 ? "s" : ""} ago`
}

const addPostsToPage = (posts) => {
    const allPosts = document.getElementById("all-posts")
    allPosts.innerHTML = ""
    postCount.innerText = posts.length === 1 ? "1 note" : posts.length + " notes"

    if (posts.length === 0) {
        const emptyItem = document.createElement("li")
        emptyItem.className = "empty-state"
        emptyItem.innerHTML = "<strong>No notes yet.</strong><span>Your first saved idea will appear here.</span>"
        allPosts.appendChild(emptyItem)
        return
    }

    posts.forEach(post => {
        const newListItem = document.createElement("li")
        newListItem.className = "post"

        const avatar = document.createElement("div")
        avatar.className = "post-avatar"
        avatar.innerText = getInitials(post.author)

        const postContent = document.createElement("article")
        postContent.className = "post-content"

        const postHeader = document.createElement("div")
        postHeader.className = "post-header"

        const authorGroup = document.createElement("div")

        const usernameLabel = document.createElement("p")
        usernameLabel.className = "post-author"
        usernameLabel.innerText = post.author

        const timeLabel = document.createElement("p")
        timeLabel.className = "post-time"
        timeLabel.innerText = formatPostAge(post.timecreated)

        authorGroup.appendChild(usernameLabel)
        authorGroup.appendChild(timeLabel)
        postHeader.appendChild(authorGroup)

        if (currentUser && post.authorId === currentUser._id) {
            const deleteButton = document.createElement("button")
            deleteButton.className = "delete-button"
            deleteButton.type = "button"
            deleteButton.innerText = "Remove"

            deleteButton.addEventListener("click", async () => {
                await request(`/api/posts/${post._id}`, { method: "DELETE" })
                getPosts()
            })

            postHeader.appendChild(deleteButton)
        }

        const postBody = document.createElement("p")
        postBody.className = "post-body"
        postBody.innerText = post.body

        postContent.appendChild(postHeader)
        postContent.appendChild(postBody)

        newListItem.appendChild(avatar)
        newListItem.appendChild(postContent)
        allPosts.appendChild(newListItem)
    })
}

showLogin.addEventListener("click", () => setAuthMode("login"))
showSignup.addEventListener("click", () => setAuthMode("signup"))

authForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    authMessage.innerText = ""

    try {
        const data = await request(`/api/${authMode}`, {
            method: "POST",
            body: JSON.stringify({
                username: authForm.elements.username.value,
                email: authForm.elements.email.value,
                password: authForm.elements.password.value
            })
        })

        if (authMode === "signup") {
            authForm.reset()
            setAuthMode("login")
            authMessage.innerText = data.message || "Check your email to verify your account before logging in."
            return
        }

        authToken = data.token || ""
        if (authToken) {
            localStorage.setItem(authTokenKey, authToken)
        }

        currentUser = data.user
        authForm.reset()
        updateSessionUI()
        getPosts()
    } catch (error) {
        authMessage.innerText = error.message
    }
})

googleLogin.addEventListener("click", () => {
    window.location.href = baseURL + "/auth/google"
})

microsoftLogin.addEventListener("click", () => {
    window.location.href = baseURL + "/auth/microsoft"
})

resendVerification.addEventListener("click", async () => {
    authMessage.innerText = ""

    try {
        const data = await request("/api/resend-verification", {
            method: "POST",
            body: JSON.stringify({
                email: authForm.elements.username.value
            })
        })

        authMessage.innerText = data.message
    } catch (error) {
        authMessage.innerText = error.message
    }
})

logoutButton.addEventListener("click", async () => {
    await request("/api/logout", { method: "POST" })
    authToken = ""
    localStorage.removeItem(authTokenKey)
    currentUser = null
    updateSessionUI()
    getPosts()
})

form.addEventListener("submit", async (event) => {
    event.preventDefault()
    postMessage.innerText = ""

    try {
        await request("/api/posts", {
            method: "POST",
            body: JSON.stringify({
                body: form.elements.body.value
            })
        })

        form.reset()
        getPosts()
    } catch (error) {
        postMessage.innerText = error.message
    }
})

setAuthMode("login")

const queryParams = new URLSearchParams(window.location.search)
const oauthToken = queryParams.get("token")

if (oauthToken) {
    authToken = oauthToken
    localStorage.setItem(authTokenKey, oauthToken)
    queryParams.delete("token")
    const cleanQuery = queryParams.toString()
    const cleanURL = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : "") + window.location.hash
    window.history.replaceState({}, document.title, cleanURL)
}

if (queryParams.get("verified") === "1") {
    authMessage.innerText = "Email verified. You can log in now."
}

if (queryParams.get("login") === "google") {
    authMessage.innerText = "Signed in with Google."
}

if (queryParams.get("login") === "microsoft") {
    authMessage.innerText = "Signed in with Microsoft."
}

if (queryParams.get("login") === "failed") {
    authMessage.innerText = "Sign-in did not complete."
}

if (queryParams.get("login") === "microsoft_failed") {
    authMessage.innerText = "Microsoft sign-in did not complete. Check the Render logs for the callback error."
}

getSession().then(getPosts).catch(error => {
    sessionStatus.innerText = "Could not reach the server."
    authMessage.innerText = error.message
})
