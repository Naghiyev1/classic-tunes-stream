export interface RadioCountry {
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

export interface RadioStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  codec: string;
  bitrate: number;
  tags: string;
  country: string;
  homepage: string;
}

const API = "https://de1.api.radio-browser.info/json";

export async function fetchCountries(): Promise<RadioCountry[]> {
  const res = await fetch(`${API}/countries`);
  if (!res.ok) throw new Error("Could not load countries");
  const data = (await res.json()) as RadioCountry[];
  return data
    .filter((c) => c.iso_3166_1 && c.stationcount > 3 && c.name.trim().length > 1)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchStations(countryCode: string): Promise<RadioStation[]> {
  const res = await fetch(
    `${API}/stations/search?countrycode=${encodeURIComponent(countryCode)}` +
      `&limit=250&hidebroken=true&order=clickcount&reverse=true`,
  );
  if (!res.ok) throw new Error("Could not load stations");
  const data = (await res.json()) as RadioStation[];
  // Browsers block plain-http streams on an https page, so keep secure streams only.
  const seen = new Set<string>();
  return data
    .filter((s) => s.url_resolved?.startsWith("https://"))
    .filter((s) => {
      const key = s.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function countStationClick(uuid: string): void {
  void fetch(`${API}/url/${uuid}`).catch(() => undefined);
}
