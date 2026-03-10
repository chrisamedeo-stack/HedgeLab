import Image from "next/image";

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-main text-primary">
      <header className="flex items-center gap-3 pt-10 pb-6">
        <Image src="/hedgelab-icon.png" alt="HedgeLab" width={36} height={36} />
        <span className="text-xl font-semibold tracking-tight">HedgeLab</span>
      </header>
      <main className="w-full max-w-4xl px-6 pb-12">
        {children}
      </main>
    </div>
  );
}
