import { createFileRoute } from '@tanstack/react-router'
import { PersonaDetailPage } from '../../components/PersonaDetailPage'
import { buildPersonaMeta, fetchPersonaMeta } from '../../lib/og'

export const Route = createFileRoute('/personas/$slug')({
  loader: async ({ params }) => {
    const data = await fetchPersonaMeta(params.slug)
    return {
      owner: data?.owner ?? null,
      displayName: data?.displayName ?? null,
      summary: data?.summary ?? null,
      version: data?.version ?? null,
    }
  },
  head: ({ params, loaderData }) => {
    const meta = buildPersonaMeta({
      slug: params.slug,
      owner: loaderData?.owner ?? null,
      displayName: loaderData?.displayName,
      summary: loaderData?.summary,
      version: loaderData?.version ?? null,
    })
    return {
      links: [
        {
          rel: 'canonical',
          href: meta.url,
        },
      ],
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
        { property: 'og:title', content: meta.title },
        { property: 'og:description', content: meta.description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: meta.url },
        { property: 'og:image', content: meta.image },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: meta.title },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: meta.title },
        { name: 'twitter:description', content: meta.description },
        { name: 'twitter:image', content: meta.image },
        { name: 'twitter:image:alt', content: meta.title },
      ],
    }
  },
  component: PersonaDetail,
})

function PersonaDetail() {
  const { slug } = Route.useParams()
  return <PersonaDetailPage slug={slug} />
}
