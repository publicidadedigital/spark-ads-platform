import logo from "@/assets/viralink-symbol.jpeg";

export function Logo({ className = "h-7 w-7", showText = true, textClassName = "" }: { className?: string; showText?: boolean; textClassName?: string }) {
  return (
    <span className="flex items-center gap-2">
      <img
        src={logo}
        alt="Viralink"
        className={`${className} object-contain rounded-md`}
        style={{ mixBlendMode: "screen" }}
      />
      {showText && (
        <span className={`font-bold tracking-tight ${textClassName}`}>
          VIRA<span className="text-primary">LINK</span>
        </span>
      )}
    </span>
  );
}
