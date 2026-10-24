// Business / address search-as-you-type using Photon (OpenStreetMap data). Free, no key.
// Typed text is sent to photon.komoot.io; nothing else leaves the phone.
const STATES = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  "District of Columbia": "DC", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR",
  Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

// "Windy Hill Road Southeast" -> "Windy Hill Road SE" (the report abbreviates compound directions)
const shortStreet = s => s
  .replace(/\bNortheast\b/g, "NE").replace(/\bNorthwest\b/g, "NW")
  .replace(/\bSoutheast\b/g, "SE").replace(/\bSouthwest\b/g, "SW");

// Not businesses: places, roads, boundaries.
const NOT_BUSINESS = new Set(["place", "highway", "boundary", "waterway", "natural", "landuse"]);

function toPlace(f) {
  const p = f.properties || {};
  const street = shortStreet([p.housenumber, p.street].filter(Boolean).join(" "));
  const st = STATES[p.state] || p.state || "";
  const cityLine = [p.city || p.district || "", [st, p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const isBusiness = p.name && !NOT_BUSINESS.has(p.osm_key) && p.name !== p.street;
  return {
    name: isBusiness ? p.name : "",
    street,
    cityLine,
    title: isBusiness ? p.name : (street || p.name || ""),
    detail: [street, cityLine].filter(Boolean).join(", "),
  };
}

export async function searchPlaces(query, signal) {
  const url = "https://photon.komoot.io/api/?" + new URLSearchParams({ q: query, limit: "6", lang: "en" });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("search failed");
  const data = await res.json();
  const seen = new Set();
  return (data.features || []).map(toPlace).filter(p => {
    const key = p.title + "|" + p.detail;
    if (!p.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Wires a search box to a list element. onPick(place) is called when a suggestion is tapped.
export function attachPlaceSearch(input, list, onPick) {
  let timer = null, ctl = null;
  const clear = () => list.replaceChildren();
  const note = text => { const d = document.createElement("div"); d.className = "sug-note"; d.textContent = text; list.replaceChildren(d); };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    if (ctl) ctl.abort();
    const q = input.value.trim();
    if (q.length < 3) return clear();
    timer = setTimeout(async () => {
      ctl = new AbortController();
      try {
        const places = await searchPlaces(q, ctl.signal);
        if (!places.length) return note("No matches. Type the details below instead.");
        list.replaceChildren(...places.map(pl => {
          const b = document.createElement("button");
          b.type = "button"; b.className = "sug";
          const t = document.createElement("div"); t.className = "sug-t"; t.textContent = pl.title;
          const d = document.createElement("div"); d.className = "sug-d"; d.textContent = pl.detail;
          b.append(t, d);
          b.onclick = () => { clear(); input.value = ""; onPick(pl); };
          return b;
        }));
      } catch (e) {
        if (e.name !== "AbortError") note("Search unavailable (no signal?). Type the details below instead.");
      }
    }, 350);
  });
}
