"use client";

import { useState, useEffect } from "react";

type MatrixSize = "xs" | "sm" | "md" | "lg";

const BREAKPOINTS = {
  xs: 0,    // 0-399px: xs (20px cells = ~294px matrix)
  sm: 400,  // 400-639px: sm (24px cells = ~350px matrix)
  md: 640,  // 640px+: md (32px cells = ~470px matrix)
};

export function useResponsiveMatrixSize(): MatrixSize {
  const [size, setSize] = useState<MatrixSize>("md");

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      if (width < BREAKPOINTS.sm) {
        setSize("xs");
      } else if (width < BREAKPOINTS.md) {
        setSize("sm");
      } else {
        setSize("md");
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return size;
}
