/** Validated environment config — read once at startup */
export const env = {
  port: Number(process.env.PORT ?? 3001),

  // Hanzo Base
  baseUrl: process.env.BASE_URL ?? 'http://localhost:8090',
  baseAdminEmail: process.env.BASE_ADMIN_EMAIL ?? 'admin@hanzo.ai',
  baseAdminPassword: process.env.BASE_ADMIN_PASSWORD ?? '',

  // MinIO / S3
  s3Endpoint: process.env.S3_ENDPOINT ?? 'http://minio.hanzo.svc:9000',
  s3AccessKey: process.env.S3_ACCESS_KEY ?? 'hanzo',
  s3SecretKey: process.env.S3_SECRET_KEY ?? '',
  s3Bucket: process.env.S3_BUCKET ?? 'hub-files',
  s3Region: process.env.S3_REGION ?? 'us-east-1',

  // hanzo.id OAuth
  iamUrl: process.env.IAM_URL ?? 'https://hanzo.id',
  iamClientId: process.env.IAM_CLIENT_ID ?? 'app-bothub',
  iamClientSecret: process.env.IAM_CLIENT_SECRET ?? '',

  // OpenAI embeddings
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  embeddingDimensions: 1536,

  // External services
  githubToken: process.env.GITHUB_TOKEN ?? '',
  vtApiKey: process.env.VT_API_KEY ?? '',
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? '',

  // Public URL
  publicUrl: process.env.PUBLIC_URL ?? 'https://hub.hanzo.bot',
  apiUrl: process.env.API_URL ?? 'https://hub.hanzo.bot/api',
} as const
