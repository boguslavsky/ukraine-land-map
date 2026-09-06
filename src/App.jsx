import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, Pane } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIconPng from 'leaflet/dist/images/marker-icon.png';
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png';

// Синій маркер для тимчасового пошуку координат
const searchIcon = L.icon({
    iconUrl: markerIconPng,
    shadowUrl: markerShadowPng,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Зелений маркер для куплених паїв
const ownedPlotIcon = L.divIcon({
    className: 'owned-plot-marker',
    html: `
    <div style="
      background-color: #2a9d8f;
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

// Масив файлів адмін. громад з кольорами для кожної області
const HROMADA_FILES = [
    { file: 'Kyivska.json', color: '#4a90e2', stroke: '#1d5288' },       // Синій
    { file: 'Zhytomyrska.json', color: '#50c878', stroke: '#1e7b34' },   // Зелений
    { file: 'Vinnytska.json', color: '#9b59b6', stroke: '#5b2c6f' },      // Фіолетовий
    { file: 'Cherkaska.json', color: '#f39c12', stroke: '#935116' },      // Помаранчевий
    { file: 'Kirovohradska.json', color: '#e74c3c', stroke: '#78281f' },   // Червоний
    { file: 'Khmelnytska.json', color: '#3cb4e7', stroke: '#147eab' }    // Неоновий
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
    const ukraineCenter = [48.3794, 31.1656];
    const [coordsInput, setCoordsInput] = useState('');
    const [selectedCoords, setSelectedCoords] = useState(null);
    const [geoJsonData, setGeoJsonData] = useState(null);
    const [ownedPlots, setOwnedPlots] = useState([]);

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

        // Завантаження геоданих меж громад
        Promise.all(
            HROMADA_FILES.map(item =>
                fetch(`${baseUrl}${item.file}`)
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

        // Зчитування збережених паїв із localStorage
        const savedPlots = localStorage.getItem('my_owned_plots');
        if (savedPlots) {
            try {
                setOwnedPlots(JSON.parse(savedPlots));
            } catch (err) {
                console.error("Помилка зчитування збережених паїв:", err);
            }
        }
    }, []);

    // Обробка пошуку координат
    const handleSearch = (e) => {
        e.preventDefault();
        const parts = coordsInput.split(/[\s,]+/).map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            setSelectedCoords([parts[0], parts[1]]);
        } else {
            alert("Введіть коректні координати у форматі: широта, довгота (наприклад: 50.4501, 30.5234)");
        }
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
            fillOpacity: 0.25
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
      `);
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
                        placeholder="Координати: 50.4501, 30.5234"
                        value={coordsInput}
                        onChange={(e) => setCoordsInput(e.target.value)}
                        style={{
                            width: '240px',
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
                        📁 Завантажити паї (JSON)
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
                zoom={6}
                style={{ height: '100%', width: '100%' }}
            >
                {/* Панелі Z-Index */}
                <Pane name="adminBoundariesPane" style={{ zIndex: 500 }} />
                <Pane name="markersPane" style={{ zIndex: 1000 }} />

                {/* Динамічні підложки з явними ключами для перезавантаження Leaflet layer */}
                {activeMode === 'osm' && (
                    <TileLayer
                        key="osm-layer"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | &copy; <a href="https://data.humdata.org/dataset/cod-ab-ukr" target="_blank" rel="noopener noreferrer">OCHA HDX</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                )}

                {activeMode === 'google' && (
                    <TileLayer
                        key="google-layer"
                        attribution='&copy; Google Maps | &copy; <a href="https://data.humdata.org/dataset/cod-ab-ukr" target="_blank" rel="noopener noreferrer">OCHA HDX</a>'
                        url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        maxZoom={20}
                    />
                )}

                {activeMode === 'esri' && (
                    <TileLayer
                        key="esri-layer"
                        attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community | &copy; <a href="https://data.humdata.org/dataset/cod-ab-ukr" target="_blank" rel="noopener noreferrer">OCHA HDX</a>'
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

                {/* Маркери паїв */}
                {ownedPlots.map((plot) => (
                    <Marker
                        key={plot.id || `${plot.lat}-${plot.lng}`}
                        position={[plot.lat, plot.lng]}
                        icon={ownedPlotIcon}
                        pane="markersPane"
                    >
                        <Popup>
                            <div style={{ fontSize: '14px' }}>
                                <b style={{ color: '#2a9d8f' }}>{plot.title || 'Куплений пай'}</b><br />
                                {plot.area && <><b>Площа:</b> {plot.area}<br /></>}
                                <b>Координати:</b> {plot.lat}, {plot.lng}<br />
                                {plot.note && <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#555' }}>{plot.note}</div>}
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Маркер пошуку координат */}
                {selectedCoords && (
                    <>
                        <Marker position={selectedCoords} icon={searchIcon} pane="markersPane">
                            <Popup>
                                Обрана точка:<br />
                                <b>{selectedCoords[0]}, {selectedCoords[1]}</b>
                            </Popup>
                        </Marker>
                        <MapRecenter center={selectedCoords} />
                    </>
                )}
            </MapContainer>
        </div>
    );
}
