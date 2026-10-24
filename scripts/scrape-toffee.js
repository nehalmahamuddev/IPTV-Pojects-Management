/**
 * Toffee Live API Scraper
 * Scrapes channel information and API endpoints from toffeelive.com
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://toffeelive.com/en/watch/Xi_Ga5oBNnOkwJLWkhKP';
const HOME_URL = 'https://toffeelive.com';

async function scrapeTofeeLive() {
  console.log('🚀 Starting Toffee Live API scraper...\n');

  const apiCalls = [];
  const streamingUrls = [];
  const authTokens = [];
  const channelData = [];

  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();

  // Intercept network requests
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();
    
    // Capture API calls
    if (url.includes('api') || url.includes('graphql') || url.includes('toffee')) {
      apiCalls.push({
        url,
        method,
        headers,
        postData: request.postData(),
        timestamp: new Date().toISOString()
      });
      console.log(`📡 API Call: ${method} ${url}`);
    }

    // Capture streaming URLs
    if (url.includes('.m3u8') || url.includes('.mpd') || url.includes('stream')) {
      streamingUrls.push({
        url,
        type: url.includes('.m3u8') ? 'HLS' : url.includes('.mpd') ? 'DASH' : 'Unknown',
        timestamp: new Date().toISOString()
      });
      console.log(`🎥 Streaming URL: ${url}`);
    }

    // Capture auth tokens
    if (headers.authorization || headers['x-auth-token'] || headers['x-api-key']) {
      authTokens.push({
        authorization: headers.authorization,
        xAuthToken: headers['x-auth-token'],
        xApiKey: headers['x-api-key'],
        url,
        timestamp: new Date().toISOString()
      });
      console.log(`🔑 Auth Token found for: ${url}`);
    }
  });

  // Intercept responses
  page.on('response', async response => {
    const url = response.url();
    
    if (url.includes('api') || url.includes('graphql')) {
      try {
        const contentType = response.headers()['content-type'];
        if (contentType && contentType.includes('json')) {
          const data = await response.json();
          console.log(`📥 API Response from: ${url}`);
          
          // Store channel data if found
          if (data.channels || data.channel || data.data?.channel) {
            channelData.push({
              url,
              data,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    }
  });

  try {
    // Visit home page
    console.log(`\n📄 Visiting home page: ${HOME_URL}`);
    await page.goto(HOME_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Visit specific channel
    console.log(`\n📺 Visiting channel page: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Extract embedded data
    const embeddedData = await page.evaluate(() => {
      const data = {};
      const nextData = document.getElementById('__NEXT_DATA__');
      if (nextData) {
        try {
          data.nextData = JSON.parse(nextData.textContent);
        } catch (e) {}
      }
      data.windowVars = {};
      ['API_URL', 'API_BASE_URL', 'STREAM_URL', 'AUTH_TOKEN', 'CONFIG'].forEach(varName => {
        if (window[varName]) {
          data.windowVars[varName] = window[varName];
        }
      });
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      data.scriptUrls = scripts;
      return data;
    });

    console.log('\n📦 Embedded data extracted');

    const results = {
      metadata: {
        scrapedAt: new Date().toISOString(),
        targetUrl: TARGET_URL,
        homeUrl: HOME_URL
      },
      apiCalls,
      streamingUrls,
      authTokens,
      channelData,
      embeddedData
    };

    const outputPath = path.join(__dirname, '..', 'toffee-api-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Data saved to: ${outputPath}`);

    await generateMarkdownDoc(results);

  } catch (error) {
    console.error('❌ Error during scraping:', error);
  } finally {
    await browser.close();
  }
}

async function generateMarkdownDoc(results) {
  const md = [];
  md.push('# Toffee Live API Documentation\n\n');
  md.push(`> Scraped on: ${results.metadata.scrapedAt}\n\n`);
  md.push('## Overview\n\nToffee Live streaming platform.\n\n');
  md.push('## API Endpoints\n\n');
  if (results.apiCalls.length > 0) {
    const uniqueApis = [...new Map(results.apiCalls.map(api => [api.url, api])).values()];
    uniqueApis.forEach(api => {
      md.push(`### ${api.method} ${api.url}\n\n`);
      md.push('```json\n' + JSON.stringify(api.headers, null, 2) + '\n```\n\n');
    });
  }
  md.push('## Streaming URLs\n\n');
  results.streamingUrls.forEach(s => md.push(`- ${s.type}: ${s.url}\n`));
  md.push('\n## Channel Data\n\n');
  if (results.channelData.length > 0) {
    md.push('```json\n' + JSON.stringify(results.channelData[0]?.data, null, 2) + '\n```\n');
  }
  const docPath = path.join(__dirname, '..', 'toffee-context.md');
  fs.writeFileSync(docPath, md.join(''));
  console.log(`📝 Documentation saved to: ${docPath}`);
}

scrapeTofeeLive().catch(console.error);
