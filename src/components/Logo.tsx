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
      className={`inline-flex ${className} min-h-10 min-w-[150px] shrink-0 items-center gap-2 leading-none`}
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/45 bg-[#050b18] shadow-[0_0_22px_rgba(59,130,246,0.35)]">
        <span className="absolute inset-1 rounded-full border border-primary/45" />
        <span className="absolute left-1/2 top-1 h-8 w-px -translate-x-1/2 bg-primary/40" />
        <span className="absolute top-1/2 h-px w-8 -translate-y-1/2 bg-primary/30" />
        <span className="relative flex items-center text-[18px] font-black tracking-[-0.08em]">
          <span className="text-primary">V</span>
          <span className="-ml-0.5 text-white">H</span>
        </span>
      </span>
      {showText && (
        <span className={`font-black uppercase tracking-wide text-white whitespace-nowrap ${textClassName}`}>
          VIRAL <span className="text-primary">HUB</span>
        </span>
      )}
    </span>
  );
}
