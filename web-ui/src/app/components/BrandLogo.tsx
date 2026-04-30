import logoMark from "../../assets/brand-logo-mark.png";
import logoWordmark from "../../assets/brand-logo-wordmark.png";
import { cn } from "../../lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  if (compact) {
    return (
      <span className={cn("inline-flex h-10 items-center gap-2.5 leading-none", className)}>
        <img src={logoMark} alt="" aria-hidden="true" className="h-9 w-9 shrink-0 object-contain" draggable={false} />
        <span className="translate-y-[1px] whitespace-nowrap text-xl font-black tracking-normal text-white">打朋友</span>
      </span>
    );
  }

  return (
    <span className={cn("relative isolate inline-flex max-w-[760px] items-center", className)}>
      <span
        aria-hidden="true"
        className="absolute inset-x-[9%] inset-y-[18%] -z-10 rounded-full bg-[radial-gradient(circle,rgba(216,182,90,0.2),rgba(34,197,94,0.1)_48%,transparent_72%)] blur-3xl"
      />
      <img src={logoWordmark} alt="打朋友" className="h-auto w-full select-none object-contain" draggable={false} />
    </span>
  );
}
