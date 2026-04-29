import logoImage2 from "../../assets/brand-logo-image2.png";
import { cn } from "../../lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-amber-300/35 bg-[#10241d] shadow-lg shadow-emerald-950/40">
          <img
            src={logoImage2}
            alt=""
            aria-hidden="true"
            className="h-full max-w-none object-cover"
            style={{ width: "290%", objectPosition: "left center" }}
          />
        </span>
        <span className="whitespace-nowrap text-xl font-black tracking-normal text-white">打朋友</span>
      </span>
    );
  }

  return (
    <img
      src={logoImage2}
      alt="打朋友"
      className={cn("h-auto w-full max-w-[760px] select-none", className)}
      draggable={false}
    />
  );
}
