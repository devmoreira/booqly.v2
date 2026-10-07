import Image from "next/image";

export function Logo({ className = "", nome: nomeFixo }: { className?: string; nome?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center ${className}`}
      aria-label={nomeFixo ?? "Booqly"}
      title={nomeFixo ?? "Booqly"}
    >
      <Image
        src="/booqly-logo.png"
        alt={nomeFixo ?? "Booqly"}
        width={155}
        height={48}
        priority
        className="booqly-logo-original h-8 w-auto object-contain sm:h-9"
      />
      <Image
        src="/booqly-logo-light.png"
        alt={nomeFixo ?? "Booqly"}
        width={155}
        height={48}
        priority
        className="booqly-logo-light h-8 w-auto object-contain sm:h-9"
      />
    </span>
  );
}
