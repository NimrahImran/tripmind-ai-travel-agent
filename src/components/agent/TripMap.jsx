import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DAY_COLORS = ['#f4b13f', '#2e8b83', '#e9705d', '#7aa9d6', '#b48ad6', '#9bb66b', '#d6c28a'];

/**
 * Route map: one numbered pin per stop, coloured by day, joined in order.
 * Before the plan finishes it shows just the destination.
 */
export default function TripMap({ place, trip }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      tap: false,
    }).setView([20, 10], 2);
    addTiles(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    const ro = new ResizeObserver(() => map.current?.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layer.current.clearLayers();
    const days = trip?.days?.filter((d) => d.places.length) || [];

    if (days.length) {
      const all = [];
      let n = 0;
      days.forEach((d, di) => {
        const color = DAY_COLORS[di % DAY_COLORS.length];
        d.places.forEach((p) => {
          n += 1;
          all.push([p.lat, p.lng]);
          L.marker([p.lat, p.lng], {
            icon: L.divIcon({
              className: 'pin',
              html: `<span style="--c:${color}">${n}</span>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
            title: p.name,
          })
            .bindTooltip(`<strong>Day ${d.day}</strong> · ${escapeHtml(p.name)}`, { direction: 'top', offset: [0, -12] })
            .addTo(layer.current);
        });
      });
      if (all.length > 1) {
        L.polyline(all, { color: '#0f2e3a', weight: 2.5, opacity: 0.7, dashArray: '6 7' }).addTo(layer.current);
      }
      m.fitBounds(L.latLngBounds(all).pad(0.25), { maxZoom: 12, animate: true });
    } else if (place) {
      L.marker([place.lat, place.lng], {
        icon: L.divIcon({ className: 'pin pin-dest', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        title: place.name,
      }).addTo(layer.current);
      m.setView([place.lat, place.lng], 9, { animate: true });
    }
  }, [place, trip]);

  const count = trip?.days?.reduce((s, d) => s + d.places.length, 0) || 0;

  return (
    <section className="panel map-panel" aria-label="Route map">
      <header className="panel-head">
        <h3>Route map</h3>
        <span className="panel-note">{count ? `${count} stops` : place ? 'Pins appear when the plan is ready' : ''}</span>
      </header>
      <div className="map" ref={el} />
      {trip?.days?.length > 0 && (
        <ul className="map-key">
          {trip.days.map((d, i) => (
            <li key={d.day}>
              <span className="swatch" style={{ background: DAY_COLORS[i % DAY_COLORS.length] }} />
              Day {d.day}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Free map tiles, no key needed. If a provider refuses tiles (for example
 * it asks for an API key), the map quietly switches to the next one.
 */
const TILE_PROVIDERS = [
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' },
  },
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 19, attribution: 'Tiles &copy; Esri' },
  },
  {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO' },
  },
];

function addTiles(map, index = 0) {
  const provider = TILE_PROVIDERS[index];
  if (!provider) return;
  const layer = L.tileLayer(provider.url, { ...provider.options, crossOrigin: true });
  let errors = 0;
  let loaded = 0;
  layer.on('tileload', () => {
    loaded += 1;
  });
  layer.on('tileerror', () => {
    errors += 1;
    if (errors >= 3 && loaded === 0) {
      map.removeLayer(layer);
      addTiles(map, index + 1);
    }
  });
  layer.addTo(map);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
