"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Header, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os
import json
import secrets
from pathlib import Path
from typing import Optional

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# Load teachers from JSON file
def load_teachers():
    teachers_file = os.path.join(Path(__file__).parent, "teachers.json")
    with open(teachers_file, 'r') as f:
        data = json.load(f)
        return data['teachers']

teachers = load_teachers()

# Active sessions (in-memory storage)
active_sessions = {}

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/login")
def login(username: str, password: str, response: Response):
    """Login endpoint for teachers"""
    # Check credentials
    for teacher in teachers:
        if teacher['username'] == username and teacher['password'] == password:
            # Create session token
            session_token = secrets.token_urlsafe(32)
            active_sessions[session_token] = username
            
            # Set cookie
            response.set_cookie(
                key="session_token",
                value=session_token,
                httponly=True,
                max_age=3600  # 1 hour
            )
            return {"message": "Login successful", "username": username}
    
    raise HTTPException(status_code=401, detail="Invalid credentials")


@app.post("/logout")
def logout(response: Response, session_token: Optional[str] = Header(None, alias="X-Session-Token")):
    """Logout endpoint"""
    if session_token and session_token in active_sessions:
        del active_sessions[session_token]
    
    response.delete_cookie("session_token")
    return {"message": "Logged out successfully"}


@app.get("/auth/status")
def auth_status(session_token: Optional[str] = Header(None, alias="X-Session-Token")):
    """Check if user is authenticated"""
    if session_token and session_token in active_sessions:
        return {"authenticated": True, "username": active_sessions[session_token]}
    return {"authenticated": False}


def verify_teacher_auth(session_token: Optional[str]):
    """Helper function to verify teacher authentication"""
    if not session_token or session_token not in active_sessions:
        raise HTTPException(status_code=401, detail="Authentication required. Only teachers can perform this action.")
    return active_sessions[session_token]


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, session_token: Optional[str] = Header(None, alias="X-Session-Token")):
    """Sign up a student for an activity (requires teacher authentication)"""
    # Verify teacher authentication
    verify_teacher_auth(session_token)
    
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, session_token: Optional[str] = Header(None, alias="X-Session-Token")):
    """Unregister a student from an activity (requires teacher authentication)"""
    # Verify teacher authentication
    verify_teacher_auth(session_token)
    
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
