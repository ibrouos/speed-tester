const axios = require('axios');
const DEFAULT_URLS = ['https://www.sheffield.ac.uk'];
const URLS_TO_TEST = process.env.URLS_TO_TEST_SECRET
  ? process.env.URLS_TO_TEST_SECRET.split(',').map(url => url.trim())
  : DEFAULT_URLS;
const LOCATIONS_TO_TEST = ['uk','in','id','us','jp'];
const API_KEY = process.env.SPEEDVITALS_API_KEY;

async function main() {
  if (!API_KEY) {
    console.error('SPEEDVITALS_API_KEY environment variable not set.');
    process.exit(1);
  }

  console.log('Using API key length:', API_KEY.length);
  console.log('URLs to test:', URLS_TO_TEST);
  console.log('Locations:', LOCATIONS_TO_TEST);

  const apiParams = {
    urls: [...URLS_TO_TEST][0],
    locations: LOCATIONS_TO_TEST,
    device: 'desktop'
  };

  console.log('Request parameters:', JSON.stringify(apiParams, null, 2));

  try {
    const response = await axios.post(
      'https://api.speedvitals.com/v1/lighthouse-tests',
      apiParams,
      {
        headers: {
          'X-API-KEY': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Triggered tests:', response.data);
  } catch (err) {
    console.error('Failed to trigger tests:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Response:', JSON.stringify(err.response.data));
    }
    process.exit(1);
  }
}

main();
