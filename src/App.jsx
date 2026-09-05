import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, Pane } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { SOIL_GROUPS, SPECIFIC_SOIL_OVERRIDES, DEFAULT_SOIL_STYLE } from './soil.config.js';

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

// Масив файлів ґрунтів (легко розширювати іншими областями)
const SOIL_FILES = [
    { file: 'Cherkaska_soils.json' }
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
    const [soilsData, setSoilsData] = useState(null);
    const [ownedPlots, setOwnedPlots] = useState([]);

    // Режим перегляду: 'hromadas' або 'soils' (зберігається в localStorage)
    const [activeMode, setActiveMode] = useState(() => {
        return localStorage.getItem('map_mode') || 'hromadas';
    });

    const handleModeChange = (mode) => {
        setActiveMode(mode);
        localStorage.setItem('map_mode', mode);
    };

    useEffect(() => {
        const baseUrl = import.meta.env.BASE_URL;

        // 1. Завантаження геоданих меж громад через Promise.all
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

        // 2. Завантаження геоданих ґрунтів через Promise.all (аналогічно громад)
        Promise.all(
            SOIL_FILES.map(item =>
                fetch(`${baseUrl}${item.file}`)
                    .then(res => res.json())
                    .then(data => Array.isArray(data) ? data : (data.features || []))
            )
        )
            .then(dataArray => {
                setSoilsData({
                    type: 'FeatureCollection',
                    features: dataArray.flat()
                });
            })
            .catch(err => console.error("Помилка завантаження GeoJSON ґрунтів:", err));

        // 3. Зчитування збережених паїв із localStorage
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

    // Гнучка функція стилізації полігонів ґрунтів
    const getSoilStyle = (feature) => {
        const props = feature?.properties || {};
        const groupCode = props.group_code || props.soil_code;
        const specificCode = props.soil_code;

        // 1. Пошук індивідуального відтінку
        if (specificCode && SPECIFIC_SOIL_OVERRIDES[specificCode]) {
            const override = SPECIFIC_SOIL_OVERRIDES[specificCode];
            return {
                fillColor: override.color,
                weight: 0.8,
                opacity: 0.8,
                color: override.stroke || '#444444',
                fillOpacity: 0.65
            };
        }

        // 2. Пошук за групою (gk1..gk8, gk11)
        if (groupCode && SOIL_GROUPS[groupCode]) {
            const group = SOIL_GROUPS[groupCode];
            return {
                fillColor: group.color,
                weight: 0.8,
                opacity: 0.8,
                color: group.stroke,
                fillOpacity: 0.65
            };
        }

        // 3. Запасний стиль
        return {
            fillColor: DEFAULT_SOIL_STYLE.color,
            weight: 0.8,
            opacity: 0.8,
            color: DEFAULT_SOIL_STYLE.stroke,
            fillOpacity: 0.5
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

                {/* Радіокнопки для вибору режиму перегляду */}
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    borderTop: '1px solid #eee',
                    paddingTop: '8px',
                    fontSize: '13px',
                    fontWeight: '500'
                }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="mapMode"
                            value="hromadas"
                            checked={activeMode === 'hromadas'}
                            onChange={() => handleModeChange('hromadas')}
                        />
                        Межі громад
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="mapMode"
                            value="soils"
                            checked={activeMode === 'soils'}
                            onChange={() => handleModeChange('soils')}
                        />
                        Карта ґрунтів
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
                {/* Глобальні панелі Z-Index */}
                <Pane name="soilsPane" style={{ zIndex: 400 }} />
                <Pane name="adminBoundariesPane" style={{ zIndex: 500 }} />
                <Pane name="markersPane" style={{ zIndex: 1000 }} />

                {/* Базовий шар OpenStreetMap */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | &copy; <a href="https://data.humdata.org/dataset/cod-ab-ukr" target="_blank" rel="noopener noreferrer">OCHA HDX</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Відображення шару залежно від обраного режиму */}
                {activeMode === 'soils' && soilsData && (
                    <GeoJSON
                        key="soils-geojson"
                        data={soilsData}
                        style={getSoilStyle}
                        pane="soilsPane"
                        onEachFeature={(feature, layer) => {
                            const props = feature.properties || {};
                            const groupInfo = SOIL_GROUPS[props.group_code] || {};

                            const soilName = props.name || groupInfo.name || 'Невизначений тип ґрунту';
                            const soilCode = props.soil_code || props.group_code || '—';

                            layer.bindPopup(`
                                <div style="font-size: 13px; max-width: 220px;">
                                    <b style="color: #1d3557;">Тип ґрунту:</b> ${soilName}<br/>
                                    <b>Код:</b> <code>${soilCode}</code><br/>
                                    ${props.group_code ? `<b>Група:</b> ${props.group_code.toUpperCase()}` : ''}
                                </div>
                            `);
                        }}
                    />
                )}

                {activeMode === 'hromadas' && geoJsonData && (
                    <GeoJSON
                        key="hromadas-geojson"
                        data={geoJsonData}
                        style={getPolygonStyle}
                        pane="adminBoundariesPane"
                        onEachFeature={onEachHromadaFeature}
                    />
                )}

                {/* Маркери куплених паїв (завжди зверху через markersPane з zIndex 1000) */}
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
