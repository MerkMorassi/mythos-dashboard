# MYTHOS DASHBOARD

Welcome to the MYTHOS DASHBOARD, a powerful, full-stack multi-tool AI assistant designed for creative and analytical tasks. This application leverages the Google Gemini API to provide a seamless interface for text generation, code analysis, image and video creation, Retrieval-Augmented Generation (RAG), and much more, all within a single, responsive dashboard.

---

## ✨ Key Features

-   **Multi-Tool Interface:** Seamlessly switch between a wide array of specialized AI tools for generation, analysis, and data management.
-   **Agentic System:** Interact with a hub of specialized AI agents (the MYTHOS LIAs), each with its own unique expertise, knowledge base, and customizable profile.
-   **Real-Time Streaming:** Text-based tools and agent responses stream in real-time for an interactive and responsive user experience.
-   **AI-Powered Media Generation:** Create stunning images and videos from simple text prompts using the latest models.
-   **Persistent Local Databases:**
    -   **AI Gallery:** All generated images are saved to a persistent gallery for later viewing and feedback.
    -   **Local Viewer:** Upload your own images for persistent storage and on-demand AI analysis.
    -   **RAG Knowledge Base:** Upload documents to agent-specific or common knowledge bases, enabling them to answer questions with grounded, accurate information.
-   **Advanced Chat Management:** Save, load, and search through chat sessions. Archive entire conversations into the RAG knowledge base for agents to learn from.
-   **Full-Stack & Standalone:** Runs as a single Node.js process that serves both the backend API and the frontend, simplifying setup and deployment.

---

## 🚀 Quick Start (Local Development)

This project requires **Node.js v18+** and a running **PostgreSQL v14+** instance with the **`pgvector`** extension enabled. For detailed setup, see the [**INSTALL_MANUAL.md**](INSTALL_MANUAL.md).

1.  **Clone & Install**
    ```bash
    git clone https://github.com/your-repo/mythos-dashboard.git
    cd mythos-dashboard
    npm install
    ```

2.  **Configure Environment**
    -   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    -   Edit the new `.env` file and add your Google Gemini API key and your PostgreSQL database connection details.

3.  **Run the Application**
    -   This single command starts the backend server, which also serves the frontend application. The first time it runs, it will automatically set up the necessary database tables.
        ```bash
        npm run dev
        ```

4.  **Open the Dashboard**
    -   Navigate to `http://localhost:3001` (or your configured port) in your browser.

---

## 🌐 Deployment

This application is designed to be deployed to a hosting environment that supports Node.js and PostgreSQL. For a complete, step-by-step deployment guide using a platform like **Render**, please refer to [**INSTALL_MANUAL.md**](INSTALL_MANUAL.md).

---

## 📄 License

This project is licensed under the ISC License. See the `package.json` file for details.
