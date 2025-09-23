# MYTHOS DASHBOARD

Welcome to the MYTHOS DASHBOARD, a powerful, multi-tool AI assistant designed for creative and analytical tasks. This standalone, full-stack application leverages the Google Gemini API to provide a seamless interface for text generation, code analysis, image and video creation, and much more, all within a single, responsive dashboard.

<!-- TODO: Replace this placeholder with a real screenshot of the application dashboard. -->
![MYTHOS DASHBOARD Screenshot](https://i.imgur.com/your-screenshot-here.png)

## ✨ Key Features

- **Multi-Tool Interface:** Switch between a wide array of specialized AI tools:
  - **Generate:** Chat, Text, Code, Images, Video, and Speech (TTS).
  - **Analyze:** Images, Code, Documents, Audio (transcription), and even Web URLs.
  - **Convert:** Turn audio recordings of single instruments into MIDI data.
- **Agentic System:** Interact with a hub of specialized AI agents, each with its own unique expertise and knowledge base.
- **Real-Time Streaming:** Text-based tools stream responses in real-time, providing an interactive and responsive user experience.
- **Persistent Galleries & Databases:**
  - **AI Gallery:** All generated images are saved to a persistent gallery for later viewing.
  - **Local Viewer:** Upload your own images for persistent storage and on-demand AI analysis.
  - **RAG Knowledge Base:** Upload documents to give your AI agents a specific knowledge base, enabling them to answer questions with grounded, accurate information.
- **External Tool Integration:** Seamlessly launch and pre-fill prompts for external services like Perchance Image Mixer and Suno Music.

---

## 🚀 Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **AI Models:** Google Gemini API (`gemini-2.5-flash`, `imagen-4.0-generate-001`, `veo-2.0-generate-001`, `text-embedding-004`)
- **Database:** PostgreSQL for persistent storage.
- **File Handling:** Multer for file uploads and server-side storage.

---

## 📂 Project Structure

A brief overview of the key directories and files in this project:

```
/
├── components/         # React components for the UI
│   ├── icons/          # SVG icon components
│   └── ...             # Panel, modal, and other UI components
├── services/           # Functions for communicating with the backend API
├── css/                # CSS files for standalone HTML pages
├── js/                 # JavaScript for standalone HTML pages
├── public/             # Static assets (not present, but can be added)
├── server.ts           # The main backend Express server file
├── App.tsx             # The main frontend React application component
├── types.ts            # Shared TypeScript type definitions
├── README.md           # This file
└── package.json        # Project dependencies and scripts
```

---

## ⚙️ Getting Started

Follow these steps to get the MYTHOS DASHBOARD running on your local machine. For a more detailed, step-by-step guide, please see the **[INSTALL_MANUAL.md](INSTALL_MANUAL.md)** file.

### 1. Prerequisites

You must have [Node.js](https://nodejs.org/) (v18+ recommended) and a running [PostgreSQL](https://www.postgresql.org/download/) instance (v14+ recommended) on your computer.

### 2. Clone & Install

Clone the repository and install the necessary `npm` packages.

```bash
git clone https://github.com/your-repo/mythos-dashboard.git
cd mythos-dashboard
npm install
```

### 3. Configure Environment Variables

The backend server requires API keys and database connection details.

1.  Create a new file named `.env` in the root directory by copying the `.env.example` file.
2.  Add your secret API keys and database credentials to this `.env` file.

```
# === API KEYS ===
# Your secret Google Gemini API Key
API_KEY="AIzaSy...your...secret...key...here"

# (Optional) Your ElevenLabs API key for additional TTS voices
ELEVENLABS_API_KEY="your...elevenlabs...key...here"

# === SERVER CONFIG ===
# The port the backend server will run on (optional, defaults to 3001)
PORT=3001

# === POSTGRESQL DATABASE CONNECTION ===
PG_USER="your_postgres_username"
PG_HOST="localhost"
PG_DATABASE="your_database_name"
PG_PASSWORD="your_postgres_password"
PG_PORT=5432
```

**Important:** Your `.env` file contains sensitive information and should never be committed to version control. The provided `.gitignore` file already excludes it.

### 4. Run the Application

The application consists of a backend server and a frontend client, which must be run concurrently in **two separate terminals**.

**Terminal 1: Start the Backend Server**

This command starts the Node.js/Express server. On the first run, it will automatically create the necessary tables and indexes in your database.

```bash
npm run server
```

**Terminal 2: Start the Frontend Client**

This command serves the React application.

```bash
npm run client
```

Open the local URL provided by the client (e.g., `http://localhost:8080`) in your web browser to use the dashboard.

---

## 🌐 Deployment

This is a full-stack application that requires a hosting environment capable of running a Node.js server and a PostgreSQL database. A platform like **Render** is highly recommended as it provides free tiers for both.

For a complete, step-by-step deployment guide, please refer to **[INSTALL_MANUAL.md](INSTALL_MANUAL.md)**.

---

## 📄 License

This project is licensed under the ISC License. See the `package.json` file for details.
