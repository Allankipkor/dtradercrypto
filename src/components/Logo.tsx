import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md";
}

export function Logo({ size = "md" }: LogoProps) {
  const iconSize = size === "sm" ? "w-7.5 h-7.5" : "w-8.5 h-8.5";
  const textSize = size === "sm" ? "text-sm" : "text-[18px]";

  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className={`${iconSize} rounded-xl bg-gradient-to-tr from-[#6D28D9] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/20 shrink-0`}>
        <svg className="w-[55%] h-[55%] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12V4a8 8 0 0 1 8 8v8a8 8 0 0 1-8-8z" />
          <path d="M12 12a4 4 0 0 1 4-4h4" />
          <path d="M12 12a4 4 0 0 0 4 4h4" />
        </svg>
      </div>
      <span className={`${textSize} font-extrabold text-white tracking-tight`}>
        DTraderCrypto
      </span>
    </Link>
  );
}
