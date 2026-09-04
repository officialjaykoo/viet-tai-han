"use client";

import { useEffect, useState } from "react";

const SCROLL_DIRECTION_THRESHOLD = 8;
const TOP_OFFSET = 12;

/** Show chrome at the top and when scrolling up; hide it while scrolling down. */
export function useScrollVisibility(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let frameId: number | null = null;

    function updateVisibility() {
      frameId = null;
      const currentScrollY = Math.max(0, window.scrollY);

      if (currentScrollY <= TOP_OFFSET) {
        lastScrollY = currentScrollY;
        setVisible(true);
        return;
      }

      if (
        Math.abs(currentScrollY - lastScrollY) < SCROLL_DIRECTION_THRESHOLD
      ) {
        return;
      }

      setVisible(currentScrollY < lastScrollY);
      lastScrollY = currentScrollY;
    }

    function handleScroll() {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateVisibility);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return visible;
}
