# Toffee Live M3U Playlist Automation

Automated scraping and M3U playlist generation for Toffee Live streaming service.

## 🎯 Features

- ✅ Scrapes all live channels from Toffee Live API
- ✅ Generates M3U playlist with channel metadata
- ✅ Exports JSON format with full channel information
- ✅ Automated updates via GitHub Actions (every 6 hours)
- ✅ Automatic releases with downloadable playlists
- ✅ Rate limiting and retry logic
- ✅ Error handling and logging

## 📋 Requirements

- Python 3.11+
- `requests` library
- Toffee Live device token (optional for public channels)

## 🚀 Quick Start

### Local Usage

1. **Install dependencies:**
```bash
pip install requests
```

2. **Run the generator:**
```bash
# Without authentication (public channels only)
python generate_playlist.py

# With device token
python generate_playlist.py --token YOUR_DEVICE_TOKEN

# Custom output name
python generate_playlist.py --output my_playlist

# JSON only
python generate_playlist.py --format json
```

### GitHub Actions Automation

1. **Fork this repository**

2. **Add secret (optional):**
   - Go to Settings → Secrets and variables → Actions
   - Add secret: `TOFFEE_DEVICE_TOKEN` (if authentication required)

3. **Enable GitHub Actions:**
   - Go to Actions tab
   - Enable workflows

4. **Automatic updates:**
   - Runs every 6 hours automatically
   - Manual trigger via "Run workflow" button
   - Commits changes and creates releases

## 📁 Output Files

### M3U Playlist (`toffee_live.m3u`)
```m3u
#EXTM3U
#EXTINF:-1 tvg-id="sports_hd" tvg-name="Sports HD" tvg-logo="https://..." group-title="Sports",Sports HD
https://stream-url.com/playlist.m3u8
#EXTINF:-1 tvg-id="news_24" tvg-name="News 24" tvg-logo="https://..." group-title="News",News 24
https://stream-url.com/playlist2.m3u8
```

### JSON Data (`toffee_live.json`)
```json
{
  "generated_at": "2026-10-24T15:35:00Z",
  "total_channels": 50,
  "channels": [
    {
      "id": "sports_hd",
      "name": "Sports HD",
      "logo": "https://...",
      "group": "Sports",
      "stream_url": "https://...",
      "metadata": {
        "genre": "Sports",
        "language": "Bengali"
      }
    }
  ]
}
```

## 🎬 Usage with Players

### VLC Media Player
```bash
vlc toffee_live.m3u
```

### IPTV Apps
1. Copy the M3U file URL from releases
2. Add to your IPTV app as a playlist source

### Web Players
Use the JSON format to build custom web players with metadata.

## ⚙️ Configuration

### Command Line Options

```bash
python generate_playlist.py [OPTIONS]

Options:
  --token TOKEN          Device token for authentication
  --output BASENAME      Output file basename (default: toffee_live)
  --format {m3u,json,both}  Output format (default: both)
  --no-metadata          Exclude metadata from M3U
  -h, --help            Show help message
```

### Environment Variables

- `TOFFEE_DEVICE_TOKEN` - Device token for API authentication

## 🔧 API Endpoints Used

1. **Get Live Channels:**
   ```
   GET https://content-prod.services.toffeelive.com/toffee/BD/DK/web/view/live
   ```

2. **Get Stream URLs:**
   ```
   POST https://entitlement-prod.services.toffeelive.com/toffee/BD/DK/web/playback/{channelId}
   ```

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete API reference.

## 🤖 GitHub Actions Workflow

The automation workflow:

1. **Triggers:**
   - Every 6 hours (cron schedule)
   - Manual dispatch
   - On code changes

2. **Process:**
   - Fetches latest channel data
   - Generates M3U and JSON files
   - Commits changes to repository
   - Creates release with downloadable files

3. **Outputs:**
   - Committed files in main branch
   - Release artifacts
   - Action artifacts (30-day retention)

## 📊 Monitoring

- Check Actions tab for run history
- View commit history for updates
- Download from Releases for stable versions
- Check artifacts for each run

## 🛠️ Development

### Project Structure
```
toffee-live-research/
├── generate_playlist.py          # Main generator script
├── API_DOCUMENTATION.md          # Complete API docs
├── README.md                     # This file
├── FINDINGS.md                   # Research notes
├── .github/
│   └── workflows/
│       └── update-playlist.yml   # GitHub Actions workflow
├── toffee_live.m3u              # Generated M3U (auto)
└── toffee_live.json             # Generated JSON (auto)
```

### Adding Features

1. **Custom channel filtering:**
   Modify `extract_channels_from_rails()` method

2. **Additional metadata:**
   Update `generate_m3u()` to include more tvg attributes

3. **Different output formats:**
   Add new generator methods (e.g., XMLTV)

## 📝 License

This project is for internal testing of the Toffee Live platform.

## 🔗 Related Documentation

- [API Documentation](API_DOCUMENTATION.md) - Complete API reference
- [Findings](FINDINGS.md) - Research notes and discoveries

## 📞 Support

For issues or questions, contact the Toffee Live development team.

---

**Last Updated:** 2026-10-24  
**Status:** ✅ Active and automated
