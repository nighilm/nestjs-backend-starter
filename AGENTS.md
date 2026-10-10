# Repository guidance

## Project layout

- The NestJS application is in `backend/`; run npm and Prisma commands from that directory.
- Keep feature code inside `backend/src/modules/<feature>` and shared infrastructure in `common`, `config`, or `database` only when it is genuinely shared.
- PostgreSQL schema and migration history live in `backend/prisma/`.

## Configuration and secrets

- Use environment variables for database credentials, JWT secrets, and seed credentials. Never add real secrets or local `.env` files to source control.
- Keep `backend/.env.example` and the root `.env.example` synchronized with their separate local-app and Docker Compose purposes.
- Do not introduce fallback production credentials, permissive CORS defaults, or a production seed path.

## Prisma workflow

- After editing `backend/prisma/schema.prisma`, run `npm run prisma:generate` and create a new migration with `npm run prisma:migrate` against a development database.
- Commit the resulting migration directory and `migration_lock.toml`. Never edit a migration that may already have been applied; create a follow-up migration instead.
- For deployments, use `npm run prisma:migrate:deploy` as a release step before starting the new application version. Do not use `migrate dev` in production.
- The development seeder is `backend/prisma/seed.ts`. It requires explicit seed credentials, hashes passwords, is idempotent, and must remain disabled in production. Do not add default passwords or seed real production users.

## Verification

- From `backend/`, use `npm run lint`, `npm run build`, `npm test -- --runInBand`, and `npm run test:e2e -- --runInBand` for code changes.
- Check Prisma changes with `npx prisma validate` and `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`; database-backed migration and seed behavior still requires PostgreSQL.
- The e2e suite mocks Prisma. Do not treat it as proof of database connectivity or applied migration state.
- Keep documentation and scripts aligned when changing environment variables, migration commands, or seeding behavior.
