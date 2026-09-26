export interface NicheAssetProfile {
  /** Whether the pipeline can auto-build visuals for this niche from web/stock sources. */
  stockViable: boolean;
  /** Generic visual queries used when a scene has no clear topic (intro/transition/hook). */
  fallbackQueries: string[];
  /** Appended keywords to sharpen web/stock matches for this niche. */
  sceneBoost?: string;
}

const PROFILES: Record<string, NicheAssetProfile> = {
  // --- Not viable: personality / authentic footage required (local library or import only).
  vlogging: { stockViable: false, fallbackQueries: ["personal lifestyle", "daily routine vlog"] },
  commentary: { stockViable: false, fallbackQueries: ["studio microphone", "person speaking"] },
  reaction: { stockViable: false, fallbackQueries: ["watching a screen", "live reaction audience"] },
  dance: { stockViable: false, fallbackQueries: ["dance class", "choreography rehearsal"] },
  true_crime: { stockViable: false, fallbackQueries: ["dark city alley night", "mystery investigation", "police tape"] },
  entertainment: { stockViable: false, fallbackQueries: ["neon lights city", "pop culture collage"] },

  // --- Viable: explainer / b-roll friendly niches.
  faceless: { stockViable: true, fallbackQueries: ["cinematic abstract b-roll", "mysterious atmosphere", "aerial landscape"], sceneBoost: "cinematic moody" },
  motivation: { stockViable: true, fallbackQueries: ["sunrise mountains", "ocean waves", "golden hour silhouette"], sceneBoost: "inspirational sunrise" },
  micro_learning: { stockViable: true, fallbackQueries: ["abstract knowledge", "books and learning", "brain concept"], sceneBoost: "minimal educational" },
  facts: { stockViable: true, fallbackQueries: ["curiosity abstract", "human brain science", "question mark concept"], sceneBoost: "science fact" },
  education: { stockViable: true, fallbackQueries: ["books classroom learning", "science experiment", "world map geography"], sceneBoost: "educational" },
  documentary: { stockViable: true, fallbackQueries: ["historical archive", "nature documentary", "vintage footage"], sceneBoost: "documentary style" },
  animals: { stockViable: true, fallbackQueries: ["cute animals", "wildlife nature", "pets playing"], sceneBoost: "animal wildlife" },
  pets: { stockViable: true, fallbackQueries: ["cute cat dog", "pets playing", "animal close up"], sceneBoost: "pets animals" },
  travel: { stockViable: true, fallbackQueries: ["beautiful landscape", "famous city landmark", "travel destination"], sceneBoost: "travel scenic" },
  cooking: { stockViable: true, fallbackQueries: ["kitchen cooking close up", "fresh ingredients", "food preparation"], sceneBoost: "food cooking" },
  diy: { stockViable: true, fallbackQueries: ["workshop tools", "craft project", "woodworking"], sceneBoost: "diy workshop" },
  fitness: { stockViable: true, fallbackQueries: ["gym workout", "running athletic", "fitness training"], sceneBoost: "fitness workout" },
  health: { stockViable: true, fallbackQueries: ["healthy lifestyle", "yoga wellness", "fresh vegetables"], sceneBoost: "health wellness" },
  cars: { stockViable: true, fallbackQueries: ["sports car", "car on road", "racing track"], sceneBoost: "cars automotive" },
  automotive: { stockViable: true, fallbackQueries: ["car engine", "car interior", "supercar showcase"], sceneBoost: "automotive" },
  sports: { stockViable: true, fallbackQueries: ["stadium sports", "athlete action", "soccer match"], sceneBoost: "sports action" },
  asmr: { stockViable: true, fallbackQueries: ["relaxing nature", "satisfying waves", "calm abstract"], sceneBoost: "relaxing satisfying" },
  finance: { stockViable: true, fallbackQueries: ["money coins", "stock market chart", "financial graphs"], sceneBoost: "finance money" },
  crypto: { stockViable: true, fallbackQueries: ["bitcoin abstract", "blockchain network", "digital currency"], sceneBoost: "crypto blockchain" },
  insurance: { stockViable: true, fallbackQueries: ["handshake business", "documents signing", "family protection"], sceneBoost: "insurance protection" },
  legal: { stockViable: true, fallbackQueries: ["law books", "courtroom gavel", "justice scales"], sceneBoost: "law justice" },
  realestate: { stockViable: true, fallbackQueries: ["modern house exterior", "home interior", "city skyline"], sceneBoost: "real estate property" },
  saas: { stockViable: true, fallbackQueries: ["computer code screen", "office teamwork", "cloud technology abstract"], sceneBoost: "software technology" },
  tech_ai: { stockViable: true, fallbackQueries: ["artificial intelligence abstract", "computer chips", "code on screen"], sceneBoost: "technology AI" },
  products: { stockViable: true, fallbackQueries: ["product close up", "gadgets unboxing", "minimal product shot"], sceneBoost: "product gadget" },
  beauty_fashion: { stockViable: true, fallbackQueries: ["makeup brushes", "fashion outfit", "skincare products"], sceneBoost: "beauty fashion" },
  family: { stockViable: true, fallbackQueries: ["family happy moments", "children playing", "home together"], sceneBoost: "family" },
  parenting: { stockViable: true, fallbackQueries: ["baby care", "parent and child", "happy family home"], sceneBoost: "parenting family" },
  kids: { stockViable: true, fallbackQueries: ["colorful toys", "children learning fun", "bright cartoon colors"], sceneBoost: "children colorful" },
  art: { stockViable: true, fallbackQueries: ["painting artist studio", "drawing sketch", "color palette"], sceneBoost: "art creative" },
  scary: { stockViable: true, fallbackQueries: ["dark foggy forest", "abandoned house night", "moody shadows"], sceneBoost: "dark scary moody" },
  gaming: { stockViable: true, fallbackQueries: ["gaming setup rgb", "video game controller", "esports arena"], sceneBoost: "gaming" },
  news: { stockViable: true, fallbackQueries: ["news studio", "world map current events", "city skyline"], sceneBoost: "news current events" },
  news_politics: { stockViable: true, fallbackQueries: ["world map politics", "government building", "news studio"], sceneBoost: "news politics" },
  comedy: { stockViable: true, fallbackQueries: ["funny colorful abstract", "laughing crowd", "comedy lights"], sceneBoost: "funny comedic" },
  compilations: { stockViable: true, fallbackQueries: ["best moments montage", "viral highlights", "energetic compilation"], sceneBoost: "best moments highlights" },
  business: { stockViable: true, fallbackQueries: ["startup office", "handshake meeting", "growth charts"], sceneBoost: "business startup" },
  music: { stockViable: true, fallbackQueries: ["music studio", "headphones mixing", "concert stage lights"], sceneBoost: "music production" },
};

export const DEFAULT_ASSET_PROFILE: NicheAssetProfile = {
  stockViable: true,
  fallbackQueries: ["abstract background", "cinematic b-roll", "aerial landscape"],
  sceneBoost: "",
};

export function getNicheAssetProfile(niche: string): NicheAssetProfile {
  return PROFILES[niche] ?? DEFAULT_ASSET_PROFILE;
}

export function isStockViable(niche: string): boolean {
  return getNicheAssetProfile(niche).stockViable;
}