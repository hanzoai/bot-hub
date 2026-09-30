// Every route is under /v1/skills, the address api.hanzo.ai serves the hub at.
export const ApiRoutes = {
  search: '/v1/skills/search',
  resolve: '/v1/skills/resolve',
  download: '/v1/skills/download',
  skills: '/v1/skills',
  stars: '/v1/skills/stars',
  personas: '/v1/skills/personas',
  users: '/v1/skills/users',
  whoami: '/v1/skills/whoami',
  telemetrySync: '/v1/skills/telemetry/sync',
} as const
