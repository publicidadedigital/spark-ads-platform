import { viralHubLogo } from "@/assets/viral-hub-logo";

export function Logo({
  className = "h-9 w-auto max-w-[150px]",
  showText = true,
  textClassName = "",
}: {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <img
        src={viralHubLogo}
        alt="Viral Hub"
        className={`${className} object-contain`}
      />
      {showText && (
        <span className={`font-bold tracking-tight whitespace-nowrap ${textClassName}`}>
          VIRAL <span className="text-primary">HUB</span>
        </span>
      )}
    </span>
  );
}
