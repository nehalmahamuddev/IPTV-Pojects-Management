"""
Toffee Live M3U Playlist Generator
Scrapes live channel data and generates M3U playlists
"""

import os
import sys
import json
import time
import requests
from datetime import datetime
from typing import List, Dict, Optional

class ToffeeLiveAPI:
    """Toffee Live API Client"""
    
    def __init__(self, device_token: Optional[str] = None):
        self.base_url_content = "https://content-prod.services.toffeelive.com/toffee/BD/DK"
        self.base_url_entitlement = "https://entitlement-prod.services.toffeelive.com/toffee/BD/DK"
        self.device_token = device_token or os.getenv('TOFFEE_DEVICE_TOKEN', '')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'ToffeeLive/1.0'
        })
        if self.device_token:
            self.session.headers.update({
                'Authorization': f'Bearer {self.device_token}'
            })
    
    def get_live_channels(self, page: int = 1) -> Dict:
        """Get all live channels"""
        url = f"{self.base_url_content}/web/view/live"
        params = {}
        if page > 1:
            params['page'] = page
        
        try:
            response = self.session.get(url, params=params, timeout=15)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching live channels: {e}", file=sys.stderr)
            return {}
    
    def get_playback_url(self, channel_id: str) -> Optional[str]:
        """Get stream URL for a channel"""
        url = f"{self.base_url_entitlement}/web/playback/{channel_id}"
        
        try:
            response = self.session.post(url, json={}, timeout=15)
            response.raise_for_status()
            data = response.json()
            return data.get('playbackUrl') or data.get('url')
        except requests.exceptions.RequestException as e:
            print(f"Error fetching playback URL for {channel_id}: {e}", file=sys.stderr)
            return None
    
    def get_asset_details(self, asset_id: str) -> Optional[Dict]:
        """Get detailed asset information"""
        url = f"{self.base_url_content}/web/asset/{asset_id}"
        
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching asset details for {asset_id}: {e}", file=sys.stderr)
            return None


class M3UGenerator:
    """M3U Playlist Generator"""
    
    def __init__(self, api: ToffeeLiveAPI):
        self.api = api
        self.channels = []
    
    def extract_channels_from_rails(self, data: Dict) -> List[Dict]:
        """Extract channel information from rails structure"""
        channels = []
        rails = data.get('rails', [])
        
        for rail in rails:
            items = rail.get('items', [])
            for item in items:
                if item.get('isLive', False):
                    channel = {
                        'id': item.get('id', ''),
                        'title': item.get('title', 'Unknown'),
                        'logo': self._get_logo_url(item.get('images', {})),
                        'group': rail.get('title', 'Live TV'),
                        'metadata': item.get('metadata', {})
                    }
                    channels.append(channel)
        
        return channels
    
    def _get_logo_url(self, images: Dict) -> str:
        """Extract logo URL from images object"""
        # Try different image keys in order of preference
        for key in ['poster', 'thumbnail', 'banner', 'logo']:
            if key in images and images[key]:
                return images[key]
        return ''
    
    def fetch_all_channels(self) -> List[Dict]:
        """Fetch all live channels with pagination"""
        all_channels = []
        page = 1
        
        print(f"Fetching channels from Toffee Live API...")
        
        while True:
            print(f"  Page {page}...")
            data = self.api.get_live_channels(page)
            
            if not data or 'rails' not in data:
                break
            
            channels = self.extract_channels_from_rails(data)
            if not channels:
                break
            
            all_channels.extend(channels)
            
            # Check if there are more pages
            if not data.get('hasMore', False):
                break
            
            page += 1
            time.sleep(0.5)  # Rate limiting
        
        print(f"Found {len(all_channels)} live channels")
        return all_channels
    
    def fetch_stream_urls(self, channels: List[Dict]) -> List[Dict]:
        """Fetch stream URLs for all channels"""
        print(f"Fetching stream URLs...")
        
        for i, channel in enumerate(channels, 1):
            print(f"  [{i}/{len(channels)}] {channel['title']}...")
            
            stream_url = self.api.get_playback_url(channel['id'])
            channel['stream_url'] = stream_url or ''
            
            # Rate limiting
            if i < len(channels):
                time.sleep(0.3)
        
        # Filter out channels without stream URLs
        valid_channels = [ch for ch in channels if ch['stream_url']]
        print(f"Successfully fetched {len(valid_channels)} stream URLs")
        
        return valid_channels
    
    def generate_m3u(self, channels: List[Dict], include_metadata: bool = True) -> str:
        """Generate M3U playlist content"""
        lines = ['#EXTM3U']
        
        for channel in channels:
            # Build EXTINF line
            extinf_parts = ['#EXTINF:-1']
            
            if include_metadata:
                # Add tvg attributes
                extinf_parts.append(f'tvg-id="{channel["id"]}"')
                extinf_parts.append(f'tvg-name="{channel["title"]}"')
                
                if channel['logo']:
                    extinf_parts.append(f'tvg-logo="{channel["logo"]}"')
                
                if channel['group']:
                    extinf_parts.append(f'group-title="{channel["group"]}"')
            
            # Add channel name at the end
            extinf_line = ' '.join(extinf_parts) + f',{channel["title"]}'
            
            lines.append(extinf_line)
            lines.append(channel['stream_url'])
        
        return '\n'.join(lines) + '\n'
    
    def generate_json(self, channels: List[Dict]) -> str:
        """Generate JSON format channel list"""
        output = {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'total_channels': len(channels),
            'channels': []
        }
        
        for channel in channels:
            output['channels'].append({
                'id': channel['id'],
                'name': channel['title'],
                'logo': channel['logo'],
                'group': channel['group'],
                'stream_url': channel['stream_url'],
                'metadata': channel.get('metadata', {})
            })
        
        return json.dumps(output, indent=2, ensure_ascii=False)
    
    def run(self, output_format: str = 'both') -> Dict[str, str]:
        """Run the complete generation process"""
        # Fetch channels
        channels = self.fetch_all_channels()
        
        if not channels:
            print("No channels found!", file=sys.stderr)
            return {}
        
        # Fetch stream URLs
        channels_with_urls = self.fetch_stream_urls(channels)
        
        if not channels_with_urls:
            print("No valid stream URLs found!", file=sys.stderr)
            return {}
        
        # Generate outputs
        outputs = {}
        
        if output_format in ['m3u', 'both']:
            outputs['m3u'] = self.generate_m3u(channels_with_urls)
        
        if output_format in ['json', 'both']:
            outputs['json'] = self.generate_json(channels_with_urls)
        
        return outputs


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Toffee Live M3U Playlist Generator'
    )
    parser.add_argument(
        '--token',
        help='Device token for authentication (or set TOFFEE_DEVICE_TOKEN env var)'
    )
    parser.add_argument(
        '--output',
        default='toffee_live',
        help='Output file basename (default: toffee_live)'
    )
    parser.add_argument(
        '--format',
        choices=['m3u', 'json', 'both'],
        default='both',
        help='Output format (default: both)'
    )
    parser.add_argument(
        '--no-metadata',
        action='store_true',
        help='Exclude metadata from M3U playlist'
    )
    
    args = parser.parse_args()
    
    # Initialize API client
    api = ToffeeLiveAPI(device_token=args.token)
    
    # Initialize generator
    generator = M3UGenerator(api)
    
    # Run generation
    print("=" * 60)
    print("Toffee Live M3U Playlist Generator")
    print("=" * 60)
    print()
    
    outputs = generator.run(output_format=args.format)
    
    if not outputs:
        print("\nFailed to generate playlist!", file=sys.stderr)
        sys.exit(1)
    
    # Save outputs
    print()
    print("Saving outputs...")
    
    if 'm3u' in outputs:
        m3u_file = f"{args.output}.m3u"
        with open(m3u_file, 'w', encoding='utf-8') as f:
            f.write(outputs['m3u'])
        print(f"  ✓ M3U playlist saved to: {m3u_file}")
    
    if 'json' in outputs:
        json_file = f"{args.output}.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            f.write(outputs['json'])
        print(f"  ✓ JSON data saved to: {json_file}")
    
    print()
    print("=" * 60)
    print("✓ Generation complete!")
    print("=" * 60)


if __name__ == '__main__':
    main()
