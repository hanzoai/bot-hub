/** Validated environment config — read once at startup */
export const env = {
  port: Number(process.env.PORT ?? 3001),

  // The skills API is served at api.hanzo.ai/v1/skills; this is the origin its
  // own absolute URLs (the sign-in callback) are built on.
  apiUrl: process.env.API_URL ?? 'https://api.hanzo.ai',

  // Hanzo Base, run beside the API in the same pod and bound to loopback
  // (docker-entrypoint.sh). The address is fixed there; BASE_URL only moves it
  // for a local API that talks to a Base started by hand.
  baseUrl: process.env.BASE_URL ?? 'http://127.0.0.1:8090',

  // MinIO / S3
  s3Endpoint: process.env.S3_ENDPOINT ?? 'http://minio.hanzo.svc:9000',
  s3AccessKey: process.env.S3_ACCESS_KEY ?? 'hanzo',
  s3SecretKey: process.env.S3_SECRET_KEY ?? '',
  s3Bucket: process.env.S3_BUCKET ?? 'hub-files',
  s3Region: process.env.S3_REGION ?? 'us-east-1',

  // hanzo.id OAuth. The endpoints are the ones its discovery document names
  // (https://hanzo.id/.well-known/openid-configuration), all under /v1/iam.
  iamUrl: process.env.IAM_URL ?? 'https://hanzo.id',
  iamClientId: process.env.IAM_CLIENT_ID ?? 'hanzo-bothub',
  iamClientSecret: process.env.IAM_CLIENT_SECRET ?? '',

  // Embeddings go through api.hanzo.ai like every other model call. With no
  // key, search is lexical only.
  hanzoApiKey: process.env.HANZO_API_KEY ?? '',
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  embeddingDimensions: 1536,

  // External services
  githubToken: process.env.GITHUB_TOKEN ?? '',
  vtApiKey: process.env.VT_API_KEY ?? '',
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? '',

  // The site a signed-in visitor returns to when the sign-in named none.
  publicUrl: process.env.PUBLIC_URL ?? 'https://hub.hanzo.bot',
} as const

/** Origins the web app is served from; sign-in returns only to one of these. */
export const siteOrigins = new Set([
  'https://hub.hanzo.bot',
  'https://market.hanzo.bot',
  'https://skills.hanzo.bot',
  'http://localhost:3000',
  'http://localhost:5173',
])
