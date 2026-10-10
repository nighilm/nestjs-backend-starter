# NestJS Backend Starter

A reusable foundation for building secure, maintainable REST APIs with NestJS, TypeScript, Prisma, and PostgreSQL. Includes cookie-based server-side authentication, database health checks, environment validation, API documentation, testing, and Docker deployment support.

Designed to be cloned or used as a template for new backend projects.

## Tech Stack

- **Runtime:** Node.js 24.11+
- **Framework:** NestJS
- **Language:** TypeScript
- **Database:** PostgreSQL 16+
- **ORM:** Prisma 7 with the PostgreSQL `pg` driver adapter
- **Authentication:** Server-side sessions with HttpOnly cookies
- **Validation:** `class-validator` and `class-transformer`
- **API Documentation:** Swagger / OpenAPI
- **Testing:** Jest and NestJS testing utilities
- **Deployment:** Docker and Docker Compose

## Features

- Modular NestJS architecture
- Session-based authentication with login, logout, and current-user endpoints
- PostgreSQL-backed session persistence and revocation
- Secure cookie configuration and session expiration
- Environment configuration and validation
- Database-backed health endpoint
- Swagger API documentation
- Unit and end-to-end testing foundations
- Docker-based deployment with persistent PostgreSQL storage
- Prisma migrations and optional development seed data
- ESLint and code formatting support

## Project Structure

```text
.
├── prisma/
│   └── migrations/
├── src/
│   ├── common/          # Shared utilities and infrastructure
│   ├── config/          # Application configuration
│   ├── database/        # Prisma and database integration
│   ├── modules/
│   │   ├── auth/        # Authentication and session management
│   │   └── health/      # Application and database health
│   ├── app.module.ts
│   └── main.ts
├── test/                # End-to-end tests
├── docker-compose.yml
├── Dockerfile
├── prisma.config.ts
├── .env.example
└── package.json
```

Feature-specific code belongs in `src/modules/<feature>`. Each feature should own its controllers, services, DTOs, and tests where appropriate. Shared infrastructure should remain in `src/common`, `src/config`, and `src/database`.

## Prerequisites

Install the following before starting:

- Node.js 24.11 or later
- npm
- PostgreSQL 16 or later, or Docker
- Git

Use the Node.js version supported by the project's package configuration and CI environment.

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd <your-project-directory>
```

Install dependencies:

```bash
npm ci
```

### 2. Configure environment variables

Create a local environment file:

```bash
cp .env.example .env
```

Configure at least the following:

```dotenv
NODE_ENV=development
PORT=3000
API_PREFIX=api

DATABASE_URL=postgresql://<username>:<password>@localhost:5432/<database>

FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

SESSION_COOKIE_NAME=session
SESSION_IDLE_TIMEOUT_SECONDS=86400
SESSION_ABSOLUTE_TIMEOUT_SECONDS=604800
SESSION_ACTIVITY_REFRESH_SECONDS=3600
SESSION_SECURE=false
SESSION_SAME_SITE=lax

SWAGGER_ENABLED=true

SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=<unique-development-password>
SEED_ADMIN_NAME=Development Admin
```

Use the actual variable names and formats defined in `.env.example`. The values above illustrate a typical local setup; remove any variables that are not supported by the current configuration.

**Never commit `.env` or production secrets.** Keep `.env.example` limited to variable names and safe development placeholders.

### 3. Prepare the database

Ensure PostgreSQL is running and that the configured database exists.

Generate the Prisma client:

```bash
npm run prisma:generate
```

Apply migrations:

```bash
npm run prisma:migrate
```

Optionally create a development user:

```bash
npm run prisma:seed
```

The seed process reads its values from the seed-related environment variables. It is disabled in production and does not modify an existing user.

### 4. Start the application

```bash
npm run start:dev
```

The API is available at:

```text
http://localhost:3000/api
```

When enabled, Swagger UI is available at:

```text
http://localhost:3000/api/docs
```

Check application and database health at:

```text
http://localhost:3000/api/health
```

## Environment Variables

| Variable                           | Purpose                                   |
| ---------------------------------- | ----------------------------------------- |
| `NODE_ENV`                         | Application environment                   |
| `PORT`                             | HTTP server port                          |
| `API_PREFIX`                       | API route prefix                          |
| `DATABASE_URL`                     | PostgreSQL connection string              |
| `FRONTEND_URL`                     | Trusted frontend origin                   |
| `CORS_ORIGIN`                      | Comma-separated allowed origins           |
| `SESSION_COOKIE_NAME`              | Session cookie name                       |
| `SESSION_IDLE_TIMEOUT_SECONDS`     | Idle session expiration                   |
| `SESSION_ABSOLUTE_TIMEOUT_SECONDS` | Maximum session lifetime                  |
| `SESSION_ACTIVITY_REFRESH_SECONDS` | Minimum interval between activity updates |
| `SESSION_SECURE`                   | Whether cookies require HTTPS             |
| `SESSION_SAME_SITE`                | Cookie SameSite policy                    |
| `SWAGGER_ENABLED`                  | Whether Swagger is enabled                |
| `SEED_ADMIN_EMAIL`                 | Development seed email                    |
| `SEED_ADMIN_PASSWORD`              | Development seed password                 |
| `SEED_ADMIN_NAME`                  | Development seed display name             |

Refer to `.env.example` and the configuration implementation for exact defaults and validation rules. Production configuration should fail safely when required settings are missing or invalid.

## Authentication

This starter uses server-side sessions rather than JWT-based browser authentication.

### Available endpoints

| Method | Endpoint           | Purpose                                  |
| ------ | ------------------ | ---------------------------------------- |
| `POST` | `/api/auth/login`  | Authenticate a user and create a session |
| `GET`  | `/api/auth/me`     | Retrieve the authenticated user          |
| `POST` | `/api/auth/logout` | Revoke the current session               |
| `GET`  | `/api/health`      | Check application and database health    |
| `GET`  | `/api/docs`        | Open Swagger documentation when enabled  |

### Session flow

1. The client submits login credentials over HTTPS in production.
2. The server validates the credentials and creates a session.
3. The server returns an HttpOnly cookie containing an opaque session credential.
4. Session data is persisted in PostgreSQL; the session secret is stored as a hash.
5. Subsequent requests send the cookie automatically.
6. The current-user endpoint restores the client's authentication state.
7. Logout revokes the session and clears the cookie.

The API returns only safe user fields, such as `id`, `email`, and `name`. It does not return session secrets, password hashes, or JWTs.

### Frontend integration

For a React or other browser-based frontend:

- Enable credentials on API requests, for example with Axios `withCredentials: true`.
- Restore the current user using `GET /api/auth/me`.
- Keep authentication state in a query cache or other suitable in-memory state.
- Do not store session credentials in `localStorage`, `sessionStorage`, or frontend environment variables.
- Configure CORS for explicit trusted origins and enable credentials.
- Use appropriate CSRF protections for state-changing requests.

## Development Commands

Run the scripts defined in `package.json`. Common commands include:

```bash
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm run format
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run prisma:studio
```

Check `package.json` for the exact supported script names and options. Tests that override Prisma with mocks can usually run without a live database, although application configuration may still require a valid `DATABASE_URL`.

## Docker Deployment

The repository includes Docker support for running the API and PostgreSQL.

Configure the deployment environment or an untracked root `.env` file with the variables required by `docker-compose.yml`, including the database credentials, connection string, frontend origins, and session settings.

When the Compose configuration is ready:

```bash
docker compose build app
docker compose up -d
```

The application image is configured to run as a non-root user. PostgreSQL data is persisted in a named volume, and pending migrations are applied during application startup as configured by the deployment.

For production, consider running migrations as a dedicated release step to avoid multiple application replicas attempting migration work concurrently.

## Production Security Checklist

Before exposing an application publicly:

- Use HTTPS and Secure session cookies.
- Use a strong, unique database password and managed secret storage.
- Configure `SESSION_COOKIE_NAME=__Host-session` when using the corresponding Secure cookie settings.
- Set `FRONTEND_URL` and `CORS_ORIGIN` to explicitly trusted origins.
- Ensure CSRF protections cover state-changing requests.
- Add login rate limiting and abuse protection.
- Validate request bodies and enforce authorization on protected endpoints.
- Revoke sessions after password changes, account recovery, privilege changes, and suspicious activity.
- Restrict database network access and maintain tested backups.
- Disable Swagger in production unless access is intentionally controlled.
- Configure centralized logging, monitoring, and alerting.
- Avoid logging passwords, session credentials, or other sensitive information.
- Keep dependencies, Node.js, NestJS, and Prisma updated.

## Using This Repository as a Template

When starting a new project:

1. Create a new repository from this template or clone it into a new project directory.
2. Rename the project and update package metadata.
3. Configure environment variables and database settings.
4. Apply migrations and verify authentication and health endpoints.
5. Add domain-specific modules under `src/modules`.
6. Add DTO validation, authorization rules, and tests for each new feature.
7. Update the README with the new application's purpose, endpoints, and deployment instructions.

Keep authentication and infrastructure generic. Business-specific models, routes, permissions, and seed data should live in the projects that use this starter.

## License

Add the license appropriate for your project before distributing this template.
