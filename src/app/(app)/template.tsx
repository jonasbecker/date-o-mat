// A template (unlike the layout) mounts anew on every navigation: each screen fades in
// softly instead of popping up. Only opacity and transform move (GPU).
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in flex min-h-0 flex-1 flex-col">{children}</div>;
}
