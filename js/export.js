// ============================================================================
// Export Functionality - Export selected features to XLS
// ============================================================================

/**
 * Export selected features to Excel (XLS) format
 * @param {Array} features - GeoJSON features to export
 * @param {String} fileName - Base name for the export file
 */
function exportToXLS(features, fileName = 'export') {
    if (!features || features.length === 0) {
        alert('No features to export');
        return;
    }

    // Prepare data for export
    const exportData = [];
    const headers = new Set();

    // Collect all unique property keys
    features.forEach(feature => {
        if (feature.properties) {
            Object.keys(feature.properties).forEach(key => headers.add(key));
        }
    });

    // Convert Set to Array and sort
    const headerArray = Array.from(headers).sort();

    // Add header row
    const headerRow = {};
    headerArray.forEach(header => {
        headerRow[header] = header;
    });
    exportData.push(headerRow);

    // Add data rows
    features.forEach((feature, index) => {
        const row = { 'ID': index + 1 };
        
        // Add all properties
        if (feature.properties) {
            headerArray.forEach(header => {
                row[header] = feature.properties[header] !== undefined ? feature.properties[header] : '';
            });
        }

        // Add geometry info
        if (feature.geometry) {
            row['Geometry_Type'] = feature.geometry.type;
            
            // Add coordinates for point features
            if (feature.geometry.type === 'Point') {
                row['Longitude'] = feature.geometry.coordinates[0];
                row['Latitude'] = feature.geometry.coordinates[1];
            }
        }

        exportData.push(row);
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const colWidths = [];
    headerArray.forEach(() => {
        colWidths.push({ wch: 15 });
    });
    worksheet['!cols'] = colWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Features');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fullFileName = `${fileName}_${timestamp}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, fullFileName);

    console.log(`✓ Exported ${features.length} features to ${fullFileName}`);
}

/**
 * Export selected features to CSV format
 * @param {Array} features - GeoJSON features to export
 * @param {String} fileName - Base name for the export file
 */
function exportToCSV(features, fileName = 'export') {
    if (!features || features.length === 0) {
        alert('No features to export');
        return;
    }

    const headers = new Set();

    // Collect all unique property keys
    features.forEach(feature => {
        if (feature.properties) {
            Object.keys(feature.properties).forEach(key => headers.add(key));
        }
    });

    const headerArray = ['ID', ...Array.from(headers).sort(), 'Geometry_Type', 'Longitude', 'Latitude'];

    // Create CSV content
    let csvContent = headerArray.join(',') + '\n';

    features.forEach((feature, index) => {
        const row = [index + 1];

        // Add properties
        const headerArray2 = Array.from(headers).sort();
        headerArray2.forEach(header => {
            const value = feature.properties && feature.properties[header] !== undefined 
                ? feature.properties[header] 
                : '';
            
            // Escape quotes and wrap in quotes if contains comma or quote
            const escapedValue = String(value).replace(/"/g, '""');
            row.push(`"${escapedValue}"`);
        });

        // Add geometry info
        if (feature.geometry) {
            row.push(`"${feature.geometry.type}"`);
            
            if (feature.geometry.type === 'Point') {
                row.push(feature.geometry.coordinates[0]);
                row.push(feature.geometry.coordinates[1]);
            } else {
                row.push('');
                row.push('');
            }
        }

        csvContent += row.join(',') + '\n';
    });

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fullFileName = `${fileName}_${timestamp}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fullFileName);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`✓ Exported ${features.length} features to ${fullFileName}`);
}

/**
 * Export selected features as GeoJSON
 * @param {Array} features - GeoJSON features to export
 * @param {String} fileName - Base name for the export file
 */
function exportToGeoJSON(features, fileName = 'export') {
    if (!features || features.length === 0) {
        alert('No features to export');
        return;
    }

    const geojson = {
        type: 'FeatureCollection',
        features: features
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fullFileName = `${fileName}_${timestamp}.geojson`;

    link.setAttribute('href', url);
    link.setAttribute('download', fullFileName);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`✓ Exported ${features.length} features to ${fullFileName}`);
}

/**
 * Copy selected features to clipboard as JSON
 * @param {Array} features - GeoJSON features to copy
 */
function copyToClipboard(features) {
    if (!features || features.length === 0) {
        alert('No features to copy');
        return;
    }

    const geojson = {
        type: 'FeatureCollection',
        features: features
    };

    navigator.clipboard.writeText(JSON.stringify(geojson, null, 2)).then(() => {
        alert(`✓ Copied ${features.length} features to clipboard`);
        console.log(`✓ Copied ${features.length} features to clipboard`);
    }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
    });
}
