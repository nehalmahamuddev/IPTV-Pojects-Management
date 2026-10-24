import { describe, it, expect } from 'vitest'
import * as fs from 'fs-extra'
import path from 'node:path'

describe('toffee:update', () => {
  it('generates valid playlist/toffee.m3u and playlist/toffee.json', () => {
    const m3uPath = path.resolve('playlist/toffee.m3u')
    const jsonPath = path.resolve('playlist/toffee.json')

    expect(fs.existsSync(m3uPath)).toBe(true)
    expect(fs.existsSync(jsonPath)).toBe(true)

    const m3uContent = fs.readFileSync(m3uPath, 'utf8')
    expect(m3uContent.startsWith('#EXTM3U')).toBe(true)
    expect(m3uContent).toContain('#EXTINF:-1')
    expect(m3uContent).toContain('tvg-id=')
    expect(m3uContent).toContain('group-title=')

    const jsonData = fs.readJsonSync(jsonPath)
    expect(jsonData.name).toBe('Toffee Live IPTV Playlist')
    expect(jsonData.totalDiscovered).toBeGreaterThan(0)
    expect(jsonData.totalPlayable).toBeGreaterThan(0)
    expect(Array.isArray(jsonData.channels)).toBe(true)
    expect(jsonData.channels[0]).toHaveProperty('id')
    expect(jsonData.channels[0]).toHaveProperty('title')
  })
})
