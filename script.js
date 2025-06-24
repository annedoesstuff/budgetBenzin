document.addEventListener('DOMContentLoaded', () => {
    const fuelSelect = document.getElementById('fuel-select');
    const priceChartCanvas = document.getElementById('price-chart');
    const currentPricesContainer = document.getElementById('current-prices-container');

    const PRICES_URL = './data/prices.json';
    const STATIONS_URL = './data/stations.json';

    let chart;
    let priceData = [];
    let stationData = {};

    const chartColors = [
        '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6610f2'
    ];

    async function initializeApp() {
        try {
            const [pricesResponse, stationsResponse] = await Promise.all([
                fetch(PRICES_URL, { cache: 'no-store' }),
                fetch(STATIONS_URL, { cache: 'no-store' })
            ]);

            if (!pricesResponse.ok || !stationsResponse.ok) {
                throw new Error('Daten konnten nicht geladen werden.');
            }

            priceData = await pricesResponse.json();
            stationData = await stationsResponse.json();

            updateDashboard();

        } catch (error) {
            console.error('Initialisierungsfehler:', error);
            currentPricesContainer.innerHTML = `<p>Fehler beim Laden der Preisdaten. Die Datei existiert möglicherweise noch nicht. Bitte warte, bis die GitHub Action das erste Mal durchgelaufen ist.</p>`;
        }
    }

    function updateDashboard() {
        const selectedFuel = fuelSelect.value;
        displayCurrentPrices(selectedFuel);
        renderChart(selectedFuel);
    }

    function displayCurrentPrices(fuelType) {
        currentPricesContainer.innerHTML = ''; // clear old content

        const latestTimestamp = priceData[priceData.length - 1];
        if (!latestTimestamp) return;

        let prices = [];
        for (const stationId in latestTimestamp.prices) {
            const priceInfo = latestTimestamp.prices[stationId];
            if (priceInfo.status === 'open' && priceInfo[fuelType]) {
                const stationInfo = stationData[stationId];
                if(stationInfo) {
                    prices.push({
                        id: stationId,
                        name: stationInfo.brand || 'Freie Tankstelle',
                        address: `${stationInfo.street} ${stationInfo.houseNumber}, ${stationInfo.postCode} ${stationInfo.place}`,
                        price: priceInfo[fuelType]
                    });
                }
            }
        }

        if (prices.length === 0) {
             currentPricesContainer.innerHTML = `<p>Keine geöffneten Tankstellen mit Preisen für ${fuelType.toUpperCase()} gefunden.</p>`;
             return;
        }

        const cheapestPrice = Math.min(...prices.map(p => p.price));

        prices.sort((a, b) => a.price - b.price).forEach(station => {
            const priceCard = document.createElement('div');
            priceCard.className = 'price-card';
            if (station.price === cheapestPrice) {
                priceCard.classList.add('cheapest');
            }

            const priceParts = station.price.toString().split('.');
            const euro = priceParts[0];
            const cent = priceParts[1].padEnd(2, '0').slice(0, 2);
            const superScript = priceParts[1].padEnd(3, '0')[2];

            priceCard.innerHTML = `
                <h3>${station.name}</h3>
                <div class="price">${euro}.${cent}<sup>${superScript}</sup> €</div>
                <div class="address">${station.address}</div>
            `;
            currentPricesContainer.appendChild(priceCard);
        });
    }

    function renderChart(fuelType) {
        const datasets = [];
        const stationIds = Object.keys(stationData);

        stationIds.forEach((id, index) => {
            const stationInfo = stationData[id];
            const dataPoints = [];

            priceData.forEach(entry => {
                const priceInfo = entry.prices[id];
                if (priceInfo && priceInfo[fuelType]) {
                    dataPoints.push({
                        x: new Date(entry.timestamp),
                        y: priceInfo[fuelType]
                    });
                }
            });

            if (dataPoints.length > 1) { // only draw if history exists
                datasets.push({
                    label: stationInfo.brand || 'Freie Tankstelle',
                    data: dataPoints,
                    borderColor: chartColors[index % chartColors.length],
                    tension: 0.1,
                    fill: false
                });
            }
        });

        if (chart) {
            chart.destroy();
        }

        chart = new Chart(priceChartCanvas, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            tooltipFormat: 'dd.MM.yyyy HH:mm'
                        },
                        title: {
                            display: true,
                            text: 'Datum'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Preis in €'
                        },
                        ticks: {
                           callback: function(value) {
                               return value.toFixed(3) + ' €';
                           }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }

    fuelSelect.addEventListener('change', updateDashboard);
    initializeApp();
});