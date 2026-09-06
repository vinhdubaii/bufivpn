// ===================== SHARED DATA (main window + tray popup) =====================
// Every region maps to a real public DNS provider.
const REGION_DNS = {
  americas: { name: "Cloudflare", primary: "1.1.1.1", secondary: "1.0.0.1" },
  europe:   { name: "Quad9",      primary: "9.9.9.9", secondary: "149.112.112.112" },
  asia:     { name: "Google",     primary: "8.8.8.8", secondary: "8.8.4.4" },
  oceania:  { name: "OpenDNS",    primary: "208.67.222.222", secondary: "208.67.220.220" },
};

const REGION_LABELS = {
  americas: "Americas",
  europe: "Europe",
  asia: "Asia",
  oceania: "Oceania",
};

const SERVERS = [
  // ---- Americas ----
  { id: "us-nyc", region: "americas", flag: "🇺🇸", city: "New York", country: "United States", tag: "High Speed", lat: 40.7128, lng: -74.0060 },
  { id: "us-la",  region: "americas", flag: "🇺🇸", city: "Los Angeles", country: "United States", tag: "Streaming Only", lat: 34.0522, lng: -118.2437 },
  { id: "us-mia", region: "americas", flag: "🇺🇸", city: "Miami", country: "United States", tag: "Gaming Route", lat: 25.7617, lng: -80.1918 },
  { id: "ca-tor", region: "americas", flag: "🇨🇦", city: "Toronto", country: "Canada", tag: "Low Latency", lat: 43.6532, lng: -79.3832 },
  { id: "mx-mex", region: "americas", flag: "🇲🇽", city: "Mexico City", country: "Mexico", tag: "", lat: 19.4326, lng: -99.1332 },
  { id: "br-sao", region: "americas", flag: "🇧🇷", city: "São Paulo", country: "Brazil", tag: "", lat: -23.5505, lng: -46.6333 },
  { id: "ar-bue", region: "americas", flag: "🇦🇷", city: "Buenos Aires", country: "Argentina", tag: "", lat: -34.6037, lng: -58.3816 },
  { id: "cl-san", region: "americas", flag: "🇨🇱", city: "Santiago", country: "Chile", tag: "", lat: -33.4489, lng: -70.6693 },

  // ---- Europe ----
  { id: "gb-lon", region: "europe", flag: "🇬🇧", city: "London", country: "United Kingdom", tag: "Ultra Fast", lat: 51.5074, lng: -0.1278 },
  { id: "de-fra", region: "europe", flag: "🇩🇪", city: "Frankfurt", country: "Germany", tag: "P2P Optimized", lat: 50.1109, lng: 8.6821 },
  { id: "fr-par", region: "europe", flag: "🇫🇷", city: "Paris", country: "France", tag: "No-Logs Node", lat: 48.8566, lng: 2.3522 },
  { id: "nl-ams", region: "europe", flag: "🇳🇱", city: "Amsterdam", country: "Netherlands", tag: "Direct Fiber", lat: 52.3676, lng: 4.9041 },
  { id: "ch-zur", region: "europe", flag: "🇨🇭", city: "Zurich", country: "Switzerland", tag: "Military Encryption", lat: 47.3769, lng: 8.5417 },
  { id: "se-sto", region: "europe", flag: "🇸🇪", city: "Stockholm", country: "Sweden", tag: "", lat: 59.3293, lng: 18.0686 },
  { id: "no-osl", region: "europe", flag: "🇳🇴", city: "Oslo", country: "Norway", tag: "", lat: 59.9139, lng: 10.7522 },
  { id: "dk-cph", region: "europe", flag: "🇩🇰", city: "Copenhagen", country: "Denmark", tag: "", lat: 55.6761, lng: 12.5683 },
  { id: "fi-hel", region: "europe", flag: "🇫🇮", city: "Helsinki", country: "Finland", tag: "", lat: 60.1699, lng: 24.9384 },
  { id: "it-mil", region: "europe", flag: "🇮🇹", city: "Milan", country: "Italy", tag: "", lat: 45.4642, lng: 9.1900 },
  { id: "es-mad", region: "europe", flag: "🇪🇸", city: "Madrid", country: "Spain", tag: "", lat: 40.4168, lng: -3.7038 },
  { id: "pt-lis", region: "europe", flag: "🇵🇹", city: "Lisbon", country: "Portugal", tag: "", lat: 38.7223, lng: -9.1393 },
  { id: "ie-dub", region: "europe", flag: "🇮🇪", city: "Dublin", country: "Ireland", tag: "", lat: 53.3498, lng: -6.2603 },
  { id: "at-vie", region: "europe", flag: "🇦🇹", city: "Vienna", country: "Austria", tag: "", lat: 48.2082, lng: 16.3738 },
  { id: "be-bru", region: "europe", flag: "🇧🇪", city: "Brussels", country: "Belgium", tag: "", lat: 50.8503, lng: 4.3517 },
  { id: "pl-war", region: "europe", flag: "🇵🇱", city: "Warsaw", country: "Poland", tag: "", lat: 52.2297, lng: 21.0122 },
  { id: "cz-pra", region: "europe", flag: "🇨🇿", city: "Prague", country: "Czechia", tag: "", lat: 50.0755, lng: 14.4378 },
  { id: "ro-buc", region: "europe", flag: "🇷🇴", city: "Bucharest", country: "Romania", tag: "", lat: 44.4268, lng: 26.1025 },
  { id: "ua-kyi", region: "europe", flag: "🇺🇦", city: "Kyiv", country: "Ukraine", tag: "", lat: 50.4501, lng: 30.5234 },

  // ---- Asia ----
  { id: "jp-tyo", region: "asia", flag: "🇯🇵", city: "Tokyo", country: "Japan", tag: "Low Ping", lat: 35.6762, lng: 139.6503 },
  { id: "jp-osa", region: "asia", flag: "🇯🇵", city: "Osaka", country: "Japan", tag: "", lat: 34.6937, lng: 135.5023 },
  { id: "kr-seo", region: "asia", flag: "🇰🇷", city: "Seoul", country: "South Korea", tag: "4K Video", lat: 37.5665, lng: 126.9780 },
  { id: "sg-cen", region: "asia", flag: "🇸🇬", city: "Central", country: "Singapore", tag: "Sea Gaming", lat: 1.3521, lng: 103.8198 },
  { id: "hk-cen", region: "asia", flag: "🇭🇰", city: "Central", country: "Hong Kong", tag: "", lat: 22.3193, lng: 114.1694 },
  { id: "tw-tpe", region: "asia", flag: "🇹🇼", city: "Taipei", country: "Taiwan", tag: "", lat: 25.0330, lng: 121.5654 },
  { id: "th-bkk", region: "asia", flag: "🇹🇭", city: "Bangkok", country: "Thailand", tag: "", lat: 13.7563, lng: 100.5018 },
  { id: "id-jak", region: "asia", flag: "🇮🇩", city: "Jakarta", country: "Indonesia", tag: "", lat: -6.2088, lng: 106.8456 },
  { id: "my-kul", region: "asia", flag: "🇲🇾", city: "Kuala Lumpur", country: "Malaysia", tag: "", lat: 3.1390, lng: 101.6869 },
  { id: "ph-man", region: "asia", flag: "🇵🇭", city: "Manila", country: "Philippines", tag: "", lat: 14.5995, lng: 120.9842 },
  { id: "in-mum", region: "asia", flag: "🇮🇳", city: "Mumbai", country: "India", tag: "", lat: 19.0760, lng: 72.8777 },
  { id: "id-bal", region: "asia", flag: "🇮🇩", city: "Bali Node", country: "Indonesia", tag: "", lat: -8.3405, lng: 115.0920 },
  { id: "vn-han", region: "asia", flag: "🇻🇳", city: "Hanoi", country: "Vietnam", tag: "Local Server", lat: 21.0285, lng: 105.8542 },
  { id: "vn-hcm", region: "asia", flag: "🇻🇳", city: "Ho Chi Minh City", country: "Vietnam", tag: "VNNIC Express", lat: 10.8231, lng: 106.6297 },

  // ---- Oceania ----
  { id: "au-syd", region: "oceania", flag: "🇦🇺", city: "Sydney", country: "Australia", tag: "Oceania Hub", lat: -33.8688, lng: 151.2093 },
  { id: "au-mel", region: "oceania", flag: "🇦🇺", city: "Melbourne", country: "Australia", tag: "", lat: -37.8136, lng: 144.9631 },
  { id: "nz-akl", region: "oceania", flag: "🇳🇿", city: "Auckland", country: "New Zealand", tag: "", lat: -36.8485, lng: 174.7633 },
];
