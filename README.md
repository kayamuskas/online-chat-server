### Run
docker compose -f infra/compose/compose.yaml down -v && docker compose -f infra/compose/compose.yaml up --build

### Tests
pnpm compose:smoke
pnpm test:e2e
