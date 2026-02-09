document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  
  // Auth UI elements
  const userIcon = document.getElementById("user-icon");
  const userDropdown = document.getElementById("user-dropdown");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const closeModal = document.querySelector(".close");
  const loginSection = document.getElementById("login-section");
  const logoutSection = document.getElementById("logout-section");
  const usernameDisplay = document.getElementById("username-display");
  const signupContainer = document.getElementById("signup-container");
  
  // Session token storage
  let sessionToken = localStorage.getItem("session_token");
  let isAuthenticated = false;

  // Check authentication status
  async function checkAuthStatus() {
    if (!sessionToken) {
      updateUIForAuth(false);
      return;
    }

    try {
      const response = await fetch("/auth/status", {
        headers: {
          "X-Session-Token": sessionToken,
        },
      });

      const result = await response.json();
      isAuthenticated = result.authenticated;

      if (isAuthenticated) {
        updateUIForAuth(true, result.username);
      } else {
        // Invalid session, clear it
        sessionToken = null;
        localStorage.removeItem("session_token");
        updateUIForAuth(false);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      updateUIForAuth(false);
    }
  }

  // Update UI based on authentication status
  function updateUIForAuth(authenticated, username = "") {
    isAuthenticated = authenticated;
    
    if (authenticated) {
      loginSection.classList.add("hidden");
      logoutSection.classList.remove("hidden");
      usernameDisplay.textContent = `Welcome, ${username}`;
      signupContainer.classList.remove("hidden");
    } else {
      loginSection.classList.remove("hidden");
      logoutSection.classList.add("hidden");
      signupContainer.classList.add("hidden");
    }
    
    // Refresh activities to show/hide delete buttons
    fetchActivities();
  }

  // Toggle user dropdown
  userIcon.addEventListener("click", () => {
    userDropdown.classList.toggle("hidden");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (event) => {
    if (!userIcon.contains(event.target) && !userDropdown.contains(event.target)) {
      userDropdown.classList.add("hidden");
    }
  });

  // Open login modal
  loginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    userDropdown.classList.add("hidden");
  });

  // Close login modal
  closeModal.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
    loginMessage.classList.add("hidden");
  });

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      loginForm.reset();
      loginMessage.classList.add("hidden");
    }
  });

  // Handle login
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch(
        `/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Login successful
        sessionToken = result.session_token || "authenticated";
        
        // Try to get session token from response headers or cookie
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'session_token') {
            sessionToken = value;
            break;
          }
        }
        
        localStorage.setItem("session_token", sessionToken);
        loginModal.classList.add("hidden");
        loginForm.reset();
        loginMessage.classList.add("hidden");
        
        updateUIForAuth(true, result.username);
      } else {
        loginMessage.textContent = result.detail || "Invalid credentials";
        loginMessage.className = "error";
        loginMessage.classList.remove("hidden");
      }
    } catch (error) {
      loginMessage.textContent = "Failed to login. Please try again.";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  // Handle logout
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/logout", {
        method: "POST",
        headers: {
          "X-Session-Token": sessionToken,
        },
      });

      sessionToken = null;
      localStorage.removeItem("session_token");
      updateUIForAuth(false);
      userDropdown.classList.add("hidden");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  });

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons only for authenticated users
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isAuthenticated
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ''
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons (only if authenticated)
      if (isAuthenticated) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "X-Session-Token": sessionToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "X-Session-Token": sessionToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkAuthStatus();
  fetchActivities();
});
