"use client";

/**
 * Layered ambient canvas: base radial gradient, floating accent blobs,
 * noise + technical grid. Fixed behind all content; pointer-events none.
 */
export function AmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% -20%, #0a0a0f 0%, #050506 45%, #020203 100%)",
        }}
      />

      <div
        className="motion-reduce:hidden absolute left-1/2 top-0 h-[900px] w-[1400px] -translate-x-1/2 rounded-full bg-accent/25 blur-[150px] animate-float"
        style={{ willChange: "transform" }}
      />
      <div
        className="motion-reduce:hidden absolute -left-32 top-1/4 h-[800px] w-[600px] rounded-full bg-purple-500/15 blur-[120px] animate-float-slow"
        style={{ willChange: "transform" }}
      />
      <div
        className="motion-reduce:hidden absolute -right-20 bottom-1/4 h-[700px] w-[500px] rounded-full bg-indigo-600/12 blur-[100px] animate-float-delay"
        style={{ willChange: "transform" }}
      />
      <div
        className="motion-reduce:hidden absolute bottom-0 left-1/3 h-[400px] w-[80%] -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]"
        style={{ willChange: "transform" }}
      />

      <div className="ds-noise pointer-events-none absolute inset-0" />
      <div className="ds-grid pointer-events-none absolute inset-0" />
    </div>
  );
}
