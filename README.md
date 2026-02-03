# Orario Ottimo

## Overview
Orario Ottimo is a web application for managing and optimizing academic timetables. It features a Node.js/Express backend with MongoDB and a modern JavaScript frontend.

---

## Prerequisites
- **Node.js** (v16 or higher recommended)
- **npm** (Node Package Manager)
- **MongoDB** 

---

## Installation & Setup

### 1. Clone the Repository
```
git clone https://github.com/bigandry17/Orario-Ottimo
cd Orario-Ottimo
```

### 2. Install Backend Dependencies
```
cd backend
npm install
```

### 3. Configure Environment
- Edit `backend/config.js` if you need to change the MongoDB connection string or JWT secret.
- By default, the app expects MongoDB running at `mongodb://localhost:27017/orario_ottimo_db`.

### 4. Start MongoDB
Make sure your MongoDB server is running:
```
mongod
```

### 5. Seed the Database
The backend will automatically seed initial data (users, teachers, courses, etc.) on first run if the collections are empty.

### 6. Start the Application
```
cd backend
npm start
```
### The application will run on [http://localhost:3000](http://localhost:3000) by default.


## Default Credentials
- **Admin:**
  - Username: `admin`
  - Password: `admin`
- **Sample Teachers:**
  - Username: `rossi`, Password: `docente`
  - Username: `bianchi`, Password: `docente`
  - Username: `verdi`, Password: `docente`
  - Username: `neri`, Password: `docente`
  - Username: `gialli`, Password: `docente`
  - Username: `marroni`, Password: `docente`

---

## Project Structure
```
backend/         # Node.js/Express API and database logic
frontend/        # Static frontend (HTML, CSS, JS)
```

---

## Notes
- Make sure MongoDB is running before starting the backend.
- The backend seeds initial data only if the collections are empty.

---

## Troubleshooting
- **Port conflicts:** Change the port in `backend/server.js`.
- **Database connection errors:** Check your MongoDB service and connection string in `backend/config.js`.
- **CORS issues:** The backend is configured for local development. Adjust CORS settings in `backend/server.js` if needed.
