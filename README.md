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

### Option A: Backend via Docker Compose (recommended for local backend dev)

Brings up MongoDB (single-node replica set, required for the app's
transactional flows), Redis, and the server in watch mode with one command
— no local Mongo/Redis install needed.

```bash
docker-compose up
```

The server listens on `http://localhost:5000`. All server environment
values in `docker-compose.yml` are local-dev-only placeholders — SMTP- and
Cloudinary-dependent features (email sending, image upload) won't actually
work until you replace those with real credentials. Only the backend is
containerized; run the frontend apps (`dashboard`, `support`, `webbriks`)
directly with `npm run dev` as described below.

### Option B: Manual setup

#### Prerequisites
- Node.js (v18 or higher)
- MongoDB instance (local or Atlas) — must be configured as a replica set for transactional flows to work
- Redis (optional, for queuing)

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

- **Unified Authentication:** Seamless single sign-on experience across the dashboard and support apps using Better Auth.
- **Live Support System:** Visitors on the Webbriks site can chat with an AI assistant or escalate to a live human agent. Agents manage these chats in real-time via the Support app.
- **Client Recognition:** The system automatically recognizes existing clients based on their email when they request support.
- **Comprehensive HR:** Full suite of HR tools including attendance tracking, payroll processing, leave management, and staff performance metrics.

---
*Developed and maintained by the Webbriks Engineering Team.*
