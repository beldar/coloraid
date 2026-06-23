"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteImage,
  getImageUrl,
  readMeta,
  saveImage,
  type ImageMeta,
} from "@/lib/store/imageStore";

/**
 * The image gallery + the currently-open photo. Uploading auto-saves to the
 * local library (IndexedDB); past images can be reopened. Manages the object URL
 * lifecycle so we don't leak blobs.
 */
export function useImageLibrary() {
  const [items, setItems] = useState<ImageMeta[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    setItems(readMeta());
    setHydrated(true);
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const setUrl = useCallback((url: string | null, id: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setImageSrc(url);
    setCurrentId(id);
  }, []);

  const loadFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file || !file.type.startsWith("image/")) return;
      // Show it immediately, then persist in the background.
      setUrl(URL.createObjectURL(file), null);
      try {
        const meta = await saveImage(file);
        setItems(readMeta());
        setCurrentId(meta.id);
      } catch {
        /* if persistence fails the image still shows for this session */
      }
    },
    [setUrl],
  );

  const openId = useCallback(
    async (id: string) => {
      const url = await getImageUrl(id);
      if (url) setUrl(url, id);
    },
    [setUrl],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteImage(id);
      setItems(readMeta());
      if (currentId === id) setUrl(null, null);
    },
    [currentId, setUrl],
  );

  const reset = useCallback(() => setUrl(null, null), [setUrl]);

  return { items, hydrated, imageSrc, currentId, loadFile, openId, remove, reset };
}
