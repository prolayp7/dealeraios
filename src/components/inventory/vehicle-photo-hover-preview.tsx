"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { getVehicleImages, getCoverImageIndex } from "@/lib/vehicle-images";
import { getVehicleLabel } from "@/lib/vehicle-logic";

const OPEN_DELAY_MS = 200;
const CLOSE_DELAY_MS = 150;
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 238;
const VIEWPORT_MARGIN = 8;
const GAP = 8;

interface PanelPosition {
  left: number;
  top: number;
}

export function computePanelPosition(rect: DOMRect): PanelPosition {
  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - PANEL_WIDTH / 2, VIEWPORT_MARGIN),
    window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN
  );

  const fitsAbove = rect.top >= PANEL_HEIGHT + GAP + VIEWPORT_MARGIN;
  const top = fitsAbove ? rect.top - PANEL_HEIGHT - GAP : rect.bottom + GAP;

  return { left, top };
}

interface UseVehiclePhotoHoverPreviewResult {
  triggerRef: RefObject<HTMLDivElement | null>;
  triggerHandlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  popover: ReactNode;
}

export function useVehiclePhotoHoverPreview(
  vehicle: Vehicle
): UseVehiclePhotoHoverPreviewResult {
  const images = getVehicleImages(vehicle);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  };

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleEnter = () => {
    if (images.length === 0) return;
    clearCloseTimer();
    clearOpenTimer();
    openTimer.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(computePanelPosition(rect));
      setActiveIndex(getCoverImageIndex(images, vehicle.image_url));
      setOpen(true);
    }, OPEN_DELAY_MS);
  };

  const handleLeave = () => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open]);

  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, []);

  const triggerHandlers = { onMouseEnter: handleEnter, onMouseLeave: handleLeave };

  if (!open || !position || images.length === 0) {
    return { triggerRef, triggerHandlers, popover: null };
  }

  const panel = (
    <div
      onMouseEnter={clearCloseTimer}
      onMouseLeave={handleLeave}
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        zIndex: 50,
      }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e14] shadow-[0_16px_48px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.06]"
    >
      <Image
        key={images[activeIndex]}
        src={images[activeIndex]}
        alt={getVehicleLabel(vehicle)}
        fill
        sizes={`${PANEL_WIDTH}px`}
        className="object-cover"
      />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveIndex((index) => (index - 1 + images.length) % images.length);
            }}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-black/70"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveIndex((index) => (index + 1) % images.length);
            }}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-black/70"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/10 backdrop-blur-md">
            <Camera className="h-3 w-3 opacity-80" />
            {activeIndex + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );

  return {
    triggerRef,
    triggerHandlers,
    popover: createPortal(panel, document.body),
  };
}
