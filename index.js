// index.js
// Main script to run the performance tests and build the report.

const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');

// --- CONFIGURATION ---
// Add the URLs you want to test here.
const DEFAULT_URLS = [
    'https://www.sheffield.ac.uk'
];

// Read URLs from a comma-separated GitHub Secret. Fallback to the default list.
const URLS_TO_TEST = process.env.URLS_TO_TEST_SECRET
    ? process.env.URLS_TO_TEST_SECRET.split(',').map(url => url.trim())
    : DEFAULT_URLS;

// Add the locations you want to test from.
// Find location identifiers from the SpeedVitals API docs.
// e.g., 'us-east-1', 'eu-west-1', 'ap-south-1'
const LOCATIONS_TO_TEST = [
    'uk', // UK
    'in', // India
    'id', // Indonisia
    'us', // South Carolina
    'jp', // Tokyo
];

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
    console.log('Starting multi-location performance analysis...');

    if (!API_KEY) {
        console.error('FATAL: SPEEDVITALS_API_KEY environment variable not set.');
        console.error('Please add it to your GitHub repository secrets.');
        process.exit(1);
    }

    // Ensure data and public directories exist
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(PUBLIC_DIR, { recursive: true });

    // Step 1: Run tests and get new results
    const newResults = await runAllTests();
    if (newResults.length === 0) {
        console.log('No new results were fetched. Exiting.');
        return;
    }

    // Step 2: Read existing results, add new ones, and save
    const allResults = await updateResultsFile(newResults);

    // Step 3: Build the static HTML page from all results
    await buildStaticPage(allResults);

    console.log('Performance analysis and report generation complete!');
    console.log(`Report saved to: ${OUTPUT_HTML_FILE}`);
}

/**
 * Runs the SpeedVitals test for all configured URLs across all locations.
 * @returns {Promise<Array>} A promise that resolves to an array of new result objects.
 */
async function runAllTests() {
    console.log(`Testing ${URLS_TO_TEST.length} URL(s) across ${LOCATIONS_TO_TEST.length} location(s)...`);
    const results = [];
    // Using a for...of loop to run tests sequentially to avoid overwhelming the API.
    for (const url of URLS_TO_TEST) {
        for (const location of LOCATIONS_TO_TEST) {
            try {
                console.log(`-> Testing ${url} from ${location}`);
                // Using the Lighthouse endpoint and passing the location
                const response = await axios.post(
                  `https://speedvitals.com/v1/lighthouse-tests`,
                  {
                    url,
                    location
                  },
                  {
                    'X-API-KEY': API_KEY
                  }
                );
                const data = response.data;

                if (data.status === 'success') {
                    console.log(`   - Success! Score: ${data.data.performance_score}`);
                    results.push({...data});
                } else {
                    console.error(`   - Failed for ${url} from ${location}: ${data.message || 'Unknown API error'}`);
                }
            } catch (error) {
                console.error(`   - Error testing ${url} from ${location}:`, error.message);
            }
        }
    }
    return results;
}

/**
 * Reads the existing results, appends the new ones, and writes back to the file.
 * @param {Array} newResults - The new results to add.
 * @returns {Promise<Array>} A promise that resolves to the combined list of all results.
 */
async function updateResultsFile(newResults) {
    let existingResults = [];
    try {
        const fileContent = await fs.readFile(RESULTS_FILE, 'utf-8');
        existingResults = JSON.parse(fileContent);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Results file not found, creating a new one.');
        } else {
            console.error('Error reading results file:', error);
        }
    }

    const allResults = [...existingResults, ...newResults];
    await fs.writeFile(RESULTS_FILE, JSON.stringify(allResults, null, 2));
    console.log(`Successfully updated ${RESULTS_FILE}`);
    return allResults;
}

/**
 * Builds the static HTML page with tables and a chart.
 * @param {Array} results - The array of all historical results.
 */
async function buildStaticPage(results) {
    console.log('Building static HTML report...');

    // Group results by URL
    const groupedByUrl = results.reduce((acc, result) => {
        if (!acc[result.url]) {
            acc[result.url] = [];
        }
        acc[result.url].push(result);
        return acc;
    }, {});

    // For each URL, sort results by timestamp descending (newest first)
    for (const url in groupedByUrl) {
        groupedByUrl[url].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
            <h1 class="text-4xl font-bold text-gray-900">Multi-Location Performance Report</h1>
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
        // Further group this URL's results by location
        const byLocation = groupedByUrl[url].reduce((acc, r) => {
            if (!acc[r.location]) acc[r.location] = [];
            acc[r.location].push(r);
            return acc;
        }, {});

        for (const location in byLocation) {
            const dataPoints = byLocation[location].map(r => ({
                x: r.timestamp,
                y: r.performance
            }));

            const color = colorPalette[colorIndex % colorPalette.length];
            colorIndex++;

            datasets.push({
                label: `${url} (${location})`,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color + '33',
                tension: 0.1,
                fill: false
            });
        }
    }

    return {
        datasets: datasets
    };
}


/**
 * Generates HTML tables for each URL's history.
 * @param {Object} groupedByUrl - Results grouped by URL.
 * @returns {string} The complete HTML for all tables.
 */
function generateTablesHtml(groupedByUrl) {
    let html = '';
    for (const url in groupedByUrl) {
        // The results for this URL are already sorted by date, newest first.
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

// Run the main function
main().catch(err => {
    console.error("An unexpected error occurred:", err);
    process.exit(1);
});
