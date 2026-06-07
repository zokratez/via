"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMainTabs, openMainTabSearch } from "@/lib/navigation/main-tabs";

const EDGE_GUARD_PX = 28;
const MIN_DISTANCE_PX = 72;
const MAX_VERTICAL_DRIFT_PX = 80;
const MIN_VELOCITY_PX_PER_MS = 0.35;

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'a, button, input, textarea, select, [role="button"], [role="dialog"], [data-swipe-nav-ignore="true"]',
    ),
  );
}

export function SwipeNavClient() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    tracking: boolean;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setIsAuthenticated(Boolean(data.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      if (isInteractiveTarget(event.target)) return;

      const touch = event.touches[0];
      const width = window.innerWidth;
      if (
        touch.clientX <= EDGE_GUARD_PX ||
        touch.clientX >= width - EDGE_GUARD_PX
      ) {
        gestureRef.current = null;
        return;
      }

      gestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: event.timeStamp,
        tracking: true,
      };
    }

    function onTouchEnd(event: TouchEvent) {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (!gesture?.tracking) return;
      if (event.changedTouches.length !== 1) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      const elapsed = Math.max(1, event.timeStamp - gesture.startTime);
      const velocity = Math.abs(deltaX) / elapsed;
      const mostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.35;
      const enoughDistance = Math.abs(deltaX) >= MIN_DISTANCE_PX;
      const enoughVelocity = velocity >= MIN_VELOCITY_PX_PER_MS;

      if (
        !mostlyHorizontal ||
        Math.abs(deltaY) > MAX_VERTICAL_DRIFT_PX ||
        (!enoughDistance && !enoughVelocity)
      ) {
        return;
      }

      const tabs = getMainTabs(locale);
      const currentIndex = tabs.findIndex((tab) => tab.matches(pathname, locale));
      if (currentIndex < 0) return;

      const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextTab = tabs[nextIndex];
      if (!nextTab) return;

      if (nextTab.href) {
        router.push(nextTab.href);
        return;
      }

      openMainTabSearch();
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isAuthenticated, locale, pathname, router]);

  return null;
}
