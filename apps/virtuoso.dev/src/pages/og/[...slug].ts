import { OGImageRoute } from 'astro-og-canvas'
import { getCollection } from 'astro:content'

const entries = await getCollection('docs')
const pages = Object.fromEntries(entries.map(({ data, id }) => [id, { data }]))

export const { GET, getStaticPaths } = OGImageRoute({
  // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
  getImageOptions: ((_id, page: (typeof pages)[number]) => ({
    bgGradient: [[255, 255, 255]], // white background
    border: {
      color: [59, 130, 246], // blue-500 accent
      side: 'inline-start',
      width: 10,
    },
    description: page.data.description,
    font: {
      description: {
        color: [113, 113, 113], // muted-foreground oklch(0.556 0 0)
        size: 32,
      },
      title: {
        color: [23, 23, 23], // foreground oklch(0.145 0 0)
        size: 64,
      },
    },
    logo: {
      path: './public/logo@2x.png',
      size: [156, 27],
    },
    title: page.data.title,
  })) as Parameters<typeof OGImageRoute>[0]['getImageOptions'],
  pages,
  param: 'slug',
})
