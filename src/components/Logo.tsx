export function Logo({
  className = "h-10",
  showText = true,
  textClassName = "",
}: {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}) {
  return (
    <span
      aria-label="Viral Hub"
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        minWidth: showText ? "150px" : "40px",
        minHeight: "40px",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          display: "flex",
          width: "40px",
          height: "40px",
          minWidth: "40px",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: "12px",
          border: "1px solid rgba(59, 130, 246, 0.55)",
          background: "#050b18",
          boxShadow: "0 0 22px rgba(59, 130, 246, 0.35)",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: "5px",
            borderRadius: "999px",
            border: "1px solid rgba(59, 130, 246, 0.48)",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "5px",
            width: "1px",
            height: "30px",
            transform: "translateX(-50%)",
            background: "rgba(59, 130, 246, 0.45)",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: "5px",
            top: "50%",
            width: "30px",
            height: "1px",
            transform: "translateY(-50%)",
            background: "rgba(59, 130, 246, 0.35)",
          }}
        />
        <span
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            fontSize: "18px",
            fontWeight: 950,
            letterSpacing: "-0.08em",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <span style={{ color: "#2563eb" }}>V</span>
          <span style={{ marginLeft: "-2px", color: "#ffffff" }}>H</span>
        </span>
      </span>
      {showText && (
        <span
          className={textClassName}
          style={{
            color: "#ffffff",
            fontWeight: 950,
            whiteSpace: "nowrap",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          VIRAL <span style={{ color: "#3b82f6" }}>HUB</span>
        </span>
      )}
    </span>
  );
}
