"use client";

import "leaflet-defaulticon-compatibility";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

// N 버튼 및 좌측 하단 컨트롤 제거 컴포넌트 (강화 버전)
function RemoveControls() {
  const map = useMap();

  useEffect(() => {
    // 지도가 로드된 후 좌측 하단의 모든 컨트롤 제거
    const removeControls = () => {
      // 방법 1: 좌측 하단 전체 컨테이너 제거
      const bottomLeft = document.querySelector('.leaflet-bottom-left');
      if (bottomLeft) {
        (bottomLeft as HTMLElement).style.display = 'none';
        bottomLeft.remove();
      }

      // 방법 2: 모든 Leaflet 컨트롤에서 N 버튼 찾아서 제거
      const allControls = document.querySelectorAll('.leaflet-control');
      allControls.forEach((control) => {
        const buttons = control.querySelectorAll('button, a, div');
        buttons.forEach((element) => {
          const text = (element.textContent || '').trim();
          const title = element.getAttribute('title') || '';
          const ariaLabel = element.getAttribute('aria-label') || '';
          const className = element.className || '';
          
          // N, North, 북쪽 등이 포함된 경우 제거
          if (
            text === 'N' ||
            text.includes('North') ||
            text.includes('north') ||
            text.includes('북') ||
            title.includes('North') ||
            title.includes('N') ||
            ariaLabel.includes('North') ||
            ariaLabel.includes('N') ||
            className.includes('compass') ||
            className.includes('north')
          ) {
            const parentControl = element.closest('.leaflet-control');
            if (parentControl) {
              (parentControl as HTMLElement).style.display = 'none';
              parentControl.remove();
            } else {
              (element as HTMLElement).style.display = 'none';
              element.remove();
            }
          }
        });
      });

      // 방법 3: 좌측 하단에 있는 모든 요소 제거
      const mapContainer = map.getContainer();
      if (mapContainer) {
        const allElements = mapContainer.querySelectorAll('*');
        allElements.forEach((el) => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          const mapRect = mapContainer.getBoundingClientRect();
          
          // 좌측 하단 영역에 있는 요소 확인
          if (
            rect.left < mapRect.left + 100 && // 좌측 100px 이내
            rect.bottom > mapRect.bottom - 100 && // 하단 100px 이내
            (el.textContent?.trim() === 'N' || 
             el.textContent?.includes('North') ||
             el.getAttribute('title')?.includes('N'))
          ) {
            (el as HTMLElement).style.display = 'none';
            el.remove();
          }
        });
      }
    };

    // 지도가 완전히 로드된 후 실행
    map.whenReady(() => {
      removeControls();
      // 여러 시점에서 재시도 (동적으로 추가될 수 있음)
      setTimeout(removeControls, 100);
      setTimeout(removeControls, 500);
      setTimeout(removeControls, 1000);
      setTimeout(removeControls, 2000);
    });

    // MutationObserver로 동적으로 추가되는 요소 감지 및 제거
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const text = element.textContent || '';
            const title = element.getAttribute('title') || '';
            
            if (
              text.trim() === 'N' ||
              text.includes('North') ||
              title.includes('North') ||
              title.includes('N') ||
              element.classList.contains('leaflet-bottom-left')
            ) {
              element.style.display = 'none';
              element.remove();
            }
            
            // 하위 요소도 확인
            const buttons = element.querySelectorAll('button, a, div');
            buttons.forEach((btn) => {
              const btnText = btn.textContent || '';
              if (btnText.trim() === 'N' || btnText.includes('North')) {
                const parent = btn.closest('.leaflet-control');
                if (parent) {
                  (parent as HTMLElement).style.display = 'none';
                  parent.remove();
                }
              }
            });
          }
        });
      });
      removeControls();
    });

    // 지도 컨테이너 감시 시작
    const mapContainer = map.getContainer();
    if (mapContainer) {
      observer.observe(mapContainer, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [map]);

  return null;
}

// 지도 bounds를 자동으로 맞추는 컴포넌트
function MapBoundsFitter({ items }: { items: MissionaryItem[] }) {
  const map = useMap();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (items.length === 0 || !isMobile) return;

    // 모든 마커의 좌표로 bounds 생성
    const bounds = L.latLngBounds(
      items.map(item => [item.lat, item.lng] as [number, number])
    );

    // bounds의 중심점 계산
    const center = bounds.getCenter();
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();

    // 중심점으로부터의 거리 계산
    const latDiff = northEast.lat - southWest.lat;
    const lngDiff = northEast.lng - southWest.lng;

    // 15% 확대 = bounds를 15% 축소 (각 모서리를 중심점으로부터 15% 가까이 이동)
    const shrinkFactor = 0.85; // 15% 축소 = 15% 확대 효과

    // 축소된 bounds 생성
    const shrunkBounds = L.latLngBounds([
      [center.lat - latDiff * shrinkFactor / 2, center.lng - lngDiff * shrinkFactor / 2],
      [center.lat + latDiff * shrinkFactor / 2, center.lng + lngDiff * shrinkFactor / 2]
    ]);

    // 축소된 bounds로 지도 조정 (15% 확대 효과)
    map.fitBounds(shrunkBounds, {
      padding: [30, 30], // 픽셀 단위 패딩
      maxZoom: 10, // 최대 줌 제한
    });
  }, [items, map, isMobile]);

  return null;
}

export default function WorldMap({
  items,
  onSelect,
}: {
  items: MissionaryItem[];
  onSelect: (m: MissionaryItem) => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 초기 중심점과 줌 레벨 계산
  const initialCenter = useMemo(() => {
    if (items.length === 0) return [20, 0] as [number, number];

    // 모든 마커의 중심점 계산
    const avgLat = items.reduce((sum, item) => sum + item.lat, 0) / items.length;
    const avgLng = items.reduce((sum, item) => sum + item.lng, 0) / items.length;

    return [avgLat, avgLng] as [number, number];
  }, [items]);

  const initialZoom = useMemo(() => {
    return 2;
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* N 버튼 및 좌측 하단 컨트롤 제거 */}
      <RemoveControls />

      {/* 모바일에서 bounds 자동 맞추기 */}
      <MapBoundsFitter items={items} />

      {items.map((m) => (
        <Marker key={m.folderId} position={[m.lat, m.lng]}>
          <Popup className="custom-popup">
            <div className="space-y-2 min-w-[150px]">
              <div className="font-semibold text-gray-900">{m.name}</div>
              <div className="text-sm text-gray-600">{m.country || "국가 미지정"}</div>
              <button
                className="mt-2 w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1.5 text-white text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/viewer/${m.folderId}`);
                }}
              >
                📖 기도편지 보기
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
