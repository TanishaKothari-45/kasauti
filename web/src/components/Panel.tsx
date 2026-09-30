export function Panel({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-rule bg-surface p-5 ${className}`}>
      <header className="mb-4 flex flex-col gap-0.5">
        {eyebrow && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            {eyebrow}
          </span>
        )}
        <h2 className="text-base font-semibold text-balance">{title}</h2>
      </header>
      {children}
    </section>
  );
}
