"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface DraggableBottomSheetProps {
  children: React.ReactNode;
  initialSnap?: number;
  snapPoints?: number[];
}

const defaultSnapPoints = [0.34, 0.58, 0.86];

export function DraggableBottomSheet({
  children,
  initialSnap = 1,
  snapPoints = defaultSnapPoints,
}: DraggableBottomSheetProps) {
  const dragStateRef = useRef<{
    startY: number;
    startHeight: number;
    dragging: boolean;
  } | null>(null);

  const normalizedSnapPoints = useMemo(
    () => [...snapPoints].sort((a, b) => a - b),
    [snapPoints],
  );
  const safeInitialIndex = Math.min(initialSnap, normalizedSnapPoints.length - 1);
  const [snapIndex, setSnapIndex] = useState(safeInitialIndex);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const currentHeightVh =
    dragHeight ?? normalizedSnapPoints[snapIndex] * 100;

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const state = dragStateRef.current;
      if (!state?.dragging) {
        return;
      }

      const viewportHeight = window.innerHeight || 1;
      const deltaY = state.startY - event.clientY;
      const nextHeightPx = state.startHeight + deltaY;
      const minHeightPx = normalizedSnapPoints[0] * viewportHeight;
      const maxHeightPx =
        normalizedSnapPoints[normalizedSnapPoints.length - 1] * viewportHeight;
      const clampedHeightPx = Math.min(
        Math.max(nextHeightPx, minHeightPx),
        maxHeightPx,
      );

      setDragHeight((clampedHeightPx / viewportHeight) * 100);
    }

    function onPointerUp() {
      const state = dragStateRef.current;
      if (!state?.dragging) {
        return;
      }

      const viewportHeight = window.innerHeight || 1;
      const currentPx =
        ((dragHeight ?? normalizedSnapPoints[snapIndex] * 100) / 100) *
        viewportHeight;

      const nearestIndex = normalizedSnapPoints.reduce(
        (closestIndex, point, index) => {
          const pointPx = point * viewportHeight;
          const closestPx = normalizedSnapPoints[closestIndex] * viewportHeight;
          return Math.abs(pointPx - currentPx) < Math.abs(closestPx - currentPx)
            ? index
            : closestIndex;
        },
        snapIndex,
      );

      dragStateRef.current = null;
      setDragHeight(null);
      setSnapIndex(nearestIndex);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragHeight, normalizedSnapPoints, snapIndex]);

  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const viewportHeight = window.innerHeight || 1;
    dragStateRef.current = {
      startY: event.clientY,
      startHeight:
        ((dragHeight ?? normalizedSnapPoints[snapIndex] * 100) / 100) *
        viewportHeight,
      dragging: true,
    };
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[550]">
      <section
        className="pointer-events-auto mx-auto flex max-w-md flex-col overflow-hidden rounded-t-[34px] border border-white/55 bg-white/90 shadow-[0_28px_70px_rgba(15,23,42,0.22)] backdrop-blur-xl transition-[height] duration-200 ease-out"
        style={{ height: `${currentHeightVh}dvh` }}
      >
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onPointerDown={startDrag}
            aria-label="Drag bottom sheet"
            className="flex h-7 w-24 items-center justify-center rounded-full"
          >
            <span className="h-1.5 w-14 rounded-full bg-slate-300/85" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-3">{children}</div>
      </section>
    </div>
  );
}
