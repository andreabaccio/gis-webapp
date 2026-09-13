// ============================================================================
// GIS Web App - Main Application Logic
// ============================================================================

// Global variables
let map;
let geoJsonLayers = {};
let selectedCountry = null;
let selectedFeatures = [];

const layerConfig = {
    country: {
        name: 'Confini Nazionali',
        file: 'data/country.geojson',
        color: '#1f77b4',
        weight: 2,
        opacity: 0.7
    },
    products: {
        name: 'Coverage (Products)',
        file: 'data/odb_products.geojson',
        color: '#ff7f0e',
        weight: 1,
        opacity: 0.6
    },
    places: {
        name: 'Città (Places)',
        file: 'data/places.geojson',
        color: '#2ca02c',
        weight: 1,
        opacity: 0.7
    },
    airports: {
        name: 'Aeroporti',
        file: 'data/airports.geojson',
        color: '#d62728',
        weight: 1,
        opacity: 0.7
    },
    mapping: {
        name: 'Mapping',
        file: 'data/odb_mapping.geojson',
        color: '#9467bd',
        weight: 1,
        opacity: 0.7
    }
};

// ============================================================================
// Initialize Map
// ============================================================================
function initializeMap() {
    map = L.map('map').setView([20, 10], 3);

    // No external tiles - just plain map background
    // The GeoJSON data will be displayed on top
    
    // Add mouse move listener for coordinates
    map.on('mousemove', updateCoordinates);
    map.on('zoomend', updateCoordinates);

    // Load all GeoJSON layers
    loadAllLayers();

    // Setup event listeners
    setupEventListeners();
}

// ============================================================================
// Load GeoJSON Layers
// ============================================================================
function loadAllLayers() {
    Object.keys(layerConfig).forEach(key => {
        loadGeoJsonLayer(key);
    });
}

function loadGeoJsonLayer(layerKey) {
    const config = layerConfig[layerKey];
    
    fetch(config.file)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load ${config.file}`);
            }
            return response.json();
        })
        .then(geojsonData => {
            const layer = L.geoJSON(geojsonData, {
                style: {
                    color: config.color,
                    weight: config.weight,
                    opacity: config.opacity,
                    fillOpacity: config.opacity * 0.5
                },
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, {
                        radius: 5,
                        fillColor: config.color,
                        color: '#000',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: config.opacity
                    });
                },
                onEachFeature: (feature, layer) => {
                    // Create popup with feature properties
                    let popupContent = '<div class="feature-popup">';
                    if (feature.properties) {
                        Object.keys(feature.properties).forEach(key => {
                            popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
                        });
                    }
                    popupContent += '</div>';
                    layer.bindPopup(popupContent);

                    // Store reference to original properties
                    layer.originalProperties = feature.properties;
                }
            });

            geoJsonLayers[layerKey] = {
                data: geojsonData,
                layer: layer,
                visible: layerKey === 'country' || layerKey === 'products' // Default visible
            };

            // Add to map if should be visible
            if (geoJsonLayers[layerKey].visible) {
                layer.addTo(map);
            }

            // Populate country dropdown if this is the country layer
            if (layerKey === 'country') {
                populateCountryDropdown();
            }

            console.log(`✓ Loaded ${config.name}`);
        })
        .catch(error => {
            console.error(`✗ Error loading ${config.name}:`, error);
        });
}

// ============================================================================
// Populate Country Dropdown
// ============================================================================
function populateCountryDropdown() {
    const countryData = geoJsonLayers.country.data;
    const countries = [];

    if (countryData.features) {
        countryData.features.forEach(feature => {
            if (feature.properties && feature.properties.ADMIN) {
                countries.push({
                    name: feature.properties.ADMIN,
                    geometry: feature.geometry,
                    properties: feature.properties
                });
            }
        });
    }

    // Sort alphabetically
    countries.sort((a, b) => a.name.localeCompare(b.name));

    // Populate dropdown
    const select = document.getElementById('countrySelect');
    countries.forEach((country, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = country.name;
        option.dataset.country = JSON.stringify(country);
        select.appendChild(option);
    });
}

// ============================================================================
// Select by Location - Spatial Filter
// ============================================================================
function selectByLocation() {
    const select = document.getElementById('countrySelect');
    if (!select.value) {
        alert('Please select a country first');
        return;
    }

    const selectedOption = select.options[select.selectedIndex];
    const countryData = JSON.parse(selectedOption.dataset.country);
    selectedCountry = countryData;

    // Create a temporary GeoJSON object for the selected country
    const selectedCountryGeoJSON = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: countryData.geometry,
            properties: countryData.properties
        }]
    };

    // Filter products layer by intersection with selected country
    const productsData = geoJsonLayers.products.data;
    selectedFeatures = [];

    if (productsData.features) {
        productsData.features.forEach(feature => {
            if (feature.geometry && isIntersecting(feature.geometry, countryData.geometry)) {
                selectedFeatures.push(feature);
            }
        });
    }

    console.log(`Found ${selectedFeatures.length} features in ${countryData.name}`);

    // Update map to show selected results
    updateMapSelection();

    // Store for export
    window.selectedFeaturesForExport = selectedFeatures;
}

// ============================================================================
// Spatial Query - Check if geometries intersect
// ============================================================================
function isIntersecting(geom1, geom2) {
    // Simple bounding box intersection check
    const bbox1 = getBoundingBox(geom1);
    const bbox2 = getBoundingBox(geom2);

    return !(bbox1.maxLng < bbox2.minLng ||
             bbox1.minLng > bbox2.maxLng ||
             bbox1.maxLat < bbox2.minLat ||
             bbox1.minLat > bbox2.maxLat);
}

function getBoundingBox(geometry) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    function processCoord(coord) {
        const lat = coord[1];
        const lng = coord[0];
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    }

    function processGeometry(geom) {
        if (geom.type === 'Point') {
            processCoord(geom.coordinates);
        } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
            geom.coordinates.forEach(processCoord);
        } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
            geom.coordinates.forEach(ring => ring.forEach(processCoord));
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(polygon => 
                polygon.forEach(ring => ring.forEach(processCoord))
            );
        }
    }

    processGeometry(geometry);

    return { minLat, maxLat, minLng, maxLng };
}

// ============================================================================
// Update Map to Show Selection
// ============================================================================
function updateMapSelection() {
    // Remove old selection layer if exists
    if (map.selectedLayer) {
        map.removeLayer(map.selectedLayer);
    }

    // Highlight selected country
    if (selectedCountry && selectedCountry.geometry) {
        const highlightLayer = L.geoJSON(selectedCountry.geometry, {
            style: {
                color: '#ff0000',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.2
            }
        }).addTo(map);
        map.selectedLayer = highlightLayer;

        // Fit map to selected country
        const bbox = getBoundingBox(selectedCountry.geometry);
        map.fitBounds([
            [bbox.minLat, bbox.minLng],
            [bbox.maxLat, bbox.maxLng]
        ]);
    }

    // Highlight selected features from products layer
    if (selectedFeatures.length > 0) {
        const selectedGeoJSON = L.geoJSON({
            type: 'FeatureCollection',
            features: selectedFeatures
        }, {
            style: {
                color: '#ffff00',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            },
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 7,
                    fillColor: '#ffff00',
                    color: '#000',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            }
        }).addTo(map);

        if (map.selectedLayer) {
            map.removeLayer(map.selectedLayer);
        }
        map.selectedLayer = selectedGeoJSON;
    }
}

// ============================================================================
// Event Listeners Setup
// ============================================================================
function setupEventListeners() {
    // Country selection dropdown
    document.getElementById('countrySelect').addEventListener('change', function() {
        if (this.value) {
            document.getElementById('selectByLocationBtn').disabled = false;
        }
    });

    // Select by Location button
    document.getElementById('selectByLocationBtn').addEventListener('click', selectByLocation);

    // Layer toggle checkboxes
    document.getElementById('countryToggle').addEventListener('change', toggleLayer('country'));
    document.getElementById('productsToggle').addEventListener('change', toggleLayer('products'));
    document.getElementById('placesToggle').addEventListener('change', toggleLayer('places'));
    document.getElementById('airportsToggle').addEventListener('change', toggleLayer('airports'));
    document.getElementById('mappingToggle').addEventListener('change', toggleLayer('mapping'));

    // Export button
    document.getElementById('exportBtn').addEventListener('click', () => {
        if (selectedFeatures.length > 0) {
            exportToXLS(selectedFeatures, selectedCountry ? selectedCountry.name : 'export');
        } else {
            alert('Please select features first using "Select by Location"');
        }
    });

    // Sidebar toggle
    document.getElementById('toggleSidebar').addEventListener('click', function() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('hidden');
    });

    document.getElementById('closeSidebar').addEventListener('click', function() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.add('hidden');
    });
}

// ============================================================================
// Toggle Layer Visibility
// ============================================================================
function toggleLayer(layerKey) {
    return function(event) {
        if (geoJsonLayers[layerKey]) {
            if (event.target.checked) {
                map.addLayer(geoJsonLayers[layerKey].layer);
                geoJsonLayers[layerKey].visible = true;
            } else {
                map.removeLayer(geoJsonLayers[layerKey].layer);
                geoJsonLayers[layerKey].visible = false;
            }
        }
    };
}

// ============================================================================
// Update Coordinates Display
// ============================================================================
function updateCoordinates() {
    const center = map.getCenter();
    const zoom = map.getZoom();

    document.getElementById('latValue').textContent = center.lat.toFixed(5);
    document.getElementById('lonValue').textContent = center.lng.toFixed(5);
    document.getElementById('zoomValue').textContent = zoom;
}

// ============================================================================
// Initialize on Page Load
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🗺️ Initializing GIS Web App...');
    initializeMap();
    updateCoordinates();
});
