# Living Workflow

## Overview

Living Workflow is a guided workflow management system designed to feel like a mission control center rather than a traditional dashboard. The application provides step-by-step workflow tracking with approvals, intel documents, and activity logging. It emphasizes bold, gamified UI with motion and interactivity to create an engaging "quest-like" experience for daily work.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **Styling**: Tailwind CSS v4 with custom CSS variables for theming
- **UI Components**: shadcn/ui component library (New York style) with Radix UI primitives
- **Animations**: Framer Motion for motion and interactivity
- **Build Tool**: Vite with custom plugins for meta images and Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API under `/api/*` routes
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod with drizzle-zod integration

### Data Storage
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)

### Key Data Models
- **Workflows**: Main entities with steps, status tracking, and priority levels
- **Steps**: Individual workflow steps with status progression (locked → active → in_progress → pending_approval → completed)
- **Approvals**: Step approval requests with status tracking
- **Intel Docs**: Documentation attached to steps
- **Activities**: Activity logging for audit trails

### Project Structure
```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── pages/          # Route components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and API client
├── server/           # Express backend
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database operations
│   └── db.ts         # Database connection
├── shared/           # Shared code between client/server
│   └── schema.ts     # Drizzle schema definitions
└── migrations/       # Database migrations
```

### Design Philosophy
The UI follows a "mission control" aesthetic with:
- Dark theme with accent colors (primary: lime/green)
- Custom fonts: Oxanium (display), Space Grotesk (body), Space Mono (code)
- Subtle animations for system feedback and state changes
- Gamified elements like progress tracking and momentum indicators

## External Dependencies

### Database
- **PostgreSQL**: Primary data store via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### UI Libraries
- **Radix UI**: Accessible primitive components (dialogs, dropdowns, tooltips, etc.)
- **Framer Motion**: Animation library for motion effects
- **Lucide React**: Icon library
- **shadcn/ui**: Pre-built component patterns

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the stack

### Fonts (External)
- Google Fonts: Oxanium, Space Grotesk, Space Mono