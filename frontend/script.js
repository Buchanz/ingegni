const form = document.getElementById("new-post-form")
const noteForm = document.getElementById("new-note-form")
const authForm = document.getElementById("auth-form")
const usernameForm = document.getElementById("username-form")
const authCard = document.getElementById("auth-card")
const authVisual = document.getElementById("auth-visual")
const homeScreen = document.getElementById("home-screen")
const postPanel = document.getElementById("post-panel")
const notesPanel = document.getElementById("notes-panel")
const profileView = document.getElementById("profile-view")
const homeUsername = document.getElementById("home-username")
const usernameSetup = document.getElementById("username-setup")
const usernameMessage = document.getElementById("username-message")
const authSubmit = document.getElementById("auth-submit")
const authMessage = document.getElementById("auth-message")
const postMessage = document.getElementById("post-message")
const noteMessage = document.getElementById("note-message")
const postCount = document.getElementById("post-count")
const noteCount = document.getElementById("note-count")
const sessionStatus = document.getElementById("session-status")
const profileButton = document.getElementById("profile-button")
const profileInitials = document.getElementById("profile-initials")
const settingsView = document.getElementById("settings-view")
const accountSettingsForm = document.getElementById("account-settings-form")
const passwordSettingsForm = document.getElementById("password-settings-form")
const settingsAvatarPreview = document.getElementById("settings-avatar-preview")
const settingsMessage = document.getElementById("settings-message")
const passwordMessage = document.getElementById("password-message")
const backFromSettings = document.getElementById("back-from-settings")
const settingsViewProfile = document.getElementById("settings-view-profile")
const settingsLogoutButton = document.getElementById("settings-logout-button")
const showLogin = document.getElementById("show-login")
const showSignup = document.getElementById("show-signup")
const authUsernameLabel = document.getElementById("auth-username-label")
const authEmail = document.getElementById("auth-email")
const authEmailLabel = document.getElementById("auth-email-label")
const resendVerification = document.getElementById("resend-verification")
const googleLogin = document.getElementById("google-login")
const microsoftLogin = document.getElementById("microsoft-login")
const appleLogin = document.getElementById("apple-login")
const userSearchForm = document.getElementById("user-search-form")
const userSearch = document.getElementById("user-search")
const userSearchResults = document.getElementById("user-search-results")
const backToFeed = document.getElementById("back-to-feed")
const profileTitle = document.getElementById("profile-title")
const profileMeta = document.getElementById("profile-meta")
const profileAvatar = document.getElementById("profile-avatar")
const profilePosts = document.getElementById("profile-posts")
const baseURL = window.location.hostname.includes("github.io")
    ? "https://ingegni.onrender.com"
    : window.location.protocol === "file:"
        ? "http://localhost:3000"
        : ""

const authTokenKey = "proxima_auth_token"
const oldAuthTokenKey = "ingegni_auth_token"
const storedToken = localStorage.getItem(authTokenKey) || localStorage.getItem(oldAuthTokenKey) || ""

let authMode = "login"
let currentUser = null
let authToken = storedToken
let searchTimer = null
let activeProfileUsername = ""

if (storedToken && !localStorage.getItem(authTokenKey)) {
    localStorage.setItem(authTokenKey, storedToken)
}

const request = async (path, options = {}) => {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers
    }

    if (authToken) {
        headers.Authorization = "Bearer " + authToken
    }

    const response = await fetch(baseURL + path, {
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
    authSubmit.innerText = isLogin ? "Continue" : "Create account"
    authEmail.hidden = isLogin
    authEmailLabel.hidden = isLogin
    authEmail.required = !isLogin
    resendVerification.hidden = false
    googleLogin.hidden = false
    microsoftLogin.hidden = false
    authUsernameLabel.innerText = isLogin ? "Username or email" : "Username"
    authForm.elements.username.placeholder = isLogin ? "Email or username" : "Username"
    authForm.elements.email.placeholder = "Email"
    authForm.elements.password.placeholder = "Password"
    authForm.elements.password.autocomplete = isLogin ? "current-password" : "new-password"
    authMessage.innerText = ""
}

const closeSearchResults = () => {
    userSearchResults.innerHTML = ""
    userSearchResults.hidden = true
}

const showHomeFeed = () => {
    const needsUsername = Boolean(currentUser?.needsUsername)
    activeProfileUsername = ""
    profileView.hidden = true
    settingsView.hidden = true
    homeScreen.hidden = needsUsername || !currentUser
    postPanel.hidden = needsUsername || !currentUser
    closeSearchResults()
}

const updateSessionUI = () => {
    document.body.classList.toggle("is-authenticated", Boolean(currentUser))
    document.body.classList.toggle("is-auth-page", !currentUser)

    if (currentUser) {
        const displayName = currentUser.username || currentUser.email || "creator"
        const needsUsername = Boolean(currentUser.needsUsername)

        sessionStatus.innerText = needsUsername ? "Choose a username" : "@" + displayName
        renderAvatar(profileInitials, displayName, currentUser.profilePicture)
        profileButton.hidden = needsUsername
        userSearchForm.hidden = needsUsername
        authCard.hidden = true
        authVisual.hidden = true
        usernameSetup.hidden = !needsUsername
        homeScreen.hidden = needsUsername
        postPanel.hidden = needsUsername
        notesPanel.hidden = true
        profileView.hidden = true
        settingsView.hidden = true
        return
    }

    sessionStatus.innerText = "Log in to post and search users."
    profileButton.hidden = true
    userSearchForm.hidden = true
    authCard.hidden = false
    authVisual.hidden = false
    usernameSetup.hidden = true
    homeScreen.hidden = true
    postPanel.hidden = true
    notesPanel.hidden = true
    profileView.hidden = true
    settingsView.hidden = true
    closeSearchResults()
}

const getSession = async () => {
    const data = await request("/api/me")
    currentUser = data.user

    if (!currentUser && authToken) {
        authToken = ""
        localStorage.removeItem(authTokenKey)
        localStorage.removeItem(oldAuthTokenKey)
    }

    updateSessionUI()
}

const getPosts = async () => {
    const posts = await request("/api/posts")
    addPostsToPage(posts)
    return posts
}

const getNotes = async () => {
    if (!noteForm || !currentUser) {
        addNotesToPage([])
        return []
    }

    const notes = await request("/api/notes")
    addNotesToPage(notes)
    return notes
}


const normalizeUsernameInput = (value) => String(value || "").trim().toLowerCase()

const getSignupUsername = () => {
    const username = normalizeUsernameInput(authForm.elements.username.value)

    if (!username) {
        authMessage.innerText = "Choose a username before creating an account."
        return ""
    }

    if (!/^[a-z0-9_.]{3,24}$/.test(username) || username.startsWith(".") || username.endsWith(".")) {
        authMessage.innerText = "Username must be 3-24 characters and can only use letters, numbers, underscores, or periods."
        return ""
    }

    return username
}

const renderAvatar = (element, label = "P", imageURL = "") => {
    element.innerHTML = ""
    element.style.backgroundImage = ""

    if (imageURL) {
        const image = document.createElement("img")
        image.src = imageURL
        image.alt = ""
        image.loading = "lazy"
        element.appendChild(image)
        return
    }

    element.innerText = getInitials(label)
}

const populateSettingsForm = () => {
    if (!currentUser) return

    accountSettingsForm.elements.username.value = currentUser.username || ""
    accountSettingsForm.elements.email.value = currentUser.email || ""
    accountSettingsForm.elements.profilePicture.value = currentUser.profilePicture || ""
    renderAvatar(settingsAvatarPreview, currentUser.username || currentUser.email || "P", currentUser.profilePicture)
}

const showSettingsView = () => {
    if (!currentUser || currentUser.needsUsername) return

    closeSearchResults()
    activeProfileUsername = ""
    populateSettingsForm()
    homeScreen.hidden = true
    postPanel.hidden = true
    notesPanel.hidden = true
    profileView.hidden = true
    settingsView.hidden = false
    window.scrollTo({ top: 0, behavior: "smooth" })
}

const startProviderAuth = (provider) => {
    authMessage.innerText = ""
    const username = authMode === "signup" ? getSignupUsername() : ""

    if (authMode === "signup" && !username) {
        return
    }

    const params = new URLSearchParams({ mode: authMode })

    if (username) {
        params.set("username", username)
    }

    window.location.href = baseURL + "/auth/" + provider + "?" + params.toString()
}

const getInitials = (name = "?") => {
    return name
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("") || "?"
}

const formatAge = (timecreated) => {
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

    return numberOfUnits + " " + unitOfTime + (numberOfUnits !== 1 ? "s" : "") + " ago"
}

const createPostElement = (post, afterDelete) => {
    const newListItem = document.createElement("li")
    newListItem.className = "post"

    const avatar = document.createElement("button")
    avatar.className = "post-avatar"
    avatar.type = "button"
    renderAvatar(avatar, post.author, post.authorProfilePicture)
    avatar.setAttribute("aria-label", "Open " + post.author + " profile")
    avatar.addEventListener("click", () => loadUserProfile(post.author))

    const postContent = document.createElement("article")
    postContent.className = "post-content"

    const postHeader = document.createElement("div")
    postHeader.className = "post-header"

    const authorGroup = document.createElement("div")

    const usernameLabel = document.createElement("button")
    usernameLabel.className = "post-author"
    usernameLabel.type = "button"
    usernameLabel.innerText = "@" + post.author
    usernameLabel.addEventListener("click", () => loadUserProfile(post.author))

    const timeLabel = document.createElement("p")
    timeLabel.className = "post-time"
    timeLabel.innerText = formatAge(post.timecreated)

    authorGroup.appendChild(usernameLabel)
    authorGroup.appendChild(timeLabel)
    postHeader.appendChild(authorGroup)

    if (currentUser && post.authorId === currentUser._id) {
        const deleteButton = document.createElement("button")
        deleteButton.className = "delete-button"
        deleteButton.type = "button"
        deleteButton.innerText = "Remove"

        deleteButton.addEventListener("click", async () => {
            await request("/api/posts/" + post._id, { method: "DELETE" })
            afterDelete()
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
    return newListItem
}

const addPostsToPage = (posts) => {
    const allPosts = document.getElementById("all-posts")
    allPosts.innerHTML = ""
    postCount.innerText = posts.length === 1 ? "1 post" : posts.length + " posts"

    if (posts.length === 0) {
        const emptyItem = document.createElement("li")
        emptyItem.className = "empty-state"
        emptyItem.innerHTML = "<strong>No posts yet.</strong><span>Be the first person to share something on Proxima.</span>"
        allPosts.appendChild(emptyItem)
        return
    }

    posts.forEach(post => {
        allPosts.appendChild(createPostElement(post, getPosts))
    })
}

const addProfilePostsToPage = (posts) => {
    profilePosts.innerHTML = ""

    if (posts.length === 0) {
        const emptyItem = document.createElement("li")
        emptyItem.className = "empty-state"
        emptyItem.innerHTML = "<strong>No posts here yet.</strong><span>This profile has not posted anything publicly.</span>"
        profilePosts.appendChild(emptyItem)
        return
    }

    posts.forEach(post => {
        profilePosts.appendChild(createPostElement(post, () => loadUserProfile(activeProfileUsername)))
    })
}

const addNotesToPage = (notes) => {
    const allNotes = document.getElementById("all-notes")

    if (!allNotes || !noteCount) {
        return
    }

    allNotes.innerHTML = ""
    noteCount.innerText = notes.length === 1 ? "1 note" : notes.length + " notes"

    if (notes.length === 0) {
        const emptyItem = document.createElement("li")
        emptyItem.className = "empty-state compact"
        emptyItem.innerHTML = "<strong>No private notes yet.</strong><span>Save reminders, tasks, or ideas here.</span>"
        allNotes.appendChild(emptyItem)
        return
    }

    notes.forEach(note => {
        const item = document.createElement("li")
        item.className = "note-item"

        const title = document.createElement("strong")
        title.innerText = note.title

        const body = document.createElement("p")
        body.innerText = note.body

        const meta = document.createElement("span")
        meta.className = "note-meta"
        meta.innerText = "Updated " + formatAge(note.updatedAt || note.createdAt)

        const actions = document.createElement("div")
        actions.className = "note-actions"

        const editButton = document.createElement("button")
        editButton.className = "text-button"
        editButton.type = "button"
        editButton.innerText = "Edit"
        editButton.addEventListener("click", async () => {
            const nextTitle = prompt("Note title", note.title)
            if (nextTitle === null) return

            const nextBody = prompt("Note body", note.body)
            if (nextBody === null) return

            await request("/api/notes/" + note._id, {
                method: "PATCH",
                body: JSON.stringify({ title: nextTitle, body: nextBody })
            })
            getNotes()
        })

        const deleteButton = document.createElement("button")
        deleteButton.className = "delete-button"
        deleteButton.type = "button"
        deleteButton.innerText = "Delete"
        deleteButton.addEventListener("click", async () => {
            await request("/api/notes/" + note._id, { method: "DELETE" })
            getNotes()
        })

        actions.appendChild(editButton)
        actions.appendChild(deleteButton)
        item.appendChild(title)
        item.appendChild(meta)
        item.appendChild(body)
        item.appendChild(actions)
        allNotes.appendChild(item)
    })
}

const renderSearchResults = (users) => {
    userSearchResults.innerHTML = ""

    if (users.length === 0) {
        const empty = document.createElement("p")
        empty.className = "search-empty"
        empty.innerText = "No users found."
        userSearchResults.appendChild(empty)
        userSearchResults.hidden = false
        return
    }

    users.forEach(user => {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "search-result"
        const avatar = document.createElement("span")
        renderAvatar(avatar, user.username, user.profilePicture)
        const label = document.createElement("strong")
        label.innerText = "@" + user.username
        button.appendChild(avatar)
        button.appendChild(label)
        button.addEventListener("click", () => loadUserProfile(user.username))
        userSearchResults.appendChild(button)
    })

    userSearchResults.hidden = false
}

const searchUsers = async (query) => {
    const trimmed = query.trim()

    if (trimmed.length < 2) {
        closeSearchResults()
        return []
    }

    const data = await request("/api/users/search?q=" + encodeURIComponent(trimmed))
    renderSearchResults(data.users)
    return data.users
}

const loadUserProfile = async (username) => {
    if (!currentUser || currentUser.needsUsername) {
        return
    }

    activeProfileUsername = username
    closeSearchResults()
    userSearch.value = ""

    const data = await request("/api/users/" + encodeURIComponent(username))
    const profileUsername = data.user.username
    profileTitle.innerText = "@" + profileUsername
    profileMeta.innerText = (data.posts.length === 1 ? "1 public post" : data.posts.length + " public posts")
    renderAvatar(profileAvatar, profileUsername, data.user.profilePicture)
    addProfilePostsToPage(data.posts)

    homeScreen.hidden = true
    postPanel.hidden = true
    settingsView.hidden = true
    profileView.hidden = false
    window.scrollTo({ top: 0, behavior: "smooth" })
}

showLogin.addEventListener("click", () => setAuthMode("login"))
showSignup.addEventListener("click", () => setAuthMode("signup"))

form.addEventListener("submit", async (event) => {
    event.preventDefault()
    postMessage.innerText = ""

    try {
        await request("/api/posts", {
            method: "POST",
            body: JSON.stringify({ body: form.elements.body.value })
        })

        form.reset()
        showHomeFeed()
        getPosts()
    } catch (error) {
        postMessage.innerText = error.message
    }
})

if (noteForm) {
    noteForm.addEventListener("submit", async (event) => {
        event.preventDefault()
        noteMessage.innerText = ""

        try {
            await request("/api/notes", {
                method: "POST",
                body: JSON.stringify({
                    title: noteForm.elements.title.value,
                    body: noteForm.elements.body.value
                })
            })

            noteForm.reset()
            getNotes()
        } catch (error) {
            noteMessage.innerText = error.message
        }
    })
}

usernameForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    usernameMessage.innerText = ""

    try {
        const data = await request("/api/me/username", {
            method: "PATCH",
            body: JSON.stringify({ username: usernameForm.elements.username.value })
        })

        currentUser = data.user
        usernameForm.reset()
        updateSessionUI()
        getPosts()
        getNotes()
    } catch (error) {
        usernameMessage.innerText = error.message
    }
})

authForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    authMessage.innerText = ""

    try {
        const data = await request("/api/" + authMode, {
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
            localStorage.removeItem(oldAuthTokenKey)
        }

        currentUser = data.user
        authForm.reset()
        updateSessionUI()
        getPosts()
        getNotes()
    } catch (error) {
        authMessage.innerText = error.message
    }
})

googleLogin.addEventListener("click", () => {
    startProviderAuth("google")
})

microsoftLogin.addEventListener("click", () => {
    startProviderAuth("microsoft")
})

appleLogin.addEventListener("click", () => {
    if (authMode === "signup" && !getSignupUsername()) {
        return
    }

    authMessage.innerText = "Apple sign-in is not connected yet. Create an account with email, Google, or Microsoft for this version."
})

resendVerification.addEventListener("click", async () => {
    authMessage.innerText = ""

    try {
        const data = await request("/api/resend-verification", {
            method: "POST",
            body: JSON.stringify({ email: authForm.elements.email.value || authForm.elements.username.value })
        })

        authMessage.innerText = data.message
    } catch (error) {
        authMessage.innerText = error.message
    }
})

const signOut = async () => {
    await request("/api/logout", { method: "POST" })
    authToken = ""
    localStorage.removeItem(authTokenKey)
    localStorage.removeItem(oldAuthTokenKey)
    currentUser = null
    updateSessionUI()
    getPosts()
    getNotes()
}

settingsLogoutButton.addEventListener("click", signOut)

profileButton.addEventListener("click", () => {
    showSettingsView()
})

backToFeed.addEventListener("click", () => {
    showHomeFeed()
    getPosts()
})

backFromSettings.addEventListener("click", () => {
    showHomeFeed()
    getPosts()
})

settingsViewProfile.addEventListener("click", () => {
    if (currentUser?.username) {
        loadUserProfile(currentUser.username)
    }
})

userSearch.addEventListener("input", () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
        searchUsers(userSearch.value).catch(error => {
            userSearchResults.innerHTML = '<p class="search-empty">' + error.message + '</p>'
            userSearchResults.hidden = false
        })
    }, 180)
})

userSearchForm.addEventListener("submit", async (event) => {
    event.preventDefault()

    try {
        const users = await searchUsers(userSearch.value)
        if (users[0]) {
            loadUserProfile(users[0].username)
        }
    } catch (error) {
        userSearchResults.innerHTML = '<p class="search-empty">' + error.message + '</p>'
        userSearchResults.hidden = false
    }
})

document.addEventListener("click", (event) => {
    if (!userSearchForm.contains(event.target)) {
        closeSearchResults()
    }
})

setAuthMode("login")

const queryParams = new URLSearchParams(window.location.search)
const oauthToken = queryParams.get("token")

if (oauthToken) {
    authToken = oauthToken
    localStorage.setItem(authTokenKey, oauthToken)
    localStorage.removeItem(oldAuthTokenKey)
    authMessage.innerText = "Finishing sign-in..."
    queryParams.delete("token")
    queryParams.delete("login")
    const cleanQuery = queryParams.toString()
    const cleanURL = window.location.pathname + (cleanQuery ? "?" + cleanQuery : "") + window.location.hash
    window.history.replaceState({}, document.title, cleanURL)
}

if (queryParams.get("verified") === "1") {
    authMessage.innerText = "Email verified. You can log in now."
}

if (queryParams.get("login") === "failed") {
    authMessage.innerText = "Sign-in did not complete."
}

if (queryParams.get("login") === "microsoft_failed") {
    authMessage.innerText = "Microsoft sign-in did not complete. Check the Render logs for the callback error."
}

if (queryParams.get("login") === "username_taken") {
    setAuthMode("signup")
    authMessage.innerText = "That username is already taken. Choose another one before continuing."
}

if (queryParams.get("login") === "username_invalid") {
    setAuthMode("signup")
    authMessage.innerText = "Choose a valid username before continuing."
}

if (queryParams.get("login") === "account_missing") {
    setAuthMode("signup")
    authMessage.innerText = "No account is connected to that provider yet. Create an account first and choose a username."
}

if (queryParams.get("login") === "username_required") {
    setAuthMode("signup")
    authMessage.innerText = "That provider account needs a username before it can log in. Create the account first."
}

accountSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    settingsMessage.innerText = ""

    try {
        const data = await request("/api/me/settings", {
            method: "PATCH",
            body: JSON.stringify({
                username: accountSettingsForm.elements.username.value,
                email: accountSettingsForm.elements.email.value,
                profilePicture: accountSettingsForm.elements.profilePicture.value
            })
        })

        currentUser = data.user
        settingsMessage.innerText = data.message
        updateSessionUI()
        showSettingsView()
        getPosts()
    } catch (error) {
        settingsMessage.innerText = error.message
    }
})

passwordSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault()
    passwordMessage.innerText = ""

    try {
        const data = await request("/api/me/password", {
            method: "PATCH",
            body: JSON.stringify({
                currentPassword: passwordSettingsForm.elements.currentPassword.value,
                newPassword: passwordSettingsForm.elements.newPassword.value
            })
        })

        passwordSettingsForm.reset()
        passwordMessage.innerText = data.message
    } catch (error) {
        passwordMessage.innerText = error.message
    }
})

accountSettingsForm.elements.profilePicture.addEventListener("input", () => {
    renderAvatar(settingsAvatarPreview, accountSettingsForm.elements.username.value || "P", accountSettingsForm.elements.profilePicture.value)
})

getSession()
    .then(() => {
        if (!currentUser && oauthToken) {
            authMessage.innerText = "Sign-in did not complete. Please try again."
        }

        return Promise.all([getPosts(), getNotes()])
    })
    .catch(error => {
        sessionStatus.innerText = "Could not reach the server."
        authMessage.innerText = error.message
    })
