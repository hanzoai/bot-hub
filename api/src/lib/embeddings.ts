import { env } from './env.js'

export const EMBEDDING_DIMENSIONS = 1536

/** Generate an embedding vector using OpenAI API */
export async function generateEmbedding(text: string): Promise<number[]> {
  const maxRetries = 3

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: env.embeddingModel,
          input: text,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error (${response.status}): ${error}`)
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>
      }
      return data.data[0].embedding
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
    }
  }

  throw new Error('Embedding generation failed after retries')
}

/** Build embedding text from skill metadata */
export function buildEmbeddingText(
  displayName: string,
  slug: string,
  summary: string | null | undefined,
  readmeBody: string | null | undefined,
): string {
  const parts = [`Name: ${displayName}`, `Slug: ${slug}`]
  if (summary) parts.push(`Summary: ${summary}`)
  if (readmeBody) parts.push(`Description: ${readmeBody.slice(0, 8000)}`)
  return parts.join('\n')
}
