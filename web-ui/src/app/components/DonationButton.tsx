import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { HeartHandshake, X } from "lucide-react";
import donationQr from "../../assets/donation-wechat.jpg";
import { cn } from "../../lib/utils";

type DonationButtonProps = {
  className?: string;
  compact?: boolean;
};

export function DonationButton({ className, compact = false }: DonationButtonProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-amber-300/25 bg-amber-300/10 font-black text-amber-100 transition hover:border-amber-200/40 hover:bg-amber-300/18 hover:text-white",
          compact ? "px-3 py-2 text-sm" : "min-w-[132px] px-6 py-3",
          className,
        )}
      >
        <HeartHandshake className="h-4 w-4 text-amber-300" />
        打赏作者
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[2147483647] flex min-h-[100dvh] items-center justify-center overflow-y-auto overscroll-contain bg-black/70 px-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={{
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingTop: "max(1rem, env(safe-area-inset-top))",
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="relative my-auto flex w-full max-w-sm flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#101816] p-4 text-center shadow-2xl shadow-black/50 sm:p-5"
            style={{ maxHeight: "calc(100dvh - 2rem)" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg border border-white/10 bg-black/45 p-2 text-white/70 backdrop-blur hover:bg-white/10 hover:text-white"
              aria-label="关闭打赏弹窗"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto mb-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-300/12 text-amber-200 sm:mb-4 sm:h-12 sm:w-12">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <h2 id={titleId} className="text-xl font-black text-white sm:text-2xl">
              打赏作者
            </h2>
            <p className="mt-2 text-sm font-bold text-amber-100/75">您的支持是我最大的动力！</p>
            <div className="mt-4 min-h-0 rounded-2xl border border-white/10 bg-white p-2 sm:mt-5 sm:p-3">
              <img
                src={donationQr}
                alt="微信支付收款码"
                className="mx-auto max-w-full rounded-xl object-contain"
                style={{ maxHeight: "min(46dvh, 420px)" }}
              />
            </div>
            <p className="mt-4 text-sm font-black text-amber-100">您的支持是对我最大的鼓励！</p>
            <p className="mt-1 text-xs text-white/45">推荐使用微信支付扫码支持</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
