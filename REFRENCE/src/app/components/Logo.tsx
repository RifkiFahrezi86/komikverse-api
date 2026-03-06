interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export default function Logo({ size = "md", showText = true }: LogoProps) {
  const dims = { sm: 32, md: 36, lg: 44 };
  const textSize = { sm: "16px", md: "19px", lg: "24px" };
  const s = dims[size];

  return (
    <div className="flex items-center" style={{ gap: size === "lg" ? "12px" : "10px" }}>
      {/* Icon Mark */}
      <div
        className="relative shrink-0"
        style={{ width: s, height: s }}
      >
        {/* Glow */}
        <div
          className="absolute inset-0 rounded-xl blur-md opacity-40"
          style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)" }}
        />
        {/* Main shape */}
        <div
          className="relative w-full h-full rounded-xl flex items-center justify-center overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0e7490, #06b6d4)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.15), 0 2px 8px rgba(6,182,212,0.3)",
          }}
        >
          {/* Subtle inner pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              background: "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)",
            }}
          />
          {/* SVG Icon: modern code brackets with terminal cursor */}
          <svg
            width={s * 0.55}
            height={s * 0.55}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Left bracket */}
            <path
              d="M8 4L3 12L8 20"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Right bracket */}
            <path
              d="M16 4L21 12L16 20"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Center slash */}
            <path
              d="M14 4L10 20"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Text */}
      {showText && (
        <div className="flex items-baseline" style={{ gap: "1px" }}>
          <span
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              fontSize: textSize[size],
              color: "#f1f5f9",
              letterSpacing: "-0.02em",
            }}
          >
            Code
          </span>
          <span
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              fontSize: textSize[size],
              background: "linear-gradient(135deg, #06b6d4, #22d3ee)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            Help
          </span>
        </div>
      )}
    </div>
  );
}
