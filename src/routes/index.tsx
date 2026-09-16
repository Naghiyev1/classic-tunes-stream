import { createFileRoute } from "@tanstack/react-router";
import WinampPlayer from "@/components/winamp/WinampPlayer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Retro Radio Amp — Classic Skin Worldwide Radio Player" },
      {
        name: "description",
        content:
          "A classic late-90s skinned music player that streams thousands of free live radio stations from any country. No account, no cost.",
      },
      { property: "og:title", content: "Retro Radio Amp — Worldwide Live Radio" },
      {
        property: "og:description",
        content:
          "Pick a country, hit play, and stream free live radio in a nostalgic classic-skin player.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-3 py-8"
      style={{ background: "var(--wa-desk)" }}
    >
      <WinampPlayer />
      <p className="font-ui text-[11px] text-wa-chrome-edge">
        Live stations courtesy of the community-run radio-browser directory.
      </p>
    </main>
  );
}
