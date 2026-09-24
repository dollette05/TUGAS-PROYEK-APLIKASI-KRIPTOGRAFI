/* =====================================================================
   PARTICLES.JS — Interactive Background Particle Network
   Bespoke, high-performance ambient particle canvas with light/dark theme
   awareness, mouse interaction, and reduced-motion support.
   ===================================================================== */

(function () {
  "use strict";

  // Check if reduced motion is preferred
  const prefersReducedMotion = window.matchMedia("(prefers-color-scheme: reduce)").matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let canvas, ctx;
  let width, height;
  let particles = [];
  let animationFrameId = null;
  let mouse = { x: null, y: null, radius: 140 };

  // Theme color configs
  function getThemeColors() {
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    if (isDark) {
      return {
        particleColors: [
          "rgba(56, 189, 248, ",   // Cyan glowing
          "rgba(168, 85, 247, ",   // Purple accent
          "rgba(34, 211, 238, "    // Bright cyan
        ],
        lineColor: "56, 189, 248",
        maxLineAlpha: 0.18,
        bgGlow: "rgba(19, 28, 49, 0.4)"
      };
    } else {
      return {
        particleColors: [
          "rgba(37, 99, 235, ",    // Cobalt blue
          "rgba(2, 132, 199, ",    // Sky blue
          "rgba(124, 58, 237, "    // Subtle violet
        ],
        lineColor: "37, 99, 235",
        maxLineAlpha: 0.12,
        bgGlow: "rgba(226, 232, 240, 0.4)"
      };
    }
  }

  let themeColors = getThemeColors();

  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.radius = Math.random() * 2 + 1.2;
      this.vx = (Math.random() - 0.5) * 0.45;
      this.vy = (Math.random() - 0.5) * 0.45;
      this.baseAlpha = Math.random() * 0.4 + 0.25;
      this.alpha = this.baseAlpha;
      const colors = themeColors.particleColors;
      this.colorPrefix = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      if (prefersReducedMotion) return;

      this.x += this.vx;
      this.y += this.vy;

      // Bounce off screen boundaries
      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      // Mouse repulsion / float effect
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          this.x -= Math.cos(angle) * force * 1.5;
          this.y -= Math.sin(angle) * force * 1.5;
        }
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.colorPrefix + this.alpha + ")";
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.colorPrefix + "0.6)";
      ctx.fill();
      ctx.shadowBlur = 0; // Reset shadow for efficiency
    }
  }

  function initCanvas() {
    canvas = document.getElementById("bgCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "bgCanvas";
      canvas.className = "bg-canvas";
      document.body.prepend(canvas);
    }
    ctx = canvas.getContext("2d");
    resize();
    createParticles();
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    // Calculate density based on screen resolution
    const count = Math.min(Math.floor((width * height) / 18000), 65);
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }
  }

  function connectParticles() {
    const maxDist = 135;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * themeColors.maxLineAlpha;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${themeColors.lineColor}, ${alpha})`;
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    connectParticles();

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }

    if (!prefersReducedMotion) {
      animationFrameId = requestAnimationFrame(render);
    }
  }

  function updateTheme() {
    themeColors = getThemeColors();
    createParticles();
    if (prefersReducedMotion) {
      render();
    }
  }

  // Event Listeners
  window.addEventListener("resize", () => {
    resize();
    createParticles();
    if (prefersReducedMotion) render();
  });

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });

  // Observe theme attribute changes on <html>
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "data-theme") {
        updateTheme();
      }
    });
  });

  document.addEventListener("DOMContentLoaded", () => {
    initCanvas();
    observer.observe(document.documentElement, { attributes: true });
    render();
  });
})();
