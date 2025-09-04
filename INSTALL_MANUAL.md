
# MYTHOS DASHBOARD - Installation Manual

This guide provides detailed, step-by-step instructions for setting up, running, and deploying the MYTHOS DASHBOARD application.

## Table of Contents
1.  [Prerequisites](#1-prerequisites)
2.  [Local Development Setup](#2-local-development-setup)
3.  [Running the Application Locally](#3-running-the-application-locally)
4.  [Deployment Guide (Production)](#4-deployment-guide-production)

---

## 1. Prerequisites

Before you begin, ensure you have the following software installed on your machine.

### Node.js and npm

-   **Node.js:** Version 18.x or higher is recommended.
-   **npm:** Comes bundled with Node.js.

To check if you have them installed, open your terminal and run:
```bash
node -v
npm -v
```
If you don't have them, download and install Node.js from [nodejs.org](https://nodejs.org/).

### PostgreSQL Database

-   **PostgreSQL:** Version 14.x or higher is recommended.
-   **pgvector extension:** This is required for the RAG system's semantic search capabilities.

**Installation:**
-   **Windows/macOS:** Download the installer from the [official PostgreSQL website](https://www.postgresql.org/download/). During installation, you will set a password for the default `postgres` user. Remember this password.
-   **Docker (Recommended for ease of use):** If you have Docker installed, you can easily run a PostgreSQL instance with `pgvector` using the following command:
    ```bash
    docker run -d \
      --name mythos-db \
      -p 5432:5432 \
      -e POSTGRES_USER=your_username \
      -e POSTGRES_PASSWORD=your_password \
      -e POSTGRES_DB=mythos_dashboard \
      ankane/pgvector
    ```
    Replace `your_username` and `your_password` with your desired credentials.

---

## 2. Local Development Setup

Follow these steps to get the project running on your local machine.

### Step 2.1: Clone the Repository

Open your terminal, navigate to where you want to store the project, and run:
```bash
git clone https://github.com/your-repo/mythos-dashboard.git
cd mythos-dashboard
```

### Step 2.2: Install Dependencies

Install all the required packages for both the server and the client:
```bash
npm install
```

### Step 2.3: Set Up the Database

1.  **Create a Database:** Using a tool like `psql` or a GUI client (like DBeaver or Postico), connect to your PostgreSQL instance. Create a new database for the application.
    ```sql
    CREATE DATABASE mythos_dashboard;
    ```
2.  **Enable pgvector:** Connect to your newly created database and run the following command to enable the vector extension:
    ```sql
    CREATE EXTENSION IF NOT EXISTS vector;
    ```
    If this command fails, ensure `pgvector` was installed correctly with PostgreSQL.

### Step 2.4: Configure Environment Variables

The application uses a `.env` file to manage secret keys and configuration.

1.  In the root of the project, create a new file named `.env`.
2.  Copy and paste the following template into the file, filling in your own values.

```
# === API KEYS ===
# Your secret Google Gemini API Key from Google AI Studio
API_KEY="AIzaSy...your...secret...key...here"

# (Optional) Your ElevenLabs API key for additional TTS voices
ELEVENLABS_API_KEY="your...elevenlabs...key...here"

# === SERVER CONFIG ===
# The port the backend server will run on
PORT=3001

# === POSTGRESQL DATABASE CONNECTION ===
# Fill these out for your local database connection.
PG_USER="your_postgres_username"
PG_HOST="localhost"
PG_DATABASE="mythos_dashboard"
PG_PASSWORD="your_postgres_password"
PG_PORT=5432

# Note: For production deployment (see Section 4), you will likely use
# a connection string instead, which looks like this:
# PG_CONNECTION_STRING="postgres://user:password@host:port/database"
```

---

## 3. Running the Application Locally

The application requires two processes running simultaneously: the backend server and the frontend client. You must open **two separate terminal windows** for this.

### Terminal 1: Start the Backend Server

This command starts the Node.js/Express server. It will automatically connect to your database and create the necessary tables on its first run.

```bash
npm run server
```
You should see output indicating the server is running and the database is ready.

### Terminal 2: Start the Frontend Client

This command serves the React application.

```bash
npm run client
```
This will provide a local URL, typically `http://localhost:8080`. Open this address in your web browser to use the MYTHOS DASHBOARD.

---

## 4. Deployment Guide (Production)

This guide explains how to deploy the application to a production environment. We recommend **Render** because its free tier can host the Node.js server, the PostgreSQL database with `pgvector`, and the static frontend all in one place.

### Step 4.1: Prepare Your Code

Push your latest code to a GitHub repository. Render will connect directly to this repository.

### Step 4.2: Deploy the Database on Render

1.  Sign up or log in to [Render](https://render.com/).
2.  From the dashboard, click **New + > PostgreSQL**.
3.  Give your database a unique name.
4.  **Important:** Under **Postgres Version**, select version 14 or higher. The `vector` extension is pre-installed on these versions.
5.  Choose a region and click **Create Database**.
6.  Once the database is running, copy the **Internal Connection String**. You will need this for the backend server.

### Step 4.3: Deploy the Backend Server on Render

1.  From the dashboard, click **New + > Web Service**.
2.  Connect the GitHub repository containing your application.
3.  Configure the service:
    -   **Name:** Give your web service a name (e.g., `mythos-dashboard-server`).
    -   **Root Directory:** Leave this blank if your `package.json` is in the root.
    -   **Environment:** Select `Node`.
    -   **Build Command:** `npm install`
    -   **Start Command:** `ts-node server.ts`
4.  Click **Advanced**, then go to the **Environment** tab.
5.  Add your secrets from your `.env` file as **Environment Variables**.
    -   `API_KEY`: Your Google Gemini API key.
    -   `ELEVENLABS_API_KEY`: (Optional) Your ElevenLabs key.
    -   `PG_CONNECTION_STRING`: Paste the **Internal Connection String** you copied from your Render PostgreSQL instance.
    -   **Important:** Also add a `NODE_VERSION` variable and set it to `18` or higher.
6.  Click **Create Web Service**. Render will build and deploy your server.

### Step 4.4: Deploy the Frontend on Render

This application's Express server is already configured to serve the frontend files. We just need to tell Render where they are.

1.  Go to the settings for the Web Service you just created.
2.  Navigate to the **Redirects/Rewrites** section.
3.  Add a **Rewrite Rule**:
    -   **Source:** `/*`
    -   **Destination:** `/index.html`
    -   **Action:** `Rewrite`
4.  This rule ensures that all requests are routed through your `index.html` file, allowing the React front-end to handle routing.

Your application is now live! You can access it at the URL provided by Render (e.g., `https://mythos-dashboard-server.onrender.com`).
