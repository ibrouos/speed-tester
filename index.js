// index.js
// Fetch SpeedVitals test results and build the report.

const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');

// API Key from environment variables (set this in GitHub Secrets)
const API_KEY = process.env.SPEEDVITALS_API_KEY;

// Paths for data and output
const DATA_DIR = path.join(__dirname, 'data');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const OUTPUT_HTML_FILE = path.join(PUBLIC_DIR, 'index.html');

/**
 * Main function to orchestrate the process.
 */
async function main() {
  console.log('Fetching test results from SpeedVitals...');

  if (!API_KEY) {
    console.error('FATAL: SPEEDVITALS_API_KEY environment variable not set.');
    console.error('Please add it to your GitHub repository secrets.');
    process.exit(1);
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  const allResults = await fetchAllResults();
  await fs.writeFile(RESULTS_FILE, JSON.stringify(allResults, null, 2));

  await buildStaticPage(allResults);

  console.log('Report generation complete!');
  console.log(`Report saved to: ${OUTPUT_HTML_FILE}`);
}

/**
 * Fetches all lighthouse test results from SpeedVitals API.
 * @returns {Promise<Array>} Array of result objects.
 */
async function fetchAllResults() {
  try {
    const res = await axios.get('https://api.speedvitals.com/v1/lighthouse-tests', {
      headers: { 'X-API-KEY': API_KEY }
    });
    const data = res.data;
    if (Array.isArray(data)) {
      return data;
    }
    return data.results || [];
  } catch (err) {
    console.error('Error fetching results:', err.message);
    return [];
  }
}

/**
 * Builds the static HTML page with tables and a chart.
 * @param {Array} results - The array of all historical results.
 */
async function buildStaticPage(results) {
  console.log('Building static HTML report...');

  const groupedByUrl = results.reduce((acc, result) => {
    if (!acc[result.url]) acc[result.url] = [];
    acc[result.url].push(result);
    return acc;
  }, {});

  for (const url in groupedByUrl) {
    groupedByUrl[url].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  const chartData = generateChartData(groupedByUrl);
  const tablesHtml = generateTablesHtml(groupedByUrl);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Performance Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: 'Inter', sans-serif; }
    @import url('https://rsms.me/inter/inter.css');
  </style>
</head>
<body class="bg-gray-50 text-gray-800">
  <div class="container mx-auto p-4 md:p-8">
    <header class="mb-8">
      <h1 class="text-4xl font-bold text-gray-900">Performance Report</h1>
      <p class="text-gray-600 mt-2">Generated on: ${new Date().toUTCString()}</p>
    </header>

    <section class="bg-white p-6 rounded-lg shadow-md mb-8">
      <h2 class="text-2xl font-semibold mb-4">Performance Score Over Time</h2>
      <div class="h-96">
        <canvas id="performanceChart"></canvas>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">Detailed History</h2>
      ${tablesHtml}
    </section>
  </div>

  <script>
    const ctx = document.getElementById('performanceChart').getContext('2d');
    const performanceChart = new Chart(ctx, {
      type: 'line',
      data: ${JSON.stringify(chartData, null, 2)},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            suggestedMin: 70,
            suggestedMax: 100,
            title: {
              display: true,
              text: 'Performance Score'
            }
          },
          x: {
            type: 'time',
            time: {
              unit: 'day',
              tooltipFormat: 'MMM dd, yyyy'
            },
            title: {
              display: true,
              text: 'Date of Test'
            }
          }
        },
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    });
  </script>
</body>
</html>
  `;

  await fs.writeFile(OUTPUT_HTML_FILE, htmlContent);
}

/**
 * Generates the data object required for Chart.js.
 * @param {Object} groupedByUrl - Results grouped by URL.
 * @returns {Object} Chart.js data object.
 */
function generateChartData(groupedByUrl) {
  const colorPalette = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#8b5cf6', '#f97316', '#14b8a6', '#64748b'];
  let colorIndex = 0;
  const datasets = [];
  for (const url in groupedByUrl) {
    const byLocation = groupedByUrl[url].reduce((acc, r) => {
      if (!acc[r.location]) acc[r.location] = [];
      acc[r.location].push(r);
      return acc;
    }, {});
    for (const location in byLocation) {
      const dataPoints = byLocation[location].map(r => ({ x: r.timestamp, y: r.performance }));
      const color = colorPalette[colorIndex % colorPalette.length];
      colorIndex++;
      datasets.push({ label: `${url} (${location})`, data: dataPoints, borderColor: color, backgroundColor: color + '33', tension: 0.1, fill: false });
    }
  }
  return { datasets };
}

/**
 * Generates HTML tables for each URL's history.
 * @param {Object} groupedByUrl - Results grouped by URL.
 * @returns {string} The complete HTML for all tables.
 */
function generateTablesHtml(groupedByUrl) {
  let html = '';
  for (const url in groupedByUrl) {
    html += `
    <div class="mb-8">
      <h3 class="text-xl font-semibold text-gray-700 mb-3 break-all">${url}</h3>
      <div class="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LCP</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FCP</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CLS</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${groupedByUrl[url].map(r => `
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(r.timestamp).toLocaleString()}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${r.location}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${r.performance >= 90 ? 'text-green-600' : r.performance >= 50 ? 'text-yellow-600' : 'text-red-600'}">${r.performance}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${r.lcp}s</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${r.fcp}s</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${r.cls}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    `;
  }
  return html;
}

main().catch(err => {
  console.error('An unexpected error occurred:', err);
  process.exit(1);
});
