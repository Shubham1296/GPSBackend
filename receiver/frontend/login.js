// ==================== DOM ELEMENTS ====================
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const errorDiv = document.getElementById("error");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const serverInput = document.getElementById("server");
const togglePasswordBtn = document.getElementById("togglePassword");

// ==================== PASSWORD TOGGLE ====================
togglePasswordBtn.onclick = () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    
    // Update icon
    if (type === "text") {
        togglePasswordBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
        `;
    } else {
        togglePasswordBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
    }
};

// ==================== CLEAR ERROR ON INPUT ====================
[emailInput, passwordInput, serverInput].forEach(input => {
    input.addEventListener("input", () => {
        errorDiv.textContent = "";
    });
});

// ==================== FORM VALIDATION ====================
function validateForm() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const server = serverInput.value.trim();

    if (!email) {
        showError("Please enter your email address");
        emailInput.focus();
        return false;
    }

    if (!email.includes("@")) {
        showError("Please enter a valid email address");
        emailInput.focus();
        return false;
    }

    if (!password) {
        showError("Please enter your password");
        passwordInput.focus();
        return false;
    }

    if (!server) {
        showError("Please enter the server URL");
        serverInput.focus();
        return false;
    }

    if (!server.startsWith("http://") && !server.startsWith("https://")) {
        showError("Server URL must start with http:// or https://");
        serverInput.focus();
        return false;
    }

    return true;
}

// ==================== SHOW ERROR ====================
function showError(message) {
    errorDiv.textContent = message;
}

// ==================== SET LOADING STATE ====================
function setLoading(isLoading) {
    if (isLoading) {
        loginBtn.classList.add("loading");
        loginBtn.disabled = true;
        [emailInput, passwordInput, serverInput].forEach(input => {
            input.disabled = true;
        });
    } else {
        loginBtn.classList.remove("loading");
        loginBtn.disabled = false;
        [emailInput, passwordInput, serverInput].forEach(input => {
            input.disabled = false;
        });
    }
}

// ==================== LOGIN HANDLER ====================
loginForm.onsubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const server = serverInput.value.trim().replace(/\/$/, ""); // Remove trailing slash

    setLoading(true);
    errorDiv.textContent = "";

    try {
        const resp = await fetch(server + "/login", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ email: email, password: password })
        });

        const json = await resp.json();

        if (!resp.ok) {
            throw new Error(json.detail || json.message || "Invalid login credentials");
        }

        // Validate token exists
        if (!json.token) {
            throw new Error("No authentication token received");
        }

        // Save credentials
        localStorage.setItem("jwt", json.token);
        localStorage.setItem("server", server);

        // Show success briefly before redirect
        loginBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Success!</span>
        `;

        // Redirect after brief delay
        setTimeout(() => {
            window.location.href = "index.html";
        }, 500);

    } catch (error) {
        setLoading(false);
        
        // Handle different error types
        if (error.name === "TypeError" && error.message.includes("fetch")) {
            showError("Unable to connect to server. Please check the URL and try again.");
        } else {
            showError(error.message || "An unexpected error occurred. Please try again.");
        }
        
        console.error("Login error:", error);
    }
};

// ==================== LOAD SAVED SERVER ====================
window.onload = () => {
    const savedServer = localStorage.getItem("server");
    if (savedServer) {
        serverInput.value = savedServer;
    }
};

// ==================== ENTER KEY SUPPORT ====================
[emailInput, passwordInput, serverInput].forEach(input => {
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            loginForm.onsubmit(e);
        }
    });
});