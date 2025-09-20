# MYTHOS DASHBOARD

Welcome to the MYTHOS DASHBOARD, a powerful, multi-tool AI assistant designed for creative and analytical tasks. This standalone, full-stack application leverages the Google Gemini API to provide a seamless interface for text generation, code analysis, image and video creation, and much more, all within a single, responsive dashboard.

![MYTHOS DASHBOARD Screenshot](https://i.imgur.com/your-screenshot-here.png) <!-- Add a screenshot of the dashboard here -->

## ✨ Key Features

- **Multi-Tool Interface:** Switch between a wide array of specialized AI tools:
  - **Generate:** Chat, Text, Code, Images, Video, and Speech (TTS).
  - **Analyze:** Images, Code, Documents, Audio, and even Web URLs.
  - **Data:** Persistent AI-generated image gallery, a local file viewer, and a document manager for Retrieval-Augmented Generation (RAG).
- **Agentic System:** Interact with a hub of specialized AI agents, each with its own unique expertise and knowledge base.
- **Real-Time Streaming:** Text-based tools stream responses in real-time, providing an interactive and responsive user experience.
- **AI-Powered Media Generation:** Create stunning images and videos from simple text prompts using the latest models.
- **Persistent Galleries & Databases:**
  - **AI Gallery:** All generated images are saved to a persistent gallery for later viewing.
  - **Local Viewer:** Upload your own images for persistent storage and on-demand AI analysis.
  - **RAG Knowledge Base:** Upload documents to give your AI agents a specific knowledge base, enabling them to answer questions with grounded, accurate information.
- **External Tool Integration:** Seamlessly launch and pre-fill prompts for external services like Perchance Image Mixer and Suno Music.

---

## 🚀 Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS (served by Express)
- **Backend:** Node.js, Express, TypeScript
- **AI Models:** Google Gemini API (`gemini-2.5-flash`, `imagen-4.0-generate-001`, `veo-2.0-generate-001`)
- **Database:** PostgreSQL with `pgvector` for persistent storage and semantic search capabilities.
- **File Handling:** Multer for file uploads and server-side storage.

---

## ⚙️ Getting Started

Follow these steps to get the MYTHOS DASHBOARD running on your local machine. For a more detailed, step-by-step guide, please see the **[INSTALL_MANUAL.md](INSTALL_MANUAL.md)** file.

### 1. Prerequisites

You must have [Node.js](https://nodejs.org/) (v18+ recommended) and a running [PostgreSQL](https://www.postgresql.org/download/) instance (v14+ recommended) with the `pgvector` extension enabled on your computer.

### 2. Clone & Install

Clone the repository and install the necessary `npm` packages.

```bash
git clone https://github.com/your-repo/mythos-dashboard.git
cd mythos-dashboard
npm install
```

### 3. Configure Environment Variables

The backend server requires API keys and database connection details to function.

1.  Create a new file named `.env` in the root directory.
2.  Add your secret API keys and database credentials to this file. See the example below.

```
# === API KEYS ===
# Your secret Google Gemini API Key. Used by the backend server.
API_KEY="AIzaSy...your...secret...key...here"

# (Optional) Your ElevenLabs API key for additional TTS voices. Used by backend.
ELEVENLABS_API_KEY="your...elevenlabs...key...here"

# === SERVER CONFIG ===
# The port the backend server will run on (optional, defaults to 3001)
PORT=3001

# === POSTGRESQL DATABASE CONNECTION ===
# IMPORTANT: For pgvector, use a connection string if your provider gives one.
# Otherwise, fill out the individual variables.
# PG_CONNECTION_STRING="postgres://user:password@host:port/database"
PG_USER="your_postgres_username"
PG_HOST="localhost"
PG_DATABASE="your_database_name"
PG_PASSWORD="your_postgres_password"
PG_PORT=5432
```

**Important:** Your `.env` file contains sensitive information and should never be committed to version control.

### 4. Run the Application

This is a full-stack application where the Node.js/Express server handles both the backend API and serving the frontend files. You only need to run **one command** in your terminal.

**To run in development mode (with auto-reloading):**
```bash
npm run dev
```

**To run in production mode:**
```bash
npm run build
npm run start
```

After running the command, open `http://localhost:3001` (or your configured port) in your web browser to use the dashboard.

---

## 🌐 Deployment

This is a full-stack application that requires a hosting environment capable of running a Node.js server and a PostgreSQL database. A platform like **Render** is highly recommended as it provides free tiers for both.

For a complete, step-by-step deployment guide, please refer to **[INSTALL_MANUAL.md](INSTALL_MANUAL.md)**.

---

## 📄 License

This project is licensed under the ISC License. See the `package.json` file for details.