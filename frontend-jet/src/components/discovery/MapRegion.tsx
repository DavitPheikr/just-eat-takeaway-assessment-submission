import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { MapPin } from "lucide-react";
import type { Restaurant } from "@/lib/api/types";

// Fix Leaflet's default marker icon paths under Vite bundling.
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/**
 * Selected-state marker — custom divIcon styled with brand tokens.
 * Visually distinct from default markers so the focused pin reads instantly.
 */
const SelectedIcon = L.divIcon({
  className: "chefpick-selected-pin",
  html: `
    <div style="
      width: 34px; height: 34px; border-radius: 9999px;
      background: hsl(var(--brand));
      border: 3px solid hsl(var(--brand-foreground));
      box-shadow: 0 6px 16px -4px hsl(var(--brand) / 0.55), 0 0 0 4px hsl(var(--brand) / 0.18);
      display: flex; align-items: center; justify-content: center;
      color: hsl(var(--brand-foreground));
      font-weight: 700; font-size: 14px;
      transition: transform 120ms ease, box-shadow 120ms ease;
    ">★</div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -16],
});

interface MapRegionProps {
  restaurants: Restaurant[];
  focusedId: string | null;
  onMarkerClick?: (id: string) => void;
}

/**
 * Real Leaflet + OpenStreetMap map for the Discovery screen.
 *
 * This pass adds:
 *   - selected-marker styling driven by `focusedId`
 *   - marker click → onMarkerClick(id)
 *   - gentle map recenter (flyTo, or setView when reduced-motion is preferred)
 *     when the focused restaurant changes and is mappable
 *
 * Restaurants with null coordinates are skipped on the map but remain in the
 * card list (handled upstream); selection logic is keyed by id and tolerates
 * a focusedId that has no marker.
 */
export function MapRegion({ restaurants, focusedId, onMarkerClick }: MapRegionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  // id → marker, so we can update icon state without rebuilding the layer.
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());
  // Latest click handler, kept in a ref so the marker effect doesn't need to
  // rewire listeners every render.
  const onMarkerClickRef = useRef(onMarkerClick);
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  // Stable list of restaurants we can actually plot.
  const mappable = useMemo(
    () =>
      restaurants.filter(
        (r): r is Restaurant & { latitude: number; longitude: number } =>
          r.latitude !== null && r.longitude !== null,
      ),
    [restaurants],
  );

  // Initialize the Leaflet map exactly once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      center: [51.5074, -0.1278],
      zoom: 12,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      markerByIdRef.current.clear();
    };
  }, []);

  // Render markers + adjust viewport whenever the mappable set changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerByIdRef.current.clear();

    if (mappable.length === 0) return;

    const latLngs: L.LatLngExpression[] = [];
    for (const r of mappable) {
      const marker = L.marker([r.latitude, r.longitude], {
        title: r.name,
        icon: r.id === focusedId ? SelectedIcon : DefaultIcon,
        riseOnHover: true,
        zIndexOffset: r.id === focusedId ? 1000 : 0,
      });
      marker.bindTooltip(r.name, { direction: "top", offset: [0, -8] });
      marker.on("click", () => {
        onMarkerClickRef.current?.(r.id);
      });
      marker.addTo(layer);
      markerByIdRef.current.set(r.id, marker);
      latLngs.push([r.latitude, r.longitude]);
    }

    if (mappable.length === 1) {
      map.setView(latLngs[0], 15, { animate: false });
    } else {
      map.fitBounds(L.latLngBounds(latLngs), {
        padding: [32, 32],
        maxZoom: 16,
        animate: false,
      });
    }

    const t = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(t);
    // Intentionally exclude focusedId — selection state is handled in the next
    // effect to avoid rebuilding markers (and resetting viewport) on every focus change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappable]);

  // Update marker icons + gently recenter when focusedId changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Update icon state for every marker.
    markerByIdRef.current.forEach((marker, id) => {
      const isFocused = id === focusedId;
      marker.setIcon(isFocused ? SelectedIcon : DefaultIcon);
      marker.setZIndexOffset(isFocused ? 1000 : 0);
    });

    if (!focusedId) return;
    const target = mappable.find((r) => r.id === focusedId);
    if (!target) return; // focused card has no coordinates — that's fine.

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Always recenter at a consistent, gentle zoom so map behavior feels
    // identical whether focus came from a pin click or a card scroll.
    const targetZoom = 14;

    if (prefersReducedMotion) {
      map.setView([target.latitude, target.longitude], targetZoom, { animate: false });
    } else {
      map.flyTo([target.latitude, target.longitude], targetZoom, {
        duration: 0.45,
        easeLinearity: 0.4,
      });
    }
  }, [focusedId, mappable]);

  return (
    <section
      aria-label="Map of nearby restaurants"
      className="relative h-full w-full overflow-hidden border-b border-border bg-surface-muted"
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {mappable.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full bg-surface/85 px-3 py-1.5 text-xs font-medium text-ink-muted shadow-sm backdrop-blur">
            <MapPin className="h-3.5 w-3.5" />
            {restaurants.length > 0
              ? "No coordinates available for these restaurants"
              : "No restaurants to map"}
          </div>
        </div>
      )}
    </section>
  );
}
