"use client";
import React, { useState, useRef, useEffect } from "react";
import { COLORS } from "../lib/theme";
import ChatOverlay from "./ChatOverlay";

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: null, y: null });
  const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0 });

  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("masarat_fab_pos");
    if (saved) {
      try {
        setPos(JSON.parse(saved));
      } catch (e) {}
    } else if (typeof window !== "undefined") {
      setPos({ x: window.innerWidth - 76, y: window.innerHeight - 140 });
    }
  }, []);

  function savePos(p) {
    setPos(p);
    try {
      localStorage.setItem("masarat_fab_pos", JSON.stringify(p));
    } catch (e) {}
  }

  function onPointerDown(e) {
    const point = e.touches ? e.touches[0] : e;
    dragRef.current = { dragging: true, moved: false, startX: point.clientX, startY: point.clientY, origX: pos.x, origY: pos.y };
  }
  function onPointerMove(e) {
    if (!dragRef.current.dragging) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - dragRef.current.startX;
    const dy = point.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragRef.current.moved = true;
    let nx = dragRef.current.origX + dx;
    let ny = dragRef.current.origY + dy;
    nx = Math.max(8, Math.min(window.innerWidth - 68, nx));
    ny = Math.max(8, Math.min(window.innerHeight - 68, ny));
    setPos({ x: nx, y: ny });
  }
  function onPointerUp() {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    savePos(pos);
    if (!dragRef.current.moved) setOpen(true);
  }

  if (pos.x === null) return null;

  return (
    <>
      <button
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={() => (dragRef.current.dragging = false)}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: COLORS.gradGold,
          border: "none",
          boxShadow: COLORS.shadowGold,
          fontSize: 26,
          cursor: "pointer",
          zIndex: 100,
          touchAction: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="محادثة مسارات"
      >
        💬
      </button>
      {open && <ChatOverlay onClose={() => setOpen(false)} />}
    </>
  );
}
