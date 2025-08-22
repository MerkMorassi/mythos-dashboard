
# MYTHOS DASHBOARD

Welcome to the MYTHOS DASHBOARD, a powerful, multi-tool AI assistant designed for creative and analytical tasks. This standalone, full-stack application leverages the Google Gemini API to provide a seamless interface for text generation, code analysis, image and video creation, and much more, all within a single, responsive dashboard.

![MYTHOS DASHBOARD Screenshot](https://i.imgur.com/your-screenshot-here.png) <!-- Add a screenshot of the dashboard here -->

## ✨ Key Features

- **Multi-Tool Interface:** Switch between a wide array of specialized AI tools:
  - **Generate:** Chat, Text, Code, Images, Video, and Speech (TTS).
  - **Analyze:** Images, Code, Documents, Audio, and even Web URLs.
  - **Data:** Persistent AI-generated image gallery and a local file viewer.
- **Real-Time Streaming:** Text-based tools stream responses in real-time, providing an interactive and responsive user experience.
- **AI-Powered Media Generation:** Create stunning images and videos from simple text prompts using the latest models.
- **Personalized Feedback Loop:** A "thumbs up/down" system on AI generations teaches the model your stylistic preferences, tailoring future results to your taste.
- **Persistent Galleries:**
  - **AI Gallery:** All generated images are saved to a persistent gallery, complete with prompts and seeds, for later viewing.
  - **Local Viewer:** Upload your own images for persistent storage. Features on-demand AI analysis that automatically generates descriptive tags for powerful searching.
- **External Tool Integration:** Seamlessly launch and pre-fill prompts for external services like Perchance Image Mixer, Suno Music, and NotebookLM.

---

## 🚀 Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **AI Models:** Google Gemini API (`gemini-2.5-flash`, `imagen-3.0-generate-002`, `veo-2.0-generate-001`)
- **Database:** PostgreSQL for persistent storage of galleries, user feedback, and activity logs.
- **File Handling:** Multer for file uploads and server-side storage.

---

## ⚙️ Setup and Installation

Follow these steps to get the MYTHOS DASHBOARD running on your local machine.

### Prerequisites

You must have [Node.js](https://nodejs.org/) (which includes `npm`) and a running [PostgreSQL](https://www.postgresql.org/download/) instance on your computer.

### Step 1: Clone the Repository

```bash
git clone https://github.com/MerkMorassi/mythos-dashboard.git
cd mythos-dashboard
```

### Step 2: Install Dependencies

In the project's root directory, run the following command to install all necessary packages for both the server and the client.

```bash
npm install
```

### Step 3: Configure Environment Variables

The backend server requires your Google Gemini API key and database connection details.

1.  Create a new file named `.env` in the root directory. You can copy the `.env.example` file to get started.
2.  Add your secret API key and database credentials to this file.

```
# === API KEYS ===
# Your secret Google Gemini API Key
API_KEY=AIzaSy...your...secret...key...here

# === SERVER CONFIG ===
# The port the backend server will run on (optional, defaults to 3001)
PORT=3001

# === POSTGRESQL DATABASE CONNECTION ===
PG_USER=your_postgres_username
PG_HOST=localhost
PG_DATABASE=your_database_name
PG_PASSWORD=your_postgres_password
PG_PORT=5432
```

**Important:** The `.env` file contains sensitive information. It is included in `.gitignore` to prevent it from being committed to version control.

### Step 4: Run the Application

The application consists of a backend server and a frontend client, which must be run concurrently. You will need to open **two separate terminals** for this.

**Terminal 1: Start the Backend Server**

This command starts the Node.js/Express server, which handles API requests, interacts with the Gemini API, and manages the database.

```bash
npm run server
```

On the first run, the server will automatically create the necessary tables in your PostgreSQL database. You should see log messages confirming that the server is listening and the database is ready. This server also serves the `uploads` and `local_uploads` directories for media files.

**Terminal 2: Start the Frontend Client**

This command serves the React application.

```bash
npm run client
```

This will provide a local URL (e.g., `http://localhost:8080`). Open this address in your web browser to use the MYTHOS DASHBOARD.

---

## 📄 License

This project is licensed under the ISC License. See the `package.json` file for details.
