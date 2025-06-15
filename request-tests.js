const axios = require('axios');
const DEFAULT_URLS = ['https://www.sheffield.ac.uk'];
const URLS_TO_TEST = process.env.URLS_TO_TEST_SECRET
  ? process.env.URLS_TO_TEST_SECRET.split(',').map(url => url.trim())
  : DEFAULT_URLS;
const LOCATIONS_TO_TEST = ['uk','in','id','us','jp'];
const API_KEY = process.env.SPEEDVITALS_API_KEY;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeRequestWithRetry(params, retries = 3) {
  let delayMs = 1000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        'https://api.speedvitals.com/v1/lighthouse-tests',
        params,
        {
          headers: {
            'X-API-KEY': API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`Retrying after ${delayMs}ms... (${attempt}/${retries})`);
      await delay(delayMs);
      delayMs *= 2; // Exponential backoff
    }
  }
}

async function main() {
  if (!API_KEY) {
    console.error('SPEEDVITALS_API_KEY environment variable not set.');
    process.exit(1);
  }

  console.log('Using API key length:', API_KEY.length);
  console.log('URLs to test:', URLS_TO_TEST);
  console.log('Locations:', LOCATIONS_TO_TEST);

  const apiParams = {
    url: 'https://sheffield.ac.uk',
    device: 'desktop',
    config: {
      connection: 'wifi',
      video: true,
      adblock: false
    }
  };

  console.log('Request parameters:', JSON.stringify(apiParams, null, 2));

  for (const location of LOCATIONS_TO_TEST) {
    const params = { ...apiParams, location };
  
    try {
      const response = await safeRequestWithRetry(params);
      console.log(`Success for ${location}:`, response.data);
    } catch (err) {
      console.error(`Failed for ${location} after retries:`, err?.response?.data || err.message);
    }
  
    await delay(2000); // Throttle even after success
  }
  
}

main();
