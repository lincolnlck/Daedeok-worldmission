"use client";

import "leaflet-defaulticon-compatibility";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import L from "leaflet";

export type MissionaryItem = {
  folderId: string;
  folderName: string;
  name: string;
  country: string;
  ministry: string;
  lat: number;
  lng: number;
};

function RemoveControls() {
  const map = useMap();

  useEffect(() => {
    const removeControls = () => {
      const bottomLeft = document.querySelector(".leaflet-bottom-left");
      if (bottomLeft) {
        (bottomLeft as HTMLElement).style.display = "none";
        bottomLeft.remove();
      }

      const allControls = document.querySelectorAll(".leaflet-control");
      allControls.forEach((control) => {
        const buttons = control.querySelectorAll("button, a, div");
        buttons.forEach((element) => {
          const text = (element.textContent || "").trim();
          const title = element.getAttribute("title") || "";
          const ariaLabel = element.getAttribute("aria-label") || "";
          const className = element.className || "";

          if (
            text === "N" ||
            text.includes("North") ||
            text.includes("north") ||
            title.includes("North") ||
            title === "N" ||
            ariaLabel.includes("North") ||
            ariaLabel === "N" ||
            className.includes("compass") ||
            className.includes("north")
          ) {
            const parentControl = element.closest(".leaflet-control");
            if (parentControl) {
              (parentControl as HTMLElement).style.display = "none";
              parentControl.remove();
            } else {
              (element as HTMLElement).style.display = "none";
              element.remove();
            }
          }
        });
      });

      const mapContainer = map.getContainer();
      if (!mapContainer) return;

      const allElements = mapContainer.querySelectorAll("*");
      allElements.forEach((el) => {
        const element = el as HTMLElement;
        const rect = element.getBoundingClientRect();
        const mapRect = mapContainer.getBoundingClientRect();

        if (
          rect.left < mapRect.left + 100 &&
          rect.bottom > mapRect.bottom - 100 &&
          (el.textContent?.trim() === "N" ||
            el.textContent?.includes("North") ||
            el.getAttribute("title")?.includes("N"))
        ) {
          element.style.display = "none";
          element.remove();
        }
      });
    };

    map.whenReady(() => {
      removeControls();
      setTimeout(removeControls, 100);
      setTimeout(removeControls, 500);
      setTimeout(removeControls, 1000);
      setTimeout(removeControls, 2000);
    });

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          const element = node as HTMLElement;
          const text = element.textContent || "";
          const title = element.getAttribute("title") || "";

          if (
            text.trim() === "N" ||
            text.includes("North") ||
            title.includes("North") ||
            title === "N" ||
            element.classList.contains("leaflet-bottom-left")
          ) {
            element.style.display = "none";
            element.remove();
          }

          const buttons = element.querySelectorAll("button, a, div");
          buttons.forEach((btn) => {
            const btnText = btn.textContent || "";
            if (btnText.trim() === "N" || btnText.includes("North")) {
              const parent = btn.closest(".leaflet-control");
              if (parent) {
                (parent as HTMLElement).style.display = "none";
                parent.remove();
              }
            }
          });
        });
      });

      removeControls();
    });

    const mapContainer = map.getContainer();
    observer.observe(mapContainer, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [map]);

  return null;
}

function MapBoundsFitter({ items }: { items: MissionaryItem[] }) {
  const map = useMap();
  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024;
  }, []);

  useEffect(() => {
    if (items.length === 0 || !isMobile) return;

    const bounds = L.latLngBounds(items.map((item) => [item.lat, item.lng] as [number, number]));
    const center = bounds.getCenter();
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();

    const latDiff = northEast.lat - southWest.lat;
    const lngDiff = northEast.lng - southWest.lng;
    const shrinkFactor = 0.85;

    const shrunkBounds = L.latLngBounds([
      [center.lat - (latDiff * shrinkFactor) / 2, center.lng - (lngDiff * shrinkFactor) / 2],
      [center.lat + (latDiff * shrinkFactor) / 2, center.lng + (lngDiff * shrinkFactor) / 2],
    ]);

    map.fitBounds(shrunkBounds, {
      padding: [30, 30],
      maxZoom: 10,
    });
  }, [isMobile, items, map]);

  return null;
}

export default function WorldMap({
  items,
  onSelect,
}: {
  items: MissionaryItem[];
  onSelect: (missionary: MissionaryItem) => void;
}) {
  const router = useRouter();

  const initialCenter = useMemo(() => {
    if (items.length === 0) return [20, 0] as [number, number];

    const avgLat = items.reduce((sum, item) => sum + item.lat, 0) / items.length;
    const avgLng = items.reduce((sum, item) => sum + item.lng, 0) / items.length;

    return [avgLat, avgLng] as [number, number];
  }, [items]);

  return (
    <MapContainer
      center={initialCenter}
      zoom={2}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RemoveControls />
      <MapBoundsFitter items={items} />

      {items.map((missionary) => (
        <Marker
          key={missionary.folderId}
          position={[missionary.lat, missionary.lng]}
          eventHandlers={{
            click: () => onSelect(missionary),
          }}
        >
          <Popup className="custom-popup">
            <div className="space-y-2 min-w-[150px]">
              <div className="font-semibold text-gray-900">{missionary.name}</div>
              <div className="text-sm text-gray-600">{missionary.country || "국가 미지정"}</div>
              <button
                className="mt-2 w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1.5 text-white text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(missionary);
                  router.push(`/viewer/${missionary.folderId}`);
                }}
              >
                기도편지 보기
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
