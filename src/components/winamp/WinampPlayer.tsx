import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  countStationClick,
  fetchCountries,
  fetchStations,
  type RadioStation,
} from "@/lib/radio";

const EQ_BANDS = ["60", "170", "310", "600", "1K", "3K", "6K", "12K", "14K", "16K"];

const SKINS = [
  { id: "mac", name: "MAC METAL", swatch: ["#dedfe3", "#3a3f57", "#8fa8ff"] },
  { id: "classic", name: "CLASSIC GREEN", swatch: ["#3d4148", "#101a12", "#2ff45f"] },
  { id: "amber", name: "AMBER GLOW", swatch: ["#4c433a", "#20180f", "#ffb545"] },
  { id: "ice", name: "BLUE ICE", swatch: ["#e6eefb", "#2f5aa8", "#bfe4ff"] },
  { id: "plum", name: "NEON PLUM", swatch: ["#4b3550", "#1e1024", "#ff6bd6"] },
] as const;

type SkinId = (typeof SKINS)[number]["id"];


function formatTime(total: number) {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WinampPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [country, setCountry] = useState("US");
  const [current, setCurrent] = useState<RadioStation | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolume] = useState(80);
  const [balance, setBalance] = useState(50);
  const [eqOn, setEqOn] = useState(true);
  const [preamp, setPreamp] = useState(0);
  const [gains, setGains] = useState<number[]>(() => EQ_BANDS.map(() => 0));
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 19 }, () => 2));
  const [panel, setPanel] = useState<"equalizer" | "playlist" | "themes">("playlist");
  const [filter, setFilter] = useState("");
  const [skin, setSkin] = useState<SkinId>("mac");

  useEffect(() => {
    const saved = window.localStorage.getItem("wa-skin") as SkinId | null;
    if (saved && SKINS.some((s) => s.id === saved)) setSkin(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-skin", skin);
    window.localStorage.setItem("wa-skin", skin);
  }, [skin]);


  const countriesQuery = useQuery({ queryKey: ["radio-countries"], queryFn: fetchCountries });
  const stationsQuery = useQuery({
    queryKey: ["radio-stations", country],
    queryFn: () => fetchStations(country),
    enabled: Boolean(country),
  });

  const stations = stationsQuery.data ?? [];
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? stations.filter((s) => s.name.toLowerCase().includes(q)) : stations;
    return list.slice(0, 120);
  }, [stations, filter]);

  const play = useCallback((station: RadioStation) => {
    setCurrent(station);
    setFailed(false);
    setBuffering(true);
    setElapsed(0);
    countStationClick(station.stationuuid);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = station.url_resolved;
    audio.load();
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        setBuffering(false);
        setFailed(true);
      });
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (visible.length === 0) return;
      const idx = current ? visible.findIndex((s) => s.stationuuid === current.stationuuid) : -1;
      const next = visible[(idx + dir + visible.length) % visible.length];
      if (next) play(next);
    },
    [visible, current, play],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current) {
      const first = visible[0];
      if (first) play(first);
      return;
    }
    if (audio.paused) {
      setBuffering(true);
      void audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          setBuffering(false);
          setFailed(true);
        });
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [current, visible, play]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    setPlaying(false);
    setBuffering(false);
    setElapsed(0);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // Spectrum analyzer: stream CORS blocks real analysis, so animate the classic bars.
  useEffect(() => {
    if (!playing) {
      setBars(Array.from({ length: 19 }, () => 2));
      return;
    }
    const id = window.setInterval(() => {
      setBars((prev) =>
        prev.map((v, i) => {
          const ceiling = 16 - i * 0.4;
          const next = v + (Math.random() * 10 - 4.5);
          return Math.max(1, Math.min(ceiling, next));
        }),
      );
    }, 110);
    return () => window.clearInterval(id);
  }, [playing]);

  const title = current
    ? `${current.name.toUpperCase()} — ${(current.tags.split(",")[0] || current.country).toUpperCase()}`
    : "PICK A COUNTRY AND DOUBLE-CLICK A STATION";

  return (
    <div className="font-ui w-full max-w-[560px] select-none">
      <audio
        ref={audioRef}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => {
          setBuffering(false);
          setPlaying(true);
        }}
        onError={() => {
          setBuffering(false);
          setPlaying(false);
          setFailed(true);
        }}
      />

      {/* ── Main window ─────────────────────────────── */}
      <section className="wa-panel p-[3px]">
        {/* title bar */}
        <div
          className="flex h-6 items-center gap-2 rounded-t-[3px] px-1.5"
          style={{ background: "var(--wa-titlebar)" }}
        >
          <span className="grid h-4 w-4 place-items-center rounded-[2px] bg-wa-chrome text-[9px] font-bold text-wa-titlebar">
            ~
          </span>
          <span className="h-[3px] flex-1 rounded-full bg-wa-chrome/60" />
          <h1 className="text-[13px] font-bold tracking-[0.22em] text-wa-chrome-hi">WINAMP</h1>
          <span className="h-[3px] flex-1 rounded-full bg-wa-chrome/60" />
          <div className="flex gap-[3px]">
            {["–", "□", "✕"].map((g) => (
              <span
                key={g}
                className="grid h-3.5 w-3.5 place-items-center rounded-[2px] bg-wa-chrome text-[8px] leading-none text-wa-titlebar"
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* menu bar */}
        <nav className="flex gap-4 px-3 py-1 text-[13px] font-semibold text-wa-chrome-edge">
          {["File", "Play", "Options", "View", "Help"].map((m) => (
            <span key={m} className="underline decoration-1 underline-offset-2">
              {m}
            </span>
          ))}
        </nav>

        <div className="flex gap-1.5 px-1.5 pb-1.5">
          {/* LCD display */}
          <div className="wa-inset-panel min-w-0 flex-1 overflow-hidden p-2">
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <span className="mt-2 text-[10px] text-wa-lcd-ink">{playing ? "▶" : "❚❚"}</span>
              <span className="font-lcd text-[34px] leading-[0.85] text-wa-lcd-ink sm:text-[42px]">
                {formatTime(elapsed)}
              </span>
              <div className="mt-1 flex min-w-0 flex-col gap-1 text-[9px] font-bold text-wa-lcd-ink">
                <div className="flex items-center gap-1">
                  <span>KBPS</span>
                  <span className="rounded-[2px] bg-wa-lcd-ink px-1 text-wa-lcd-deep">
                    {current?.bitrate || "--"}
                  </span>
                  <span>KHZ</span>
                  <span className="rounded-[2px] bg-wa-lcd-ink px-1 text-wa-lcd-deep">44</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="rounded-[2px] bg-wa-lcd-ink px-1 text-wa-lcd-deep">
                    {(current?.codec || "STEREO").toUpperCase()}
                  </span>
                  <span className="text-wa-lcd-dim">↻</span>
                </div>
              </div>
              {/* analyzer */}
              <div className="ml-auto hidden h-[38px] items-end gap-[2px] xs:flex">
                {bars.map((h, i) => (
                  <span
                    key={i}
                    className="w-[3px] bg-wa-lcd-ink transition-[height] duration-100"
                    style={{ height: `${(h / 18) * 100}%`, opacity: 0.55 + (h / 18) * 0.45 }}
                  />
                ))}
              </div>
            </div>

            {/* scrolling title */}
            <div className="mt-1.5 w-full overflow-hidden border-t border-wa-lcd-ink/20 pt-1">
              <div className={`flex w-max gap-10 whitespace-nowrap ${playing ? "wa-marquee" : ""}`}>
                <span className="font-lcd text-[20px] leading-tight tracking-wide text-wa-lcd-ink sm:text-[26px]">
                  {failed ? "STREAM UNAVAILABLE — TRY ANOTHER STATION" : title}
                </span>
                <span className="font-lcd text-[20px] leading-tight tracking-wide text-wa-lcd-ink sm:text-[26px]">
                  {failed ? "STREAM UNAVAILABLE — TRY ANOTHER STATION" : title}
                </span>
              </div>
            </div>
          </div>


          {/* right rail */}
          <div className="flex w-[46px] flex-col items-center gap-1.5 pt-1">
            <button className="wa-pill h-5 w-[40px] text-[9px]" aria-label="Shade mode">
              ▼
            </button>
            <button
              onClick={() => setPanel("playlist")}
              className="wa-round h-7 w-7 text-[11px]"
              aria-label="Playlist panel"
            >
              PL
            </button>
            <button
              onClick={() => setPanel("equalizer")}
              className="wa-round h-7 w-7 text-[10px]"
              aria-label="Equalizer panel"
            >
              EQ
            </button>
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: playing ? "var(--wa-led)" : "var(--wa-chrome-lo)",
                boxShadow: playing ? "0 0 6px var(--wa-led)" : "none",
              }}
            />
          </div>
        </div>

        {/* seek / buffer bar */}
        <div className="px-2.5 pb-1">
          <div
            className="h-3 rounded-full"
            style={{ background: "var(--wa-groove)", boxShadow: "var(--wa-inset)" }}
          >
            <div
              className="h-3 rounded-full transition-[width] duration-500"
              style={{
                width: buffering ? "35%" : playing ? "100%" : "0%",
                background: "linear-gradient(180deg, var(--wa-led), var(--wa-titlebar))",
              }}
            />
          </div>
        </div>

        {/* transport */}
        <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
          <button onClick={() => step(-1)} className="wa-round h-9 w-9 text-[12px]" aria-label="Previous station">
            ◀◀
          </button>
          <button onClick={togglePlay} className="wa-round h-9 w-9 text-[13px] text-wa-titlebar" aria-label="Play">
            ▶
          </button>
          <button onClick={togglePlay} className="wa-round h-9 w-9 text-[11px]" aria-label="Pause">
            ❚❚
          </button>
          <button onClick={stop} className="wa-round h-9 w-9 text-[10px]" aria-label="Stop">
            ■
          </button>
          <button onClick={() => step(1)} className="wa-round h-9 w-9 text-[12px]" aria-label="Next station">
            ▶▶
          </button>

          <div className="wa-panel ml-1 flex flex-1 items-center gap-2 px-2 py-1.5">
            <span className="wa-round grid h-6 w-6 place-items-center text-[10px]">🔊</span>
            <input
              type="range"
              className="wa-slider h-3.5 flex-1"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
            />
            <span className="text-[10px] font-bold text-wa-chrome-edge">{volume}</span>
            <span className="text-wa-bolt text-[15px] leading-none">⚡</span>
          </div>
        </div>
      </section>

      {/* ── Bottom window: equalizer / playlist ─────── */}
      <section className="wa-panel mt-1.5 p-2">
        {panel === "equalizer" ? (
          <div className="flex gap-3">
            <div className="flex w-[130px] flex-col gap-2">
              <input
                type="range"
                className="wa-slider h-3.5 w-full"
                min={-12}
                max={12}
                value={balance - 50}
                onChange={(e) => setBalance(Number(e.target.value) + 50)}
                aria-label="Balance"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => setEqOn((v) => !v)}
                  className="wa-pill px-3 py-1 text-[11px] font-bold"
                >
                  {eqOn ? "ON" : "OFF"}
                </button>
                <button className="wa-pill px-3 py-1 text-[11px] font-bold">AUTO</button>
              </div>
              <button
                onClick={() => {
                  setGains(EQ_BANDS.map(() => 0));
                  setPreamp(0);
                }}
                className="wa-pill px-3 py-1 text-[11px] font-bold"
              >
                PRESETS
              </button>
              <p className="text-[10px] leading-snug text-wa-chrome-edge">
                Visual EQ — live radio streams are broadcast pre-mastered.
              </p>
            </div>

            <div className="wa-inset-panel flex flex-1 items-end gap-2 p-2"
              style={{ background: "var(--wa-metal)" }}
            >
              <div className="flex flex-col items-center gap-1">
                <input
                  type="range"
                  className="wa-slider-v h-[112px]"
                  min={-12}
                  max={12}
                  value={preamp}
                  onChange={(e) => setPreamp(Number(e.target.value))}
                  aria-label="Preamp"
                />
                <span className="text-[9px] font-bold text-wa-chrome-edge">PRE</span>
              </div>
              {EQ_BANDS.map((band, i) => (
                <div key={band} className="flex flex-1 flex-col items-center gap-1">
                  <input
                    type="range"
                    className="wa-slider-v h-[112px]"
                    min={-12}
                    max={12}
                    value={gains[i] ?? 0}
                    onChange={(e) =>
                      setGains((g) => g.map((v, j) => (j === i ? Number(e.target.value) : v)))
                    }
                    aria-label={`${band} Hz`}
                  />
                  <span className="text-[9px] font-bold text-wa-chrome-edge">{band}</span>
                </div>
              ))}
            </div>
          </div>
        ) : panel === "themes" ? (
          <div>
            <p className="mb-2 text-[11px] font-bold tracking-wider text-wa-chrome-edge">
              COLOR THEMES
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {SKINS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSkin(s.id)}
                  aria-pressed={skin === s.id}
                  className={`wa-pill flex items-center gap-2 px-2 py-1.5 text-[11px] font-bold tracking-wide ${
                    skin === s.id ? "brightness-110" : "brightness-95"
                  }`}
                >
                  <span className="flex shrink-0 overflow-hidden rounded-full border border-wa-chrome-edge">
                    {s.swatch.map((c) => (
                      <span key={c} className="h-4 w-2.5" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="truncate">{s.name}</span>
                  {skin === s.id && <span className="ml-auto shrink-0">●</span>}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-wa-chrome-edge">
              Your skin is remembered on this device.
            </p>
          </div>
        ) : (

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setFilter("");
                }}
                className="wa-pill max-w-[190px] flex-1 px-3 py-1 text-[12px] font-semibold"
                aria-label="Country"
              >
                {(countriesQuery.data ?? []).map((c) => (
                  <option key={c.iso_3166_1} value={c.iso_3166_1}>
                    {c.name} ({c.stationcount})
                  </option>
                ))}
              </select>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search stations"
                className="wa-pill flex-1 px-3 py-1 text-[12px] outline-none"
                aria-label="Search stations"
              />
            </div>

            <ul className="wa-inset-panel h-[210px] overflow-y-auto p-1.5 font-lcd text-[19px] leading-[1.35]">
              {stationsQuery.isPending && <li className="text-wa-lcd-dim">LOADING STATIONS…</li>}
              {stationsQuery.isError && (
                <li className="text-wa-lcd-dim">DIRECTORY UNREACHABLE — RETRY LATER</li>
              )}
              {!stationsQuery.isPending && visible.length === 0 && (
                <li className="text-wa-lcd-dim">NO SECURE STREAMS FOUND HERE</li>
              )}
              {visible.map((s, i) => {
                const active = current?.stationuuid === s.stationuuid;
                return (
                  <li key={s.stationuuid}>
                    <button
                      onClick={() => play(s)}
                      className={`flex w-full items-baseline gap-2 truncate px-1 text-left ${
                        active
                          ? "bg-wa-lcd-ink/20 text-wa-lcd-ink"
                          : "text-wa-lcd-ink/85 hover:bg-wa-lcd-ink/10"
                      }`}
                    >
                      <span className="w-6 shrink-0 text-wa-lcd-dim">{i + 1}.</span>
                      <span className="truncate">{s.name}</span>
                      <span className="ml-auto shrink-0 text-wa-lcd-dim">{s.bitrate}k</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-2 flex gap-1">
          <button
            onClick={() => setPanel("equalizer")}
            className={`wa-tab flex-1 rounded-t-md px-2 py-1 text-[11px] font-bold tracking-wider ${
              panel === "equalizer" ? "brightness-105" : "brightness-95"
            }`}
          >
            EQUALIZER
          </button>
          <button
            onClick={() => setPanel("playlist")}
            className={`wa-tab flex-1 rounded-t-md px-2 py-1 text-[11px] font-bold tracking-wider ${
              panel === "playlist" ? "brightness-105" : "brightness-95"
            }`}
          >
            PLAYLIST
          </button>
          <span className="wa-tab rounded-t-md px-2 py-1 text-[11px] font-bold tracking-wider">
            COLOR THEMES
          </span>
        </div>
      </section>
    </div>
  );
}
