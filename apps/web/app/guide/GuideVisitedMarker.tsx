"use client";

import { useEffect } from "react";

const GUIDE_STORAGE_KEY = "showring.beginnerGuide.visited";

export default function GuideVisitedMarker() {
  useEffect(() => {
    window.localStorage.setItem(GUIDE_STORAGE_KEY, "true");
  }, []);

  return null;
}
