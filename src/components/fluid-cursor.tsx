"use client";

import { useEffect, useRef } from "react";

export function FluidCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorFollowerRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const cursor = cursorRef.current;
    const cursorFollower = cursorFollowerRef.current;
    
    if (!cursor || !cursorFollower) return;

    let mouseX = 0;
    let mouseY = 0;
    let followerX = 0;
    let followerY = 0;
    const trailPositions: Array<{ x: number; y: number }> = [];

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Update cursor position
      cursor.style.left = `${mouseX}px`;
      cursor.style.top = `${mouseY}px`;

      // Store trail positions
      trailPositions.push({ x: mouseX, y: mouseY });
      if (trailPositions.length > 10) {
        trailPositions.shift();
      }
    };

    const animateFollower = () => {
      const dx = mouseX - followerX;
      const dy = mouseY - followerY;

      followerX += dx * 0.15;
      followerY += dy * 0.15;

      if (cursorFollower) {
        cursorFollower.style.left = `${followerX}px`;
        cursorFollower.style.top = `${followerY}px`;
      }

      // Update trail positions
      trailRefs.current.forEach((trail, index) => {
        if (trail && trailPositions.length > index) {
          const pos = trailPositions[trailPositions.length - 1 - index];
          if (pos) {
            trail.style.left = `${pos.x}px`;
            trail.style.top = `${pos.y}px`;
            trail.style.opacity = `${0.3 - index * 0.03}`;
          }
        }
      });

      requestAnimationFrame(animateFollower);
    };

    const handleMouseEnter = () => {
      cursor.style.opacity = "1";
      cursorFollower.style.opacity = "1";
      trailRefs.current.forEach(trail => {
        if (trail) trail.style.opacity = "0.3";
      });
    };

    const handleMouseLeave = () => {
      cursor.style.opacity = "0";
      cursorFollower.style.opacity = "0";
      trailRefs.current.forEach(trail => {
        if (trail) trail.style.opacity = "0";
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);
    
    animateFollower();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <>
      {/* Trail elements */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          ref={(el) => (trailRefs.current[i] = el)}
          className="fixed pointer-events-none z-[9997] w-2 h-2 rounded-full bg-primary/20 transition-opacity duration-300"
          style={{
            transform: "translate(-50%, -50%)",
            willChange: "transform",
            opacity: 0,
          }}
        />
      ))}
      
      {/* Fluid follower */}
      <div
        ref={cursorFollowerRef}
        className="fixed pointer-events-none z-[9998] w-12 h-12 rounded-full bg-primary/10 blur-md transition-opacity duration-300"
        style={{
          transform: "translate(-50%, -50%)",
          willChange: "transform",
        }}
      />
      
      {/* Main cursor pointer */}
      <div
        ref={cursorRef}
        className="fixed pointer-events-none z-[9999] transition-opacity duration-300"
        style={{
          transform: "translate(4px, 4px)",
          willChange: "transform",
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg"
        >
          <path
            d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
            fill="currentColor"
            className="text-primary"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
}

