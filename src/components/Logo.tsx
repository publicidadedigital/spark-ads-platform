import { useState } from "react";
import { viralHubLogo } from "@/assets/viral-hub-logo";

export function Logo({
  className = "h-12 w-auto max-w-[180px]",
  showText = false,
  textClassName = "",
}: {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <span className="inline-flex min-h-10 min-w-[128px] shrink-0 items-center leading-none">
      {!imageFailed && (
        <img
          src={viralHubLogo}
          alt="Viral Hub"
          className={`${className} block min-h-10 min-w-[128px] max-h-16 object-contain object-left`}
          onError={() => setImageFailed(true)}
        />
      )}
      {(showText || imageFailed) && (
        <span className={`${imageFailed ? "" : "ml-2"} font-bold tracking-tight whitespace-nowrap ${textClassName}`}>
          VIRAL <span className="text-primary">HUB</span>
        </span>
      )}
    </span>
  );
}
