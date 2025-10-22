# MYTHOS DASHBOARD - Installation & Deployment Manual

This guide provides detailed, step-by-step instructions for setting up, running, and deploying the MYTHOS DASHBOARD application.

## Table of Contents
1.  [Prerequisites](#1-prerequisites)
2.  [Local Development Setup](#2-local-development-setup)
3.  [Running the Application Locally](#3-running-the-application-locally)
4.  [Troubleshooting](#4-troubleshooting)
5.  [Deployment Guide (Render)](#5-deployment-guide-render)

---

## 1. Prerequisites

Before you begin, ensure you have the following software installed on your machine.

### Node.js and npm

-   **Node.js:** Version 18.x or higher is required. (v20+ recommended)
-   **npm:** Comes bundled with Node.js.

To check if you have them installed, open your terminal and run:
```bash
node -v
npm -v
```
If you don't have them, download and install Node.js from [nodejs.org](https://nodejs.org/).

### PostgreSQL Database with pgvector

-   **PostgreSQL:** Version 14.x or higher is required.
-   **`pgvector` extension:** This is critical for the RAG system's capabilities.

Choose one of the two recommended ways to set up your database:

#### Option A: Docker (Recommended)
If you have Docker installed, this is the easiest way to get a compatible database running. Make sure the Docker daemon is running before executing the command.

```bash
docker run -d \
  --name mythos-db \
  -p 5432:5432 \
  -e POSTGRES_USER=mythos_user \
  -e POSTGRES_PASSWORD=your_secret_password \
  -e POSTGRES_DB=mythos_dashboard \
  -v mythos_db_data:/var/lib/postgresql/data \
  ankane/pgvector
```
Replace `your_secret_password` with a strong password. This command creates a persistent database that will save your data even if you stop the container. The `pgvector` extension is automatically enabled. You can skip to [Step 2.4](#step-24-configure-environment-variables).

> **Tip:** If you need to stop or remove the container later, you can use `docker stop mythos-db` and `docker rm mythos-db`.

#### Option B: Manual Installation
1.  **Install PostgreSQL:** Download the installer from the [official PostgreSQL website](https://www.postgresql.org/download/). During installation, you will set a password for the default `postgres` user. Remember this password.
2.  **Install pgvector:** Follow the instructions for your operating system from the [pgvector GitHub repository](https://github.com/pgvector/pgvector).
    -   **Ubuntu/Debian:** `sudo apt-get install postgresql-16-pgvector` (replace 16 with your version).
    -   **macOS (Homebrew):** `brew install pgvector`.

---

## 2. Local Development Setup

Follow these steps to get the project configured on your local machine.

### Step 2.1: Clone the Repository

Open your terminal, navigate to where you want to store the project, and run:
```bash
git clone https://github.com/your-repo/mythos-dashboard.git
cd mythos-dashboard
```

### Step 2.2: Install Dependencies

Install all the required Node.js packages for the server:
```bash
npm install
```

### Step 2.3: Set Up the Database (Manual Install Only)

If you used Docker in the prerequisite step, you can skip to Step 2.4.

1.  **Connect to PostgreSQL:** Open your terminal and connect to the default PostgreSQL instance using the `psql` command-line tool. You may need to add PostgreSQL's `bin` directory to your system's PATH. You will be prompted for the password you set during installation.
    ```bash
    psql -U postgres
    ```
2.  **Create a User (Optional but Recommended):** Create a dedicated user for the application.
    ```sql
    CREATE USER mythos_user WITH PASSWORD 'your_secret_password';
    ```
3.  **Create the Database:**
    ```sql
    CREATE DATABASE mythos_dashboard OWNER mythos_user;
    ```
4.  **Connect to the New Database:**
    ```sql
    \c mythos_dashboard
    ```
5.  **Enable the pgvector Extension:** This is a crucial step.
    ```sql
    CREATE EXTENSION vector;
    ```
6.  **Verify Installation:** Check that the extension is active.
    ```sql
    \dx
    ```
    You should see `vector` listed in the output.
7.  **Exit psql:**
    ```sql
    \q
    ```

### Step 2.4: Configure Environment Variables

The application uses a `.env` file to manage secret keys and configuration.

1.  In the root of the project, copy the example file to a new `.env` file:
    ```bash
    cp .env.example .env
    ```
2.  Open the new `.env` file in your editor.
3.  Fill in the required values:
    -   `API_KEY`: Your **Google Gemini API key** from Google AI Studio.
    -   `ELEVENLABS_API_KEY`: (Optional) Your **ElevenLabs API key**. This is required to use the ElevenLabs TTS voice options.
    -   `PG_USER`, `PG_HOST`, `PG_DATABASE`, `PG_PASSWORD`, `PG_PORT`: Your database connection details from the previous steps. If you used the Docker command, these will be `mythos_user`, `localhost`, `mythos_dashboard`, `your_secret_password`, and `5432` respectively.

---

## 3. Running the Application Locally

The application is a single process. The Node.js/Express server handles both the backend API and serves all the frontend files.

### Step 3.1: Start the Server

This single command starts the server using `ts-node-dev`, which will automatically restart when you make changes to the code.
```bash
npm run dev
```

**What happens on the first run?**
The server will automatically connect to your database and run the necessary `CREATE TABLE` commands to set up the application's schema. You should see "Database tables are ready" in your terminal log.

### Step 3.2: Open the Dashboard

After starting the server, open your web browser and navigate to `http://localhost:3001` (or the port you configured in your `.env` file) to use the MYTHOS DASHBOARD.

---

## 4. Troubleshooting

-   **Error: `address already in use :::3001`**
    -   Another application is using port 3001. You can either stop that application or change the `PORT` variable in your `.env` file to a different number (e.g., `PORT=3002`).

-   **Error: `Database connection error...`**
    -   Double-check that your PostgreSQL server (or Docker container) is running.
    -   Verify that all `PG_...` variables in your `.env` file are correct (host, port, user, password, database name).

-   **Error: `extension "vector" does not exist`**
    -   The `pgvector` extension was not enabled correctly. Connect to your database with `psql -U postgres -d mythos_dashboard` and run `CREATE EXTENSION vector;`.

---

## 5. Deployment Guide (Render)

This guide explains how to deploy the application to a production environment. We recommend **Render** because its free tier can host the Node.js server and the PostgreSQL database with `pgvector`.

### Step 5.1: Prepare Your Code

Push your latest code, including the `.gitignore` file, to a GitHub repository.

### Step 5.2: Deploy the Database on Render

1.  Sign up or log in to [Render](https://render.com/).
2.  From the dashboard, click **New + > PostgreSQL**.
3.  Give your database a unique name (e.g., `mythos-db-prod`).
4.  **Important:** Under **Postgres Version**, select version **14 or higher**. The `vector` extension is pre-installed on these versions.
5.  Choose a region and click **Create Database**.
6.  Once the database is running, go to its page and copy the **Internal Connection String**. You will need this for the backend server.

### Step 5.3: Deploy the Backend Server on Render

1.  From the dashboard, click **New + > Web Service**.
2.  Connect the GitHub repository containing your application.
3.  Configure the service:
    -   **Name:** Give your web service a name (e.g., `mythos-dashboard`).
    -   **Environment:** Select `Node`.
    -   **Build Command:** `npm install && npm run build`
    -   **Start Command:** `npm run start`
4.  Click **Advanced**, then go to the **Environment** tab.
5.  Click **Add Secret File**.
    -   **Filename:** `.env`
    -   **Contents:** Paste the entire contents of your local `.env` file, but **replace** the local `PG_...` variables with the single `PG_CONNECTION_STRING` you copied from your Render PostgreSQL instance.
6.  Click **Create Web Service**.

Render will build and deploy your application. Because the Express server also serves the frontend, you can access the full application at the URL provided by Render (e.g., `https://mythos-dashboard.onrender.com`).