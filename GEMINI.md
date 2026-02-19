# Gemini Project Documentation

This document provides a comprehensive overview of the project, its structure, and how to work with it effectively.

## Project Overview

This is a web application built with a modern frontend stack. The primary technologies used are:

- **Vite:** A fast build tool and development server.
- **React:** A JavaScript library for building user interfaces.
- **TypeScript:** A statically typed superset of JavaScript.
- **shadcn-ui:** A collection of reusable UI components.
- **Tailwind CSS:** A utility-first CSS framework.
- **Supabase:** An open-source Firebase alternative for backend services like database, authentication, and storage.

The project is structured as a single-page application (SPA) with client-side routing.

## Getting Started

To run the project locally, you'll need to have Node.js and npm installed.

1.  **Clone the repository:**
    ```bash
    git clone <YOUR_GIT_URL>
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd <YOUR_PROJECT_NAME>
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This will start the development server, and you can view the application in your browser at `http://localhost:8080`.

## Project Structure

Here's an overview of the most important files and directories:

-   `public/`: Contains static assets like images and fonts.
-   `src/`: The main source code of the application.
    -   `components/`: Reusable React components.
        -   `ui/`: Components from shadcn-ui.
    -   `hooks/`: Custom React hooks.
    -   `integrations/`: Modules for integrating with third-party services like Supabase.
    -   `lib/`: Utility functions and libraries.
    -   `pages/`: Top-level page components for each route.
    -   `App.tsx`: The root component of the application, which sets up the routing.
    -   `main.tsx`: The entry point of the application.
-   `supabase/`: Contains Supabase-related files, including database migrations and serverless functions.
-   `package.json`: Lists the project's dependencies and scripts.
-   `vite.config.ts`: The configuration file for Vite.
-   `tailwind.config.ts`: The configuration file for Tailwind CSS.
-   `tsconfig.json`: The configuration file for TypeScript.

## Building the Project

To build the project for production, run the following command:

```bash
npm run build
```

This will create a `dist` directory with the optimized and bundled files for deployment.

## Linting

To check the code for any linting errors, run the following command:

```bash
npm run lint
```

## Backend

The project uses Supabase for its backend. The `supabase/` directory contains all the necessary files for managing the Supabase project, including:

-   **Database migrations:** The `supabase/migrations` directory contains SQL files that define the database schema.
-   **Serverless Functions:** The `supabase/functions` directory contains serverless functions written in TypeScript.

The Supabase client is initialized in `src/integrations/supabase/client.ts` and can be used to interact with the Supabase backend.

## Key Dependencies

Here's a list of some of the key dependencies used in the project:

-   **`@supabase/supabase-js`**: The official JavaScript client for Supabase.
-   **`@tanstack/react-query`**: A data-fetching library that provides caching, background refetching, and more.
-   **`react-router-dom`**: A library for routing in React applications.
-   **`zod`**: A TypeScript-first schema declaration and validation library.
-   **`shadcn-ui`**: A collection of reusable UI components built with Radix UI and Tailwind CSS.
