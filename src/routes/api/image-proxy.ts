import { createFileRoute } from '@tanstack/react-router'
import { downloadMedia } from '@/server/media'

export const Route = createFileRoute('/api/image-proxy')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const targetUrl = url.searchParams.get('url')
          if (!targetUrl) {
            return new Response('Missing "url" parameter', { status: 400 })
          }

          if (!/^https?:\/\//i.test(targetUrl)) {
            return new Response('Invalid url scheme', { status: 400 })
          }

          const media = await downloadMedia(targetUrl, 'jpg')
          const mime =
            media.extension === 'png'
              ? 'image/png'
              : media.extension === 'webp'
              ? 'image/webp'
              : media.extension === 'gif'
              ? 'image/gif'
              : media.extension === 'svg'
              ? 'image/svg+xml'
              : 'image/jpeg'

          return new Response(media.buffer as any, {
            headers: {
              'content-type': mime,
              'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
              'access-control-allow-origin': '*',
            },
          })
        } catch (error: any) {
          return new Response(`Failed to fetch image: ${error?.message || error}`, {
            status: 502,
          })
        }
      },
    },
  },
})
