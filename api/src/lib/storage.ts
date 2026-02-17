import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from './env.js'

const s3 = new S3Client({
  region: env.s3Region,
  endpoint: env.s3Endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.s3AccessKey,
    secretAccessKey: env.s3SecretKey,
  },
})

/** Generate a presigned upload URL (PUT) for the given key */
export async function generateUploadUrl(
  key: string,
  contentType = 'application/octet-stream',
  expiresIn = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(s3, command, { expiresIn })
}

/** Generate a presigned download URL (GET) for the given key */
export async function generateDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
  })
  return getSignedUrl(s3, command, { expiresIn })
}

/** Get a file from S3 as a Buffer */
export async function getFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
  })
  const response = await s3.send(command)
  const body = response.Body
  if (!body) throw new Error(`File not found: ${key}`)
  return Buffer.from(await body.transformToByteArray())
}

/** Put a file to S3 */
export async function putFile(
  key: string,
  data: Buffer | Uint8Array,
  contentType = 'application/octet-stream',
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
  })
  await s3.send(command)
}

/** Generate a storage key for a skill version file */
export function skillFileKey(skillId: string, versionId: string, path: string): string {
  return `skills/${skillId}/${versionId}/${path}`
}

/** Generate a storage key for a soul version file */
export function soulFileKey(soulId: string, versionId: string, path: string): string {
  return `souls/${soulId}/${versionId}/${path}`
}
