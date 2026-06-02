<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deployment-resource-upkeep -->
# Deployment resource upkeep

If a change affects Docker, services, ports, storage, Supabase schema, retention/archive behavior, cron/scheduled jobs, build output, or production env, update the Resource profile in `docs/deploy-docker-caddy.md` in the same change.
<!-- END:deployment-resource-upkeep -->
