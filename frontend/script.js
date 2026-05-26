const form = document.getElementById("new-post-form")
const authForm = document.getElementById("auth-form")
const authCard = document.getElementById("auth-card")
const postPanel = document.getElementById("post-panel")
const authSubmit = document.getElementById("auth-submit")
const authMessage = document.getElementById("auth-message")
const postMessage = document.getElementById("post-message")
const sessionStatus = document.getElementById("session-status")
const logoutButton = document.getElementById("logout-button")
const showLogin = document.getElementById("show-login")
const showSignup = document.getElementById("show-signup")
const baseURL = window.location.hostname.includes("github.io")
    ? "https://ingegni.onrender.com"
    : window.location.protocol === "file:"
        ? "http://localhost:3000"
        : ""

let authMode = "login"
let currentUser = null

const request = async (path, options = {}) => {
    const response = await fetch(`${baseURL}${path}`, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        },
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

    posts.forEach(post => {
        const newListItem = document.createElement("li")
        newListItem.className = "post"

        const postBody = document.createElement("p")
        postBody.className = "post-body"
        postBody.innerText = post.body

        const postMeta = document.createElement("div")
        postMeta.className = "post-meta"

        const usernameLabel = document.createElement("p")
        usernameLabel.innerText = post.author

        const timeLabel = document.createElement("p")
        timeLabel.innerText = formatPostAge(post.timecreated)

        postMeta.appendChild(usernameLabel)
        postMeta.appendChild(timeLabel)

        if (currentUser && post.authorId === currentUser._id) {
            const deleteButton = document.createElement("button")
            deleteButton.className = "delete-button"
            deleteButton.type = "button"
            deleteButton.innerText = "Delete"

            deleteButton.addEventListener("click", async () => {
                await request(`/api/posts/${post._id}`, { method: "DELETE" })
                getPosts()
            })

            postMeta.appendChild(deleteButton)
        }

        newListItem.appendChild(postBody)
        newListItem.appendChild(postMeta)
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
                password: authForm.elements.password.value
            })
        })

        currentUser = data.user
        authForm.reset()
        updateSessionUI()
        getPosts()
    } catch (error) {
        authMessage.innerText = error.message
    }
})

logoutButton.addEventListener("click", async () => {
    await request("/api/logout", { method: "POST" })
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
getSession().then(getPosts).catch(error => {
    sessionStatus.innerText = "Could not reach the server."
    authMessage.innerText = error.message
})
