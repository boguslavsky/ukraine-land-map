import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, Pane } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const version = import.meta.env.VITE_BUILD_TIME;

// Фабрика для створення іконки-шпильки будь-якого кольору
const createPinIcon = (color) => L.divIcon({
    className: 'custom-pin-marker',
    html: `
    <div style="
      background-color: ${color};
      width: 22px;
      height: 22px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>
  `,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22]
});

// Зелений маркер для паїв, червоний — для знайдених точок за координатами
const ownedPlotIcon = createPinIcon('#2a9d8f');
const searchedPlotIcon = createPinIcon('#e01919');

// Координаційні межі території України (Пд-Зх та Пн-Сх кути)
const UKRAINE_BOUNDS = [
    [44.03, 22.13], // Південно-західна точка
    [52.38, 40.22]  // Північно-східна точка
];

// Масив файлів адмін. громад з контрастною колірною гамою
const HROMADA_FILES = [
    { file: 'Kyivska.json', color: '#2563eb', stroke: '#1e40af' },       // Синій
    { file: 'Zhytomyrska.json', color: '#16a34a', stroke: '#15803d' },   // Зелений
    { file: 'Vinnytska.json', color: '#9333ea', stroke: '#6b21a8' },      // Фіолетовий
    { file: 'Cherkaska.json', color: '#ea580c', stroke: '#c2410c' },      // Помаранчевий
    { file: 'Kirovohradska.json', color: '#dc2626', stroke: '#991b1b' },   // Червоний
    { file: 'Khmelnytska.json', color: '#0891b2', stroke: '#0e7490' },    // Бірюзовий (Циан)
    { file: 'Ternopilska.json', color: '#db2777', stroke: '#9d174d' }     // Рожевий (Маджента)
];

function MapRecenter({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 13);
        }
    }, [center, map]);
    return null;
}

export default function App() {
    const ukraineCenter = [49.594326, 29.234205];
    const [coordsInput, setCoordsInput] = useState('');
    const [selectedCoords, setSelectedCoords] = useState(null);
    const [geoJsonData, setGeoJsonData] = useState(null);
    const [ownedPlots, setOwnedPlots] = useState([]);
    const [searchedMarkers, setSearchedMarkers] = useState([]);

    // Режими карт: 'osm', 'google', 'esri'
    const [activeMode, setActiveMode] = useState(() => {
        const saved = localStorage.getItem('map_mode');
        if (saved === 'hybrid' || saved === 'google') return 'google';
        if (saved === 'esri') return 'esri';
        return 'osm';
    });

    const handleModeChange = (mode) => {
        setActiveMode(mode);
        localStorage.setItem('map_mode', mode);
    };

    useEffect(() => {
        const baseUrl = import.meta.env.BASE_URL;

        // 1. Завантаження геоданих меж громад
        Promise.all(
            HROMADA_FILES.map(item =>
                fetch(`${baseUrl}${item.file}?v=${version}`)
                    .then(res => res.json())
                    .then(features =>
                        features.map(feature => ({
                            ...feature,
                            properties: {
                                ...feature.properties,
                                _color: item.color,
                                _stroke: item.stroke
                            }
                        }))
                    )
            )
        )
            .then(dataArray => {
                setGeoJsonData({
                    type: 'FeatureCollection',
                    features: dataArray.flat()
                });
            })
            .catch(err => console.error("Помилка завантаження GeoJSON меж громад:", err));

        // 2. Зчитування збережених паїв із localStorage
        const savedPlots = localStorage.getItem('my_owned_plots');
        if (savedPlots) {
            try {
                setOwnedPlots(JSON.parse(savedPlots));
            } catch (err) {
                console.error("Помилка зчитування збережених паїв:", err);
            }
        }

        // 3. Зчитування збережених пошукових маркерів із localStorage
        const savedSearches = localStorage.getItem('my_searched_markers');
        if (savedSearches) {
            try {
                setSearchedMarkers(JSON.parse(savedSearches));
            } catch (err) {
                console.error("Помилка зчитування знайдених маркерів:", err);
            }
        }
    }, []);

    // Обробка пошуку та збереження маркера за координатами
    const handleSearch = (e) => {
        e.preventDefault();
        const parts = coordsInput.split(/[\s,]+/).map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const lat = parts[0];
            const lng = parts[1];
            const newMarker = { id: Date.now(), lat, lng };

            const updated = [...searchedMarkers, newMarker];
            setSearchedMarkers(updated);
            localStorage.setItem('my_searched_markers', JSON.stringify(updated));

            setSelectedCoords([lat, lng]);
            setCoordsInput('');
        } else {
            alert("Введіть коректні координати у форматі: широта, довгота (наприклад: 50.4501, 30.5234)");
        }
    };

    // Видалення індивідуального пошукового маркера
    const handleRemoveSearchMarker = (id) => {
        const updated = searchedMarkers.filter(m => m.id !== id);
        setSearchedMarkers(updated);
        localStorage.setItem('my_searched_markers', JSON.stringify(updated));
    };

    // Завантаження локального JSON з ПК
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsedData = JSON.parse(event.target.result);
                if (Array.isArray(parsedData)) {
                    setOwnedPlots(parsedData);
                    localStorage.setItem('my_owned_plots', JSON.stringify(parsedData));
                } else {
                    alert("Файл повинен містити масив об'єктів з координатами!");
                }
            } catch (err) {
                alert("Помилка розбору JSON файлу!");
            }
        };
        reader.readAsText(file);
    };

    // Очищення паїв з локального сховища
    const handleClearPlots = () => {
        if (window.confirm("Очистити всі завантажені паї з карти та пам'яті браузера?")) {
            setOwnedPlots([]);
            localStorage.removeItem('my_owned_plots');
        }
    };

    // Стиль для полігонів громад
    const getPolygonStyle = (feature) => {
        return {
            fillColor: feature?.properties?._color || '#95a5a6',
            weight: 1.5,
            opacity: 0.9,
            color: feature?.properties?._stroke || '#34495e',
            fillOpacity: 0.35
        };
    };

    const onEachHromadaFeature = (feature, layer) => {
        if (feature.properties) {
            const { adm3_name1: name, adm2_name1: district, adm1_name1: region } = feature.properties;
            layer.bindPopup(`
        <div style="font-size: 14px;">
          <b>Громада:</b> ${name || 'Без назви'}<br/>
          ${district ? `<b>Район:</b> ${district}<br/>` : ''}
          ${region ? `<b>Область:</b> ${region}<br/>` : ''}
        </div>
      `, { pane: 'popupsPane' });
        }
    };

    return (
        <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
            {/* Верхня панель управління */}
            <div style={{
                position: 'absolute',
                top: 15,
                left: 50,
                zIndex: 1000,
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '12px 16px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}>
                {/* Форма пошуку */}
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="50.4398872,30.5183032"
                        value={coordsInput}
                        onChange={(e) => setCoordsInput(e.target.value)}
                        style={{
                            width: '180px',
                            padding: '8px 12px',
                            fontSize: '14px',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                        }}
                    />
                    <button
                        type="submit"
                        style={{
                            padding: '8px 14px',
                            fontSize: '14px',
                            backgroundColor: '#1d3557',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Знайти
                    </button>
                </form>

                {/* Компактний перемикач підложки карти */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    borderTop: '1px solid #eee',
                    paddingTop: '8px',
                    fontSize: '13px',
                    fontWeight: '500'
                }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="mapMode"
                            value="osm"
                            checked={activeMode === 'osm'}
                            onChange={() => handleModeChange('osm')}
                        />
                        OSM
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="mapMode"
                            value="google"
                            checked={activeMode === 'google'}
                            onChange={() => handleModeChange('google')}
                        />
                        Google
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="mapMode"
                            value="esri"
                            checked={activeMode === 'esri'}
                            onChange={() => handleModeChange('esri')}
                        />
                        Esri
                    </label>
                </div>

                {/* Блок завантаження локального файлу з паями */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                    <label style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        backgroundColor: '#2a9d8f',
                        color: '#fff',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        Завантажити
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                    </label>

                    {ownedPlots.length > 0 && (
                        <>
                            <span style={{ fontSize: '13px', color: '#333', fontWeight: 'bold' }}>
                                Завантажено: {ownedPlots.length}
                            </span>
                            <button
                                onClick={handleClearPlots}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    backgroundColor: '#e74c3c',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                ✕
                            </button>
                        </>
                    )}
                </div>
            </div>

            <MapContainer
                center={ukraineCenter}
                zoom={7}
                minZoom={6}
                maxBounds={UKRAINE_BOUNDS}
                maxBoundsViscosity={1.0}
                style={{ height: '100%', width: '100%' }}
            >
                {/* Панелі Z-Index */}
                <Pane name="adminBoundariesPane" style={{ zIndex: 500 }} />
                <Pane name="markersPane" style={{ zIndex: 1000 }} />
                <Pane name="popupsPane" style={{ zIndex: 1100 }} />

                {/* Динамічні підложки */}
                {activeMode === 'osm' && (
                    <TileLayer
                        key="osm-layer"
                        attribution='&copy; OpenStreetMap | &copy; OCHA HDX'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                )}

                {activeMode === 'google' && (
                    <TileLayer
                        key="google-layer"
                        attribution='&copy; Google Maps | &copy; OCHA HDX'
                        url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        maxZoom={20}
                    />
                )}

                {activeMode === 'esri' && (
                    <TileLayer
                        key="esri-layer"
                        attribution='Tiles &copy; Esri | &copy; OCHA HDX'
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        maxZoom={19}
                    />
                )}

                {/* Шар полігонів громад */}
                {geoJsonData && (
                    <GeoJSON
                        key="hromadas-geojson"
                        data={geoJsonData}
                        style={getPolygonStyle}
                        pane="adminBoundariesPane"
                        onEachFeature={onEachHromadaFeature}
                    />
                )}

                {/* Маркери куплених паїв (зелені) */}
                {ownedPlots.map((plot) => (
                    <Marker
                        key={plot.id || `${plot.lat}-${plot.lng}`}
                        position={[plot.lat, plot.lng]}
                        icon={ownedPlotIcon}
                        pane="markersPane"
                    >
                        <Popup pane="popupsPane">
                            <div style={{ fontSize: '14px' }}>
                                <b style={{ color: '#2a9d8f' }}>{plot.title || 'Куплений пай'}</b><br />
                                {plot.area && <><b>Площа:</b> {plot.area}<br /></>}
                                <b>Координати:</b> {plot.lat}, {plot.lng}<br />
                                {plot.note && <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#555' }}>{plot.note}</div>}
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Збережені маркери пошуку (червоні) */}
                {searchedMarkers.map((marker) => (
                    <Marker
                        key={marker.id}
                        position={[marker.lat, marker.lng]}
                        icon={searchedPlotIcon}
                        pane="markersPane"
                    >
                        <Popup pane="popupsPane">
                            <div style={{ fontSize: '14px', minWidth: '150px' }}>
                                <b>Координати:</b> {marker.lat}, {marker.lng}<br />
                                <button
                                    onClick={() => handleRemoveSearchMarker(marker.id)}
                                    style={{
                                        marginTop: '8px',
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        backgroundColor: '#e74c3c',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Видалити
                                </button>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Центрування карти при пошуку */}
                {selectedCoords && <MapRecenter center={selectedCoords} />}
            </MapContainer>
        </div>
    );
}
