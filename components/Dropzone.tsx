"use client";

import { useState } from "react";

interface Props {
  onFile: (file: File | undefined) => void;
  title?: string;
  hint?: string;
}

/**
 * File picker: click or drag-and-drop an image.
 *
 * Implemented as a native <label> wrapping the file input so a click opens the
 * dialog with zero JS — this avoids the re-entrant `.click()` bug where a
 * programmatic click on a nested input bubbles back to the container and
 * re-fires, which real browsers suppress (the dialog never opens). See
 * tasks/lessons.md. The input is visually hidden but still focusable for
 * keyboard users.
 */
export default function Dropzone({
  onFile,
  title = "Tap to choose a photo",
  hint = "Use a picture taken in good, even light for the truest colors.",
}: Props) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={`dropzone${dragging ? " drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFile(e.dataTransfer.files[0]);
      }}
    >
      <p>
        <strong>{title}</strong> or drag one here.
      </p>
      <p style={{ fontSize: "0.85rem" }}>{hint}</p>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          // Allow re-selecting the same file later.
          e.target.value = "";
        }}
      />
    </label>
  );
}
