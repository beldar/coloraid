"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages an object URL for a user-chosen image file, revoking the previous one
 * to avoid leaks. Shared by the reader and the palette builder.
 */
export function useImageFile() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const current = useRef<string | null>(null);

  const setUrl = useCallback((url: string | null) => {
    if (current.current) URL.revokeObjectURL(current.current);
    current.current = url;
    setImageSrc(url);
  }, []);

  const loadFile = useCallback(
    (file: File | undefined | null) => {
      if (!file || !file.type.startsWith("image/")) return;
      setUrl(URL.createObjectURL(file));
    },
    [setUrl],
  );

  const reset = useCallback(() => setUrl(null), [setUrl]);

  // Revoke on unmount.
  useEffect(() => () => {
    if (current.current) URL.revokeObjectURL(current.current);
  }, []);

  return { imageSrc, loadFile, reset };
}
