const form = document.getElementById("new-post-form")
const noteForm = document.getElementById("new-note-form")
const authForm = document.getElementById("auth-form")
const authCard = document.getElementById("auth-card")
const homeScreen = document.getElementById("home-screen")
const postPanel = document.getElementById("post-panel")
const notesPanel = document.getElementById("notes-panel")
const homeUsername = document.getElementById("home-username")
const authSubmit = document.getElementById("auth-submit")
const authMessage = document.getElementById("auth-message")
const postMessage = document.getElementById("post-message")
const noteMessage = document.getElementById("note-message")
const postCount = document.getElementById("post-count")
const noteCount = document.getElementById("note-count")
const sessionStatus = document.getElementById("session-status")
const logoutButton = document.getElementById("logout-button")
const showLogin = document.getElementById("show-login")
const showSignup = document.getElementById("show-signup")
const authEmail = document.getElementById("auth-email")
const authEmailLabel = document.getElementById("auth-email-label")
const resendVerification = document.getElementById("resend-verification")
const googleLogin = document.getElementById("google-login")
const microsoftLogin = document.getElementById("microsoft-login")
const appleLogin = document.getElementById("apple-login")
const refreshWeather = document.getElementById("refresh-weather")
const weatherCard = document.getElementById("weather-card")
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
    resendVerification.hidden = !isLogin
    googleLogin.hidden = !isLogin
    microsoftLogin.hidden = !isLogin
    authForm.elements.username.placeholder = isLogin ? "name@example.com" : "Choose a handle"
    authForm.elements.password.autocomplete = isLogin ? "current-password" : "new-password"
    authMessage.innerText = ""
}

const updateSessionUI = () => {
    document.body.classList.toggle("is-authenticated", Boolean(currentUser))
    document.body.classList.toggle("is-auth-page", !currentUser)

    if (currentUser) {
        const displayName = currentUser.username || currentUser.email || "creator"
        sessionStatus.innerText = "Logged in as " + displayName
        homeUsername.innerText = displayName
        logoutButton.hidden = false
        authCard.hidden = true
        homeScreen.hidden = false
        postPanel.hidden = false
        notesPanel.hidden = false
        return
    }

    sessionStatus.innerText = "Log in to post and save private notes."
    logoutButton.hidden = true
    authCard.hidden = false
    homeScreen.hidden = true
    postPanel.hidden = true
    notesPanel.hidden = true
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
    if (!currentUser) {
        addNotesToPage([])
        return []
    }

    const notes = await request("/api/notes")
    addNotesToPage(notes)
    return notes
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

const addNotesToPage = (notes) => {
    const allNotes = document.getElementById("all-notes")
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

const weatherDescriptions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    95: "Thunderstorm"
}

const renderWeather = (data, label) => {
    const current = data.current
    const daily = data.daily
    const summary = weatherDescriptions[current.weather_code] || "Current conditions"
    const high = Math.round(daily.temperature_2m_max[0])
    const low = Math.round(daily.temperature_2m_min[0])
    const rain = daily.precipitation_probability_max[0]

    weatherCard.innerHTML = [
        '<p class="weather-location">' + label + "</p>",
        '<p class="weather-temp">' + Math.round(current.temperature_2m) + "°F</p>",
        '<p class="weather-summary">' + summary + ". Feels like " + Math.round(current.apparent_temperature) + "°F.</p>",
        '<div class="weather-details">',
        "<span>High " + high + "°</span>",
        "<span>Low " + low + "°</span>",
        "<span>Rain " + rain + "%</span>",
        "<span>Wind " + Math.round(current.wind_speed_10m) + " mph</span>",
        "</div>"
    ].join("")
}

const loadWeather = async (coords = { latitude: 49.2827, longitude: -123.1207 }, label = "Vancouver") => {
    weatherCard.innerHTML = '<p class="weather-summary">Loading weather...</p>'
    const params = new URLSearchParams({
        latitude: coords.latitude,
        longitude: coords.longitude,
        current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
        daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        temperature_unit: "fahrenheit",
        wind_speed_unit: "mph",
        timezone: "auto"
    })

    const response = await fetch("https://api.open-meteo.com/v1/forecast?" + params)
    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.reason || "Weather request failed.")
    }

    renderWeather(data, label)
}

const useDeviceWeather = () => {
    if (!navigator.geolocation) {
        loadWeather()
        return
    }

    weatherCard.innerHTML = '<p class="weather-summary">Checking your location...</p>'
    navigator.geolocation.getCurrentPosition(
        position => {
            loadWeather(position.coords, "Your area").catch(() => loadWeather())
        },
        () => loadWeather()
    )
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
        getPosts()
    } catch (error) {
        postMessage.innerText = error.message
    }
})

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
    window.location.href = baseURL + "/auth/google"
})

microsoftLogin.addEventListener("click", () => {
    window.location.href = baseURL + "/auth/microsoft"
})

appleLogin.addEventListener("click", () => {
    authMessage.innerText = "Apple sign-in is not connected yet. Use Google, Microsoft, or email for this version."
})

resendVerification.addEventListener("click", async () => {
    authMessage.innerText = ""

    try {
        const data = await request("/api/resend-verification", {
            method: "POST",
            body: JSON.stringify({ email: authForm.elements.username.value })
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
    localStorage.removeItem(oldAuthTokenKey)
    currentUser = null
    updateSessionUI()
    getPosts()
    getNotes()
})

refreshWeather.addEventListener("click", useDeviceWeather)

setAuthMode("login")

const queryParams = new URLSearchParams(window.location.search)
const oauthToken = queryParams.get("token")

if (oauthToken) {
    authToken = oauthToken
    localStorage.setItem(authTokenKey, oauthToken)
    localStorage.removeItem(oldAuthTokenKey)
    authMessage.innerText = "Finishing sign-in..."
    queryParams.delete("token")
    const cleanQuery = queryParams.toString()
    const cleanURL = window.location.pathname + (cleanQuery ? "?" + cleanQuery : "") + window.location.hash
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

getSession()
    .then(() => Promise.all([getPosts(), getNotes(), loadWeather()]))
    .catch(error => {
        sessionStatus.innerText = "Could not reach the server."
        authMessage.innerText = error.message
        loadWeather().catch(() => {
            weatherCard.innerHTML = '<p class="weather-summary">Weather is unavailable right now.</p>'
        })
    })
