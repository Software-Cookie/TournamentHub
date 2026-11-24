export function PageHero({ eyebrow, title, children, compact }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode; compact?: boolean }) {
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="court-pattern absolute inset-0 opacity-50" aria-hidden />
      <div className="glow-brand absolute inset-0" aria-hidden />
      <div className="glow-accent absolute inset-0 opacity-70" aria-hidden />
      <div className={`relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${compact ? "pb-10 pt-28" : "pb-14 pt-32"}`}>
        {eyebrow && <p className="eyebrow text-accent">{eyebrow}</p>}
        <h1 className="display mt-2 text-5xl italic sm:text-6xl">{title}</h1>
        {children && <div className="mt-4 max-w-2xl text-white/70">{children}</div>}
      </div>
    </section>
  );
}
