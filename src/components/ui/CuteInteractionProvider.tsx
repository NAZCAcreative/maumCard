"use client";

import React, { useEffect, useState } from "react";

export function CuteInteractionProvider({ children }: { children: React.ReactNode }) {
  const [bubblesEnabled, setBubblesEnabled] = useState(true);
  const [springEnabled, setSpringEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.click_effect_bubbles_enabled === "boolean") {
          setBubblesEnabled(data.click_effect_bubbles_enabled);
        }
        if (typeof data.click_effect_spring_enabled === "boolean") {
          setSpringEnabled(data.click_effect_spring_enabled);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dataset.clickSpring = springEnabled ? "true" : "false";
  }, [springEnabled]);

  useEffect(() => {
    if (!bubblesEnabled) return;

    const handleGlobalClick = (event: MouseEvent) => {
      // Find closest interactive element
      const target = event.target as HTMLElement;
      const interactive = target.closest(
        "button, a, select, input[type='button'], input[type='submit'], [role='button'], .clickable, .cursor-pointer"
      );
      
      if (!interactive) return;

      // Click location
      const { clientX: x, clientY: y } = event;
      
      // Burst 8 particles
      const particleCount = 8;
      const symbols = ["🌸", "✨", "⭐", "💛", "💖", "🎈", "🍋", "🍊", "🍭", "🍇", "🍓"];
      
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement("span");
        
        // Random style and offset
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        particle.innerText = symbol;
        particle.className = "cute-particle";
        
        // Random angle and distance
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 80;
        const dx = `${Math.cos(angle) * distance}px`;
        const dy = `${Math.sin(angle) * distance}px`;
        const scaleEnd = (0.5 + Math.random() * 0.8).toFixed(2);
        
        particle.style.setProperty("--dx", dx);
        particle.style.setProperty("--dy", dy);
        particle.style.setProperty("--scale-end", scaleEnd);
        
        // Position at click coordinate
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.fontSize = `${16 + Math.random() * 12}px`;
        
        document.body.appendChild(particle);
        
        // Cleanup after animation finishes
        setTimeout(() => {
          particle.remove();
        }, 800);
      }
    };

    window.addEventListener("click", handleGlobalClick, { capture: true });
    return () => {
      window.removeEventListener("click", handleGlobalClick, { capture: true });
    };
  }, [bubblesEnabled]);

  return <>{children}</>;
}

export default CuteInteractionProvider;

