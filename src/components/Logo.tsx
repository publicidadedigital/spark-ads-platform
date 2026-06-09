import { viralHubLogo } from "@/assets/viral-hub-logo";

export function Logo({
  className = "h-11 w-auto max-w-[150px]",
  showText = false,
  textClassName = "",
}: {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}) {
  return (
    <span className="inline-flex items-center min-w-0 shrink-0 leading-none">
      <img
        src={viralHubLogo}
        alt="Viral Hub"
        className={`${className} max-h-14 object-contain`}
      />
      {showText && (
        <span className={`ml-2 font-bold tracking-tight whitespace-nowrap ${textClassName}`}>
          VIRAL <span className="text-primary">HUB</span>
        </span>
      )}
    </span>
  );
}
