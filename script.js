document.addEventListener('DOMContentLoaded', () => {
    const fuelSelect = document.getElementById('fuel-select');
    const priceChartCanvas = document.getElementById('price-chart');
    const currentPricesContainer = document.getElementById('current-prices-container');

     const PRICES_HISTORY_URL = './data/prices.json';

    let chart;
    let priceHistory = [];

    const chartColors = [
        '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1',
        '#f06292', '#ff8a65', '#a1887f', '#90a4ae'
    ];

    async function initializeApp() {
        try {
            const response = await fetch(PRICES_HISTORY_URL, { cache: 'no-store' });

            if (!response.ok) {
                throw new Error('Could not load data.');
            }

            priceHistory = await response.json();

            if (!priceHistory || priceHistory.length === 0) {
                 throw new Error("Price data is empty or in wrong format.");
            }

            updateDashboard();

        } catch (error) {
            console.error('Initializing error:', error);
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

        const latestEntry = priceHistory[priceHistory.length - 1];
        if (!latestEntry || !latestEntry.stations) {
            currentPricesContainer.innerHTML = '<p>Keine aktuellen Preisdaten verfügbar.</p>';
            return;
        };

        const openStationsWithPrice = latestEntry.stations.filter(
            station => station.isOpen && typeof station[fuelType] === 'number' && station[fuelType] > 0
        );

        if (openStationsWithPrice.length === 0) {
             currentPricesContainer.innerHTML = `<p>Keine geöffneten Tankstellen mit Preisen für ${fuelType.toUpperCase()} gefunden.</p>`;
             return;
        }

        const cheapestPrice = Math.min(...openStationsWithPrice.map(s => s[fuelType]));
        openStationsWithPrice.sort((a, b) => a[fuelType] - b[fuelType]);

        openStationsWithPrice.forEach(station => {
            const priceCard = document.createElement('div');
            priceCard.className = 'price-card';
            if (station[fuelType] === cheapestPrice) {
                priceCard.classList.add('cheapest');
            }

            const priceStr = station[fuelType].toFixed(3).toString();
            const euro = priceStr.slice(0, -2);
            const cent = priceStr.slice(-2, -1);
            const superScript = priceStr.slice(-1);

            priceCard.innerHTML = `
                <h3>${station.brand || 'Freie Tankstelle'}</h3>
                <p class="station-name">${station.name}</p>
                <div class="price">${euro}${cent}<sup>${superScript}</sup> €</div>
                <div class="address">${station.street} ${station.houseNumber}, ${station.postCode} ${station.place}</div>
            `;
            currentPricesContainer.appendChild(priceCard);
        });
    }


    function renderChart(fuelType) {
        const stationDataSets = {};

        priceHistory.forEach(entry => {
            const timestamp = new Date(entry.timestamp);

            entry.stations.forEach(station => {
                if (!stationDataSets[station.id]) {
                    stationDataSets[station.id] = {
                        label: station.brand || station.name,
                        data: [],
                        borderColor: chartColors[Object.keys(stationDataSets).length % chartColors.length],
                        tension: 0.1,
                        fill: false
                    };
                }

                if (station.isOpen && typeof station[fuelType] === 'number' && station[fuelType] > 0) {
                    stationDataSets[station.id].data.push({
                        x: timestamp,
                        y: station[fuelType]
                    });
                }
            });
        });

        const finalDatasets = Object.values(stationDataSets).filter(ds => ds.data.length > 1);

        if (chart) {
            chart.destroy();
        }

        chart = new Chart(priceChartCanvas, {
            type: 'line',
            data: {
                datasets: finalDatasets
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
                           // Preis-Ticks formatieren (z.B. 1.859 €)
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