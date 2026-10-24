import { Logger } from '@freearhey/core'
import { Storage } from '@freearhey/storage-js'
import { PLAYLIST_DIR, EOL } from '../../constants'
import { eachLimit } from 'async'
import axios, { AxiosInstance } from 'axios'
import { SocksProxyAgent } from 'socks-proxy-agent'

interface ToffeeChannelRaw {
  id: string
  title: string
  catogory?: string[]
  genres?: string[]
  subType?: string
  v_type?: string
  badge?: string[]
  images?: Array<{ path: string; ratio?: string }>
  railGroup?: string
}

interface ToffeeChannelOutput {
  id: string
  title: string
  category: string
  genres: string[]
  badge: string
  logo: string
  streamUrl?: string
  status: 'active' | 'premium_subscription_required' | 'offline'
  lastUpdated: string
}

const FIREBASE_AUTH_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyCv82eHAx0LaNvcJqOwumExKJen0_CzT1M'
const CONTENT_BASE_URL = 'https://content-prod.services.toffeelive.com/toffee/BD/DK/web'
const PLAYBACK_BASE_URL = 'https://entitlement-prod.services.toffeelive.com/toffee/BD/DK/web/playback'
const ASSETS_BASE_URL = 'https://assets-prod.services.toffeelive.com'

// Additional curated trending/home rails to ensure 100% channel discovery
const HOME_EDITORIAL_RAILS = [
  'rail/generic/editorial-dynamic/55fdb2bedaca2de399b470fb0ce14117',
  'rail/generic/editorial-dynamic/911e8f640af3a8892b628714d4acc133',
  'rail/generic/editorial-dynamic/be7d42854f019db42fbc22153674b888',
  'rail/generic/editorial-dynamic/cceb01a3ecb01516539b0adad38c1400',
  'rail/generic/editorial-dynamic/08d90cecf964eb9a5f6be2e1887066fd',
  'rail/generic/editorial-dynamic/cb7ea308e7742680ea8df1aae153bc9b',
  'rail/generic/editorial-dynamic/9988b22058e87ba742a8d734e640e759',
  'rail/generic/editorial-dynamic/84a2451df95d2eb3d2b0d09c5fc34fb1',
  'rail/generic/editorial-dynamic/36eff4e5ed817e63c4a0859a0e11f1d5'
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const REFERER = 'https://toffeelive.com/'
const ORIGIN = 'https://toffeelive.com'

function getHttpClient(): AxiosInstance {
  const proxyUrl = process.env.TOFFEE_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY
  const config: Record<string, any> = {
    timeout: 15000,
    headers: {
      'User-Agent': USER_AGENT,
      Origin: ORIGIN,
      Referer: REFERER
    }
  }

  if (proxyUrl) {
    if (proxyUrl.startsWith('socks')) {
      const agent = new SocksProxyAgent(proxyUrl)
      config.httpAgent = agent
      config.httpsAgent = agent
    } else {
      config.proxy = false
    }
  }

  return axios.create(config)
}

function normalizeCategory(railTitle?: string, fallbackGenre?: string): string {
  if (!railTitle) return fallbackGenre || 'General'

  const title = railTitle.trim()
  if (/sports/i.test(title)) return 'Sports'
  if (/news/i.test(title)) return 'News'
  if (/movie/i.test(title)) return 'Movies'
  if (/entertainment/i.test(title)) return 'Entertainment'
  if (/kids/i.test(title)) return 'Kids'
  if (/infotainment|discovery|documentary/i.test(title)) return 'Infotainment'
  if (/islamic/i.test(title)) return 'Islamic'
  if (/বাংলাদেশি|bangla/i.test(title)) return 'Bangladeshi'

  return fallbackGenre || title
}

async function getAuthToken(client: AxiosInstance, logger: Logger): Promise<string> {
  const customToken = process.env.TOFFEE_AUTH_TOKEN || process.env.TOFFEE_DEVICE_TOKEN
  if (customToken) {
    logger.info('Using custom TOFFEE_AUTH_TOKEN / TOFFEE_DEVICE_TOKEN from environment')
    return customToken
  }

  logger.info('Authenticating anonymously with Firebase for public guest token...')
  const response = await client.post(
    FIREBASE_AUTH_URL,
    { returnSecureToken: true },
    {
      headers: { 'Content-Type': 'application/json' }
    }
  )

  const { idToken } = response.data
  if (!idToken) {
    throw new Error('Failed to obtain Firebase idToken')
  }

  return idToken
}

async function fetchLiveTVRails(client: AxiosInstance, logger: Logger): Promise<Array<{ apiPath: string; title: string }>> {
  const rails: Array<{ apiPath: string; title: string }> = []
  try {
    const url = `${CONTENT_BASE_URL}/view/live`
    const res = await client.get(url)
    const list = res.data?.rails?.list || []
    for (const r of list) {
      if (r.apiPath) {
        rails.push({ apiPath: r.apiPath, title: r.title || 'Live TV' })
      }
    }
    logger.info(`Discovered ${rails.length} live categories from /web/view/live`)
  } catch (err: any) {
    logger.warn(`Could not load /web/view/live: ${err.message}`)
  }

  // Also include any fallback home rails
  for (const homeRail of HOME_EDITORIAL_RAILS) {
    if (!rails.some(r => r.apiPath === homeRail)) {
      rails.push({ apiPath: homeRail, title: 'Featured' })
    }
  }

  return rails
}

async function fetchAllChannels(client: AxiosInstance, logger: Logger): Promise<Map<string, ToffeeChannelRaw>> {
  const rails = await fetchLiveTVRails(client, logger)
  logger.info(`Fetching channels across ${rails.length} total rails...`)
  const channels = new Map<string, ToffeeChannelRaw>()

  for (const rail of rails) {
    try {
      const url = `${CONTENT_BASE_URL}/${rail.apiPath}`
      const response = await client.get(url)
      const items: ToffeeChannelRaw[] = response.data?.list || []

      for (const item of items) {
        if (item.id && (item.v_type === 'channels' || item.subType === 'Live_TV' || item.title)) {
          if (!channels.has(item.id)) {
            item.railGroup = rail.title
            channels.set(item.id, item)
          }
        }
      }
    } catch (err: any) {
      logger.warn(`Could not fetch rail ${rail.apiPath}: ${err.message}`)
    }
  }

  logger.info(`Discovered ${channels.size} unique live channels in total`)
  return channels
}

async function fetchStreamUrl(
  client: AxiosInstance,
  authToken: string,
  channelId: string
): Promise<{ streamUrl: string | null; isDenied: boolean }> {
  try {
    const url = `${PLAYBACK_BASE_URL}/${channelId}`
    const response = await client.post(
      url,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      }
    )

    const data = response.data
    if (data.access === 'deny') {
      return { streamUrl: null, isDenied: true }
    }

    const playbackData = data?.playbackDetails?.data
    if (Array.isArray(playbackData) && playbackData.length > 0) {
      return { streamUrl: playbackData[0].url || null, isDenied: false }
    }

    return { streamUrl: null, isDenied: false }
  } catch {
    return { streamUrl: null, isDenied: false }
  }
}

export async function main() {
  const logger = new Logger()
  logger.info('=== Starting Comprehensive Toffee Live Playlist Updater ===')

  const client = getHttpClient()
  const storage = new Storage(PLAYLIST_DIR)

  try {
    const authToken = await getAuthToken(client, logger)
    const rawChannels = await fetchAllChannels(client, logger)

    const channelList = Array.from(rawChannels.values())
    const outputChannels: ToffeeChannelOutput[] = []
    const nowIso = new Date().toISOString()

    logger.info(`Resolving live playback streams for all ${channelList.length} channels (concurrency: 5)...`)

    let completed = 0
    let activeCount = 0
    let deniedCount = 0

    await eachLimit(channelList, 5, async (channel: ToffeeChannelRaw) => {
      const { streamUrl, isDenied } = await fetchStreamUrl(client, authToken, channel.id)
      completed++

      const posterPath = channel.images?.[0]?.path
      const logoUrl = posterPath ? `${ASSETS_BASE_URL}/${posterPath}` : ''
      const fallbackGenre = channel.catogory?.[0] || channel.genres?.[0]
      const category = normalizeCategory(channel.railGroup, fallbackGenre)
      const badge = channel.badge?.[0] || (isDenied ? 'Premium' : 'Free')

      if (streamUrl) {
        activeCount++
        outputChannels.push({
          id: channel.id,
          title: channel.title.trim(),
          category,
          genres: channel.genres || [],
          badge,
          logo: logoUrl,
          streamUrl,
          status: 'active',
          lastUpdated: nowIso
        })
      } else {
        if (isDenied) deniedCount++
        outputChannels.push({
          id: channel.id,
          title: channel.title.trim(),
          category,
          genres: channel.genres || [],
          badge,
          logo: logoUrl,
          status: isDenied ? 'premium_subscription_required' : 'offline',
          lastUpdated: nowIso
        })
      }

      if (completed % 20 === 0 || completed === channelList.length) {
        logger.info(
          `Progress: ${completed}/${channelList.length} checked (${activeCount} active, ${deniedCount} premium subscription required)`
        )
      }
    })

    // Sort channels alphabetically by title
    outputChannels.sort((a, b) => a.title.localeCompare(b.title))

    const playableChannels = outputChannels.filter(c => c.status === 'active' && c.streamUrl)
    logger.info(
      `Resolved ${playableChannels.length} active live streams out of ${outputChannels.length} total channels!`
    )

    // Build M3U Playlist with all playable channels
    let m3u = `#EXTM3U x-tvg-url=""${EOL}`
    for (const ch of playableChannels) {
      const sanitizedTitle = ch.title.replace(/[,"]/g, '')
      const logoAttr = ch.logo ? ` tvg-logo="${ch.logo}"` : ''
      const groupAttr = ch.category ? ` group-title="${ch.category}"` : ''

      m3u += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${sanitizedTitle}"${logoAttr}${groupAttr},${sanitizedTitle}${EOL}`
      m3u += `#EXTVLCOPT:http-referrer=${REFERER}${EOL}`
      m3u += `#EXTVLCOPT:http-user-agent=${USER_AGENT}${EOL}`
      m3u += `${ch.streamUrl}${EOL}`
    }

    // Build JSON metadata with full channel catalog
    const jsonOutput = {
      name: 'Toffee Live IPTV Playlist',
      updatedAt: nowIso,
      totalDiscovered: outputChannels.length,
      totalPlayable: playableChannels.length,
      channels: outputChannels
    }

    // Save files to playlist/
    await storage.save('toffee.m3u', m3u)
    logger.info(`Saved playlist/toffee.m3u (${playableChannels.length} active channels)`)

    await storage.save('toffee.json', JSON.stringify(jsonOutput, null, 2))
    logger.info(`Saved playlist/toffee.json (${outputChannels.length} total channels cataloged)`)

    logger.info('=== Toffee Live Playlist Updater Finished Successfully ===')
  } catch (err: any) {
    logger.error(`Failed to update Toffee playlist: ${err.message}`)
    process.exit(1)
  }
}

main()
