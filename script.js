document.addEventListener('DOMContentLoaded', () => {
    const fuelSelect = document.getElementById('fuel-select');
    const priceChartCanvas = document.getElementById('price-chart');
    const currentPricesContainer = document.getElementById('current-prices-container');
    const recommendationContainer = document.getElementById('recommendation-text'); // Added for direct access

    const PRICES_HISTORY_URL = './data/prices.json';

    let chart;
    let priceHistory = [];

    const chartColors = [
        '#66B3BA',
        '#A1D2CE',
        '#F0B98A',
        '#E07A5F',
        '#3D405B',
        '#81B29A',
        '#F2CC8F',
        '#C2B2D8',
        '#B8D8D8',
        '#E2BFB3'
    ];

    async function initializeApp() {
        try {
            const response = await fetch(PRICES_HISTORY_URL, { cache: 'no-store' });

            if (!response.ok) {
                throw new Error('Could not load data. Network response was not ok.');
            }

            priceHistory = await response.json();
            if (!priceHistory || priceHistory.length === 0) {
                 throw new Error("Price data is empty or in wrong format. Please ensure 'prices.json' contains valid data.");
            }

            updateDashboard();

        } catch (error) {
            console.error('Initializing error:', error);
            currentPricesContainer.innerHTML = `<p class="error-message">Fehler beim Laden der Preisdaten. Die Datei existiert möglicherweise noch nicht oder ist fehlerhaft. Bitte warte, bis die GitHub Action das erste Mal durchgelaufen ist oder überprüfe die Datenquelle.</p>`;
            recommendationContainer.innerHTML = `<p class="error-message">Fehler beim Laden der Daten für die Empfehlung.</p>`;
        }
    }


    function updateDashboard() {
        const selectedFuel = fuelSelect.value;
        displayCurrentPrices(selectedFuel);
        renderChart(selectedFuel);
        generateRecommendation(selectedFuel);
    }


    function displayCurrentPrices(fuelType) {
        currentPricesContainer.innerHTML = ''; // clear old content

        const latestEntry = priceHistory[priceHistory.length - 1];
        if (!latestEntry || !latestEntry.stations) {
            currentPricesContainer.innerHTML = '<p class="info-message">Keine aktuellen Preisdaten verfügbar.</p>';
            return;
        }

        const openStationsWithPrice = latestEntry.stations.filter(
            station => station.isOpen && typeof station[fuelType] === 'number' && station[fuelType] > 0
        );

        if (openStationsWithPrice.length === 0) {
             currentPricesContainer.innerHTML = `<p class="info-message">Keine geöffneten Tankstellen mit Preisen für ${fuelType.toUpperCase()} gefunden.</p>`;
             return;
        }

        const cheapestPrice = Math.min(...openStationsWithPrice.map(s => s[fuelType]));
        openStationsWithPrice.sort((a, b) => a[fuelType] - b[fuelType]);

        openStationsWithPrice.forEach(station => {
            const priceCard = document.createElement('div');
            priceCard.className = 'price-card card';
            if (station[fuelType] === cheapestPrice) {
                priceCard.classList.add('cheapest');
            }

            const priceStr = station[fuelType].toFixed(3).toString();
            const euro = priceStr.slice(0, -2).replace('.', ',');
            const cent = priceStr.slice(-2, -1);
            const superScript = priceStr.slice(-1);

            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.street + ' ' + station.houseNumber + ', ' + station.postCode + ' ' + station.place)}`;

            priceCard.innerHTML = `
                <h3>${station.brand || 'Unbekannte Tankstelle'}</h3>
                <p class="station-name">${station.name}</p>
                <div class="price">${euro}${cent}<sup>${superScript}</sup> €</div>
                <div class="address">${station.street} ${station.houseNumber}, ${station.postCode} ${station.place}</div>
                <a href="${mapsUrl}" target="_blank" class="maps-link" rel="noopener noreferrer"><i class="fas fa-map-marker-alt"></i> Auf Google Maps öffnen</a>
            `;
            currentPricesContainer.appendChild(priceCard);
        });
    }


    function generateRecommendation(fuelType) {
        recommendationContainer.innerHTML = ''; // clear old

        if (!priceHistory || priceHistory.length < 2) {
            recommendationContainer.innerHTML = '<p class="info-message">Nicht genügend historische Daten für eine Empfehlung.</p>';
            return;
        }

        const latestEntry = priceHistory[priceHistory.length - 1];
        const openStationsWithPrice = latestEntry.stations.filter(
            s => s.isOpen && typeof s[fuelType] === 'number' && s[fuelType] > 0
        );

        if (openStationsWithPrice.length === 0) {
            recommendationContainer.innerHTML = '<p class="info-message">Keine Preisdaten für eine Empfehlung verfügbar.</p>';
            return;
        }
        const currentCheapestPrice = Math.min(...openStationsWithPrice.map(s => s[fuelType]));
        const twentyFourHoursAgo = new Date(new Date(latestEntry.timestamp).getTime() - (24 * 60 * 60 * 1000));
        const recentHistory = priceHistory.filter(entry => new Date(entry.timestamp) > twentyFourHoursAgo);

        let recentMinPrice = currentCheapestPrice;
        let recentAvgPrice = 0;
        let priceCount = 0;

        recentHistory.forEach(entry => {
            entry.stations.forEach(station => {
                if (station.isOpen && typeof station[fuelType] === 'number' && station[fuelType] > 0) {
                    if (station[fuelType] < recentMinPrice) {
                        recentMinPrice = station[fuelType];
                    }
                    recentAvgPrice += station[fuelType];
                    priceCount++;
                }
            });
        });
        recentAvgPrice = priceCount > 0 ? recentAvgPrice / priceCount : currentCheapestPrice;

        let recommendation = '';
        let recommendationClass = '';

        const now = new Date();
        const currentHour = now.getHours();

        if (currentCheapestPrice <= recentMinPrice) {
            recommendation = `Jetzt <strong class="tanken"> TANKEN </strong>! Der aktuelle Preis von ${currentCheapestPrice.toFixed(3).replace('.', ',')} € ist der günstigste der letzten 24 Stunden.`;
            recommendationClass = 'tanken';
        } else if (currentCheapestPrice < recentAvgPrice) {
            const difference = (recentAvgPrice - currentCheapestPrice).toFixed(3);
            recommendation = `Guter Zeitpunkt zum <strong class="tanken"> TANKEN </strong>. Der Preis liegt ${difference.replace('.', ',')} € unter dem 24h-Durchschnitt.`;
            recommendationClass = 'tanken';
        } else {
            // prices tend to fall between 18:00 and 22:00
            if (currentHour >= 18 && currentHour < 22) {
                recommendation = `Die Preise sind aktuell etwas höher. Es könnte sich lohnen, noch bis zum späten Abend zu <strong class="wait"> WARTEN </strong>, da die Preise tendenziell dann fallen.`;
                recommendationClass = 'wait';
            } else if (currentHour >= 22 || currentHour < 6) {
                recommendation = `Der Preis ist aktuell überdurchschnittlich. Wenn möglich, <strong class="wait"> WARTEN </strong> Sie, da die Preise am Tag wieder sinken könnten.`;
                recommendationClass = 'wait';
            } else {
                recommendation = `Der Preis ist aktuell eher hoch. Falls möglich, bis zum späten Nachmittag/Abend <strong class="wait"> WARTEN </strong>.`;
                recommendationClass = 'wait';
            }
        }

        recommendationContainer.innerHTML = recommendation;
        recommendationContainer.classList.remove('tanken', 'wait', 'neutral');
        recommendationContainer.classList.add(recommendationClass);
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
                        tension: 0.3,
                        fill: false,
                        pointRadius: 0,
                        hoverRadius: 5,
                        borderWidth: 2
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
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            tooltipFormat: 'dd.MM.yyyy HH:mm',
                            displayFormats: {
                                day: 'dd.MM'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Datum',
                            font: { size: 14, family: 'Lato, sans-serif' },
                            color: '#555'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Preis in €',
                            font: { size: 14, family: 'Lato, sans-serif' },
                            color: '#555'
                        },
                        ticks: {

                           callback: function(value) {
                               return value.toFixed(3).replace('.', ',') + ' €';
                           }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(3).replace('.', ',') + ' €';
                                }
                                return label;
                            }
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                family: 'Lato, sans-serif'
                            },
                            color: '#333',
                            boxWidth: 20,
                            padding: 15
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    fuelSelect.addEventListener('change', updateDashboard);
    initializeApp();
});
