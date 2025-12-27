import { Scale } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ size = "md", showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: "h-8 w-8", text: "text-lg", sub: "text-[8px]" },
    md: { icon: "h-11 w-11", text: "text-xl", sub: "text-[10px]" },
    lg: { icon: "h-14 w-14", text: "text-2xl", sub: "text-xs" },
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`${sizes[size].icon} rounded-lg bg-primary/10 p-1.5 flex items-center justify-center`}>
        <Scale className="h-full w-full text-primary" />
      </div>
      {showText && (
        <div>
          <p className={`font-serif font-bold text-primary ${sizes[size].text}`}>
            CaseBuddy
          </p>
          <p className={`uppercase tracking-[0.3em] text-muted-foreground ${sizes[size].sub}`}>
            Legal AI OS
          </p>
        </div>
      )}
    </div>
  );
}