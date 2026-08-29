# Dev HR Management & Webbriks Monorepo

Welcome to the Dev HR Management monorepo! This repository contains the complete suite of applications that power the Webbriks platform, including the main corporate website, the core ERP/HR dashboard, a dedicated customer support application, and a robust Node.js backend.

## 🏗️ Architecture & Apps

This project is a monorepo consisting of 4 main applications:

1. **Dashboard (`/dashboard`)**: The core ERP and HR management system for internal staff. Built with Next.js, featuring real-time features, payroll, attendance, client management, and extensive analytics.
2. **Support (`/support`)**: A dedicated live chat and ticketing application for customer support agents. Built with Next.js, integrating Socket.io for real-time messaging with visitors from the main website.
3. **Webbriks (`/webbriks`)**: The public-facing corporate website and portfolio. Built with Next.js, it includes a floating AI chat widget that connects visitors to live support agents in real-time.
4. **Server (`/server`)**: The unified backend API powering all frontend applications. Built with Node.js, Express, TypeScript, and MongoDB. Handles authentication, real-time sockets (Socket.io), database operations, and third-party integrations (S3, Cloudinary).

## 🛠️ Technology Stack

- **Frontend Framework:** Next.js (App Router), React
- **Styling:** Tailwind CSS, Shadcn UI
- **State Management:** Redux Toolkit (RTK Query)
- **Backend Framework:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Authentication:** Better Auth, JWT
- **Real-time:** Socket.io
- **Storage:** AWS S3 (Presigned URLs), Cloudinary
- **Language:** TypeScript across the entire stack

## 🚀 Getting Started

#### Prerequisites
- Node.js (v18 or higher)
- MongoDB instance (local or Atlas) — **must** be a replica set; the app's order/quotation flows use multi-document transactions
- Redis — used for queues/caching (`REDIS_URL`, defaults to `redis://localhost:6379`)

Each app reads its config from a local `.env` file (see the keys referenced
in `server/src/config/env.config.ts` and each frontend's `NEXT_PUBLIC_*`
usage). Run every app with `npm run dev`.

### 1. Backend Server Setup
```bash
cd server
npm install
# Configure your .env file
npm run dev
```

### 2. Main Dashboard Setup
```bash
cd dashboard
npm install
# Configure your .env file
npm run dev
```

### 3. Support App Setup
```bash
cd support
npm install
# Configure your .env file
npm run dev
```

### 4. Webbriks Website Setup
```bash
cd webbriks
npm install
# Configure your .env file
npm run dev
```

## 📦 Build Commands

Each application can be built for production using standard Next.js and TypeScript build commands:

- Server: `cd server && npm run build` (Compiles TypeScript)
- Dashboard: `cd dashboard && npm run build` (Next.js build)
- Support: `cd support && npm run build` (Next.js build)
- Webbriks: `cd webbriks && npm run build` (Next.js build)

## 💡 Key Features

- **Unified Authentication:** The dashboard app hosts the sign-in / sign-up / password-reset pages. The backend issues a session cookie scoped to `.webbriks.com`, so signing in on the dashboard also authenticates the support app (single sign-on). The support app redirects unauthenticated users to the dashboard's `/sign-in`.
- **Live Support System:** Visitors on the Webbriks site can chat with an AI assistant or escalate to a live human agent. Agents manage these chats in real-time via the Support app.
- **Client Recognition:** The system automatically recognizes existing clients based on their email when they request support.
- **Comprehensive HR:** Full suite of HR tools including attendance tracking, payroll processing, leave management, and staff performance metrics.

---
*Developed and maintained by the Webbriks Engineering Team.*
