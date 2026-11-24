export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <div className="[&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_p]:leading-relaxed [&_p]:text-muted [&_ul]:mb-3 [&_ul]:space-y-1 [&_ul]:text-muted">{children}</div>;
}
