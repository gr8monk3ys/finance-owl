# Deploy the backend on Railway and the frontend on Vercel

The NestJS backend, Postgres and Redis run on Railway from `docker/Dockerfile.backend` (see `railway.toml`), while the SvelteKit frontend deploys to Vercel through `@sveltejs/adapter-vercel`. The backend needs long-lived processes (BullMQ workers and scheduled jobs) that serverless functions do not offer, and the frontend benefits from Vercel's edge delivery. The frontend also ships `@sveltejs/adapter-node` and the repo keeps `docker-compose.yml`, so self-hosting the whole stack remains possible. See `docs/deployment.md`.
