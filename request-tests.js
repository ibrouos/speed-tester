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

  const apiParams = {
    urls: [...URLS_TO_TEST],
    locations: LOCATIONS_TO_TEST,
    devices: ['mobile', 'desktop'],
    batch_type: 'multiple-urls'
  };

  try {
    const response = await axios.post(
      'https://api.speedvitals.com/v1/lighthouse-batch-tests',
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
    process.exit(1);
  }
}

main();
