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
}

interface ToffeeChannelOutput {
  id: string
  title: string
  category: string
  genres: string[]
  badge: string
  logo: string
  streamUrl: string
  lastUpdated: string
}

const FIREBASE_AUTH_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyCv82eHAx0LaNvcJqOwumExKJen0_CzT1M'
const CONTENT_BASE_URL = 'https://content-prod.services.toffeelive.com/toffee/BD/DK/web'
const PLAYBACK_BASE_URL = 'https://entitlement-prod.services.toffeelive.com/toffee/BD/DK/web/playback'
const ASSETS_BASE_URL = 'https://assets-prod.services.toffeelive.com'

const EDITORIAL_RAILS = [
  '55fdb2bedaca2de399b470fb0ce14117',
  '911e8f640af3a8892b628714d4acc133',
  'be7d42854f019db42fbc22153674b888',
  'cceb01a3ecb01516539b0adad38c1400',
  '08d90cecf964eb9a5f6be2e1887066fd',
  'cb7ea308e7742680ea8df1aae153bc9b',
  '9988b22058e87ba742a8d734e640e759',
  '84a2451df95d2eb3d2b0d09c5fc34fb1',
  '36eff4e5ed817e63c4a0859a0e11f1d5'
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
      // Let standard http/https proxy handle or pass agent
    }
  }

  return axios.create(config)
}

async function getFirebaseAuthToken(client: AxiosInstance, logger: Logger): Promise<string> {
  logger.info('Authenticating anonymously with Firebase...')
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

async function fetchAllChannels(client: AxiosInstance, logger: Logger): Promise<Map<string, ToffeeChannelRaw>> {
  logger.info(`Fetching channels across ${EDITORIAL_RAILS.length} editorial rails...`)
  const channels = new Map<string, ToffeeChannelRaw>()

  for (const railId of EDITORIAL_RAILS) {
    try {
      const url = `${CONTENT_BASE_URL}/rail/generic/editorial-dynamic/${railId}`
      const response = await client.get(url)
      const items: ToffeeChannelRaw[] = response.data?.list || []

      for (const item of items) {
        if (item.id && (item.v_type === 'channels' || item.subType === 'Live_TV' || item.title)) {
          if (!channels.has(item.id)) {
            channels.set(item.id, item)
          }
        }
      }
    } catch (err: any) {
      logger.warn(`Could not fetch rail ${railId}: ${err.message}`)
    }
  }

  logger.info(`Discovered ${channels.size} unique live channels`)
  return channels
}

async function fetchStreamUrl(
  client: AxiosInstance,
  idToken: string,
  channelId: string
): Promise<string | null> {
  try {
    const url = `${PLAYBACK_BASE_URL}/${channelId}`
    const response = await client.post(
      url,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        }
      }
    )

    const playbackData = response.data?.playbackDetails?.data
    if (Array.isArray(playbackData) && playbackData.length > 0) {
      return playbackData[0].url || null
    }
    return null
  } catch {
    return null
  }
}

export async function main() {
  const logger = new Logger()
  logger.info('--- Starting Toffee Live Playlist Updater ---')

  const client = getHttpClient()
  const storage = new Storage(PLAYLIST_DIR)

  try {
    const idToken = await getFirebaseAuthToken(client, logger)
    const rawChannels = await fetchAllChannels(client, logger)

    const channelList = Array.from(rawChannels.values())
    const outputChannels: ToffeeChannelOutput[] = []
    const nowIso = new Date().toISOString()

    logger.info(`Resolving live playback streams for ${channelList.length} channels (concurrency: 5)...`)

    let completed = 0
    let successCount = 0

    await eachLimit(channelList, 5, async (channel: ToffeeChannelRaw) => {
      const streamUrl = await fetchStreamUrl(client, idToken, channel.id)
      completed++

      if (streamUrl) {
        successCount++
        const posterPath = channel.images?.[0]?.path
        const logoUrl = posterPath ? `${ASSETS_BASE_URL}/${posterPath}` : ''
        const category = channel.catogory?.[0] || channel.genres?.[0] || 'General'

        outputChannels.push({
          id: channel.id,
          title: channel.title.trim(),
          category,
          genres: channel.genres || [],
          badge: channel.badge?.[0] || 'Free',
          logo: logoUrl,
          streamUrl,
          lastUpdated: nowIso
        })
      }

      if (completed % 15 === 0 || completed === channelList.length) {
        logger.info(`Progress: ${completed}/${channelList.length} channels checked (${successCount} active)`)
      }
    })

    // Sort channels alphabetically by title
    outputChannels.sort((a, b) => a.title.localeCompare(b.title))

    logger.info(`Successfully resolved ${outputChannels.length} active live streams!`)

    // Build M3U Playlist
    let m3u = `#EXTM3U x-tvg-url=""${EOL}`
    for (const ch of outputChannels) {
      const sanitizedTitle = ch.title.replace(/[,"]/g, '')
      const logoAttr = ch.logo ? ` tvg-logo="${ch.logo}"` : ''
      const groupAttr = ch.category ? ` group-title="${ch.category}"` : ''

      m3u += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${sanitizedTitle}"${logoAttr}${groupAttr},${sanitizedTitle}${EOL}`
      m3u += `#EXTVLCOPT:http-referrer=${REFERER}${EOL}`
      m3u += `#EXTVLCOPT:http-user-agent=${USER_AGENT}${EOL}`
      m3u += `${ch.streamUrl}${EOL}`
    }

    // Build JSON metadata
    const jsonOutput = {
      name: 'Toffee Live IPTV Playlist',
      updatedAt: nowIso,
      totalChannels: outputChannels.length,
      channels: outputChannels
    }

    // Save files to playlist/
    await storage.save('toffee.m3u', m3u)
    logger.info(`Saved playlist/toffee.m3u (${outputChannels.length} channels)`)

    await storage.save('toffee.json', JSON.stringify(jsonOutput, null, 2))
    logger.info(`Saved playlist/toffee.json`)

    logger.info('--- Toffee Live Playlist Updater Finished Successfully ---')
  } catch (err: any) {
    logger.error(`Failed to update Toffee playlist: ${err.message}`)
    process.exit(1)
  }
}

main()
