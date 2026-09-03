export interface VideoFormat {
  id: string;
  name: string;
  ratio: string;
}

export interface Niche {
  id: string;
  name: string;
  queries: string[];
  rpm: { min: number; max: number; avg: number };
  competition: "low" | "medium" | "high";
  difficulty: "easy" | "medium" | "hard";
}

export const VIDEO_FORMATS: VideoFormat[] = [
  { id: "longform", name: "Long Form", ratio: "16:9" },
  { id: "shortform", name: "Short Form", ratio: "9:16" },
];

export const FORMAT_NICHES: Record<string, Niche[]> = {
  longform: [
    { id: "finance", name: "Finance & Investing", queries: ["personal finance tutorial", "investing guide 2026", "stock market explained", "crypto beginner guide"], rpm: { min: 8, max: 22, avg: 15 }, competition: "high", difficulty: "hard" },
    { id: "insurance", name: "Insurance", queries: ["life insurance explained", "health insurance guide", "auto insurance tips", "insurance comparison"], rpm: { min: 10, max: 25, avg: 17 }, competition: "high", difficulty: "hard" },
    { id: "legal", name: "Legal & Law", queries: ["legal advice explained", "know your rights", "law basics tutorial", "court case explained"], rpm: { min: 12, max: 30, avg: 20 }, competition: "high", difficulty: "hard" },
    { id: "realestate", name: "Real Estate", queries: ["real estate investing", "house hunting guide", "mortgage explained", "property investment 2026"], rpm: { min: 8, max: 18, avg: 12 }, competition: "medium", difficulty: "medium" },
    { id: "saas", name: "B2B Software / SaaS", queries: ["SaaS tutorial", "business software review", "CRM tutorial", "productivity tools 2026"], rpm: { min: 15, max: 45, avg: 25 }, competition: "medium", difficulty: "medium" },
    { id: "tech_ai", name: "Tech & AI Tutorials", queries: ["AI tools tutorial 2026", "tech review", "coding tutorial", "gadget review 2026"], rpm: { min: 5, max: 12, avg: 8 }, competition: "high", difficulty: "medium" },
    { id: "health", name: "Health & Wellness", queries: ["fitness workout tutorial", "mental health guide", "nutrition tips", "wellness routine"], rpm: { min: 6, max: 15, avg: 10 }, competition: "medium", difficulty: "medium" },
    { id: "education", name: "Education / How-To", queries: ["how to tutorial", "learn skill online", "educational explained", "deep dive tutorial"], rpm: { min: 4, max: 10, avg: 7 }, competition: "medium", difficulty: "easy" },
    { id: "gaming", name: "Gaming", queries: ["gaming walkthrough 2026", "game review", "gameplay full", "gaming tips and tricks"], rpm: { min: 1.5, max: 5.5, avg: 3 }, competition: "high", difficulty: "medium" },
    { id: "entertainment", name: "Entertainment & Pop Culture", queries: ["reaction video", "celebrity news", "pop culture commentary", "entertainment review"], rpm: { min: 1, max: 4, avg: 2.5 }, competition: "high", difficulty: "easy" },
    { id: "vlogging", name: "Vlogging / Lifestyle", queries: ["daily vlog", "travel vlog 2026", "day in the life", "lifestyle vlog"], rpm: { min: 2, max: 6, avg: 4 }, competition: "medium", difficulty: "easy" },
    { id: "business", name: "Business & Entrepreneurship", queries: ["business case study", "startup story", "entrepreneur tutorial", "side hustle ideas"], rpm: { min: 6, max: 18, avg: 12 }, competition: "medium", difficulty: "medium" },
    { id: "true_crime", name: "True Crime / Storytelling", queries: ["true crime documentary", "unsolved case", "criminal psychology", "mystery story"], rpm: { min: 3, max: 8, avg: 5 }, competition: "medium", difficulty: "medium" },
    { id: "beauty_fashion", name: "Beauty & Fashion", queries: ["makeup tutorial 2026", "fashion lookbook", "skincare routine", "style guide"], rpm: { min: 2, max: 7, avg: 4 }, competition: "high", difficulty: "medium" },
    { id: "cooking", name: "Food & Cooking", queries: ["cooking recipe tutorial", "baking recipe", "easy dinner recipe", "chef tutorial"], rpm: { min: 2.5, max: 8, avg: 5 }, competition: "medium", difficulty: "easy" },
    { id: "diy", name: "DIY / Home Improvement", queries: ["DIY project tutorial", "home renovation", "woodworking project", "craft tutorial"], rpm: { min: 4, max: 9, avg: 6 }, competition: "low", difficulty: "easy" },
    { id: "automotive", name: "Automotive", queries: ["car review 2026", "car repair tutorial", "supercar showcase", "auto detailing guide"], rpm: { min: 3, max: 9, avg: 6 }, competition: "medium", difficulty: "medium" },
    { id: "parenting", name: "Parenting & Family", queries: ["parenting tips", "family vlog", "baby care guide", "family activities"], rpm: { min: 2, max: 5, avg: 3.5 }, competition: "low", difficulty: "easy" },
    { id: "documentary", name: "Documentary / Educational Deep-Dives", queries: ["documentary full", "science documentary", "history documentary", "investigative documentary"], rpm: { min: 3, max: 8, avg: 5 }, competition: "low", difficulty: "medium" },
    { id: "faceless", name: "AI-Generated Faceless Content", queries: ["reddit stories reading", "scary story narration", "motivational quotes AI art", "history facts animated", "psychology facts video", "space documentary AI", "philosophy thoughts", "book summary narration", "crime story narration", "meditation visuals AI"], rpm: { min: 2, max: 6, avg: 4 }, competition: "medium", difficulty: "easy" },
    { id: "crypto", name: "Cryptocurrency", queries: ["crypto tutorial 2026", "bitcoin explained", "crypto investing guide", "blockchain explained"], rpm: { min: 8, max: 20, avg: 13 }, competition: "high", difficulty: "hard" },
    { id: "travel", name: "Travel & Lifestyle", queries: ["travel guide 2026", "budget travel tips", "destination review", "travel vlog"], rpm: { min: 4, max: 12, avg: 7 }, competition: "medium", difficulty: "medium" },
    { id: "music", name: "Music / Production", queries: ["music production tutorial", "beat making tutorial", "music theory explained", "DAW tutorial"], rpm: { min: 2, max: 8, avg: 4 }, competition: "medium", difficulty: "medium" },
    { id: "pets", name: "Pets & Animals", queries: ["pet care guide", "dog training tutorial", "cat behavior explained", "animal facts"], rpm: { min: 2, max: 6, avg: 3.5 }, competition: "low", difficulty: "easy" },
    { id: "news_politics", name: "News & Politics", queries: ["news explained", "political analysis", "current events explained", "world news breakdown"], rpm: { min: 3, max: 8, avg: 5 }, competition: "high", difficulty: "medium" },
  ],
  shortform: [
    { id: "tech_ai", name: "AI Mini Tools / Quick Hacks", queries: ["AI tool shorts", "tech hack shorts", "AI quick tip", "gadget hack shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "medium", difficulty: "easy" },
    { id: "micro_learning", name: "Micro-Learning / One-Minute Facts", queries: ["did you know shorts", "quick facts shorts", "learn in 60 seconds", "trivia shorts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "low", difficulty: "easy" },
    { id: "comedy", name: "Comedy / Memes / Skits", queries: ["funny shorts", "comedy skit shorts", "meme compilation shorts", "humor shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "high", difficulty: "easy" },
    { id: "fitness", name: "Quick Fitness Tips", queries: ["30 second workout", "fitness tip shorts", "exercise form fix", "quick abs workout"], rpm: { min: 1, max: 4, avg: 2 }, competition: "medium", difficulty: "easy" },
    { id: "gaming", name: "Gaming Highlights / Clips", queries: ["gaming moments shorts", "epic gaming clip", "funny gaming moments", "game highlight shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "high", difficulty: "easy" },
    { id: "finance", name: "Money & Business Tips", queries: ["money tips shorts", "finance hack shorts", "side hustle shorts", "business tip shorts"], rpm: { min: 2, max: 8, avg: 4 }, competition: "medium", difficulty: "medium" },
    { id: "motivation", name: "Motivation / Mindset Quotes", queries: ["motivational shorts", "inspirational quote shorts", "mindset shorts", "success quotes"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "low", difficulty: "easy" },
    { id: "animals", name: "Pet & Animal Clips", queries: ["cute animal shorts", "funny pet shorts", "animal moments shorts", "cat dog shorts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "low", difficulty: "easy" },
    { id: "products", name: "Product Reviews / Unboxing", queries: ["unboxing shorts", "quick review shorts", "product test shorts", "gadget review shorts"], rpm: { min: 1, max: 5, avg: 2.5 }, competition: "medium", difficulty: "easy" },
    { id: "cooking", name: "Cooking Hacks / Recipe Snippets", queries: ["cooking hack shorts", "recipe shorts", "quick recipe shorts", "food hack shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "low", difficulty: "easy" },
    { id: "beauty_fashion", name: "Beauty & Fashion Quick Tips", queries: ["makeup hack shorts", "fashion tip shorts", "outfit idea shorts", "beauty hack shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "medium", difficulty: "easy" },
    { id: "compilations", name: "Compilation Clips", queries: ["compilation shorts", "best moments compilation", "viral clip compilation", "funny moments compilation"], rpm: { min: 0.3, max: 1.5, avg: 0.8 }, competition: "high", difficulty: "easy" },
    { id: "facts", name: "Psychology / Life Facts", queries: ["psychology fact shorts", "life hack shorts", "brain fact shorts", "human body facts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "low", difficulty: "easy" },
    { id: "travel", name: "Travel Snapshots", queries: ["travel shorts", "beautiful places shorts", "travel vlog shorts", "hidden gems travel"], rpm: { min: 1, max: 4, avg: 2 }, competition: "medium", difficulty: "easy" },
    { id: "diy", name: "DIY Quick Fixes", queries: ["DIY hack shorts", "quick fix shorts", "life hack DIY", "home repair shorts"], rpm: { min: 1, max: 3, avg: 1.5 }, competition: "low", difficulty: "easy" },
    { id: "dance", name: "Dance & Challenges", queries: ["dance shorts", "viral dance challenge", "trending dance shorts", "dance tutorial shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "high", difficulty: "easy" },
    { id: "scary", name: "Scary Stories / Horror", queries: ["horror shorts", "scary story shorts", "creepy shorts", "horror story shorts"], rpm: { min: 1, max: 3, avg: 2 }, competition: "low", difficulty: "easy" },
    { id: "asmr", name: "ASMR", queries: ["ASMR shorts", "satisfying shorts", "relaxing shorts", "oddly satisfying shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "medium", difficulty: "easy" },
    { id: "cars", name: "Cars & Racing", queries: ["car shorts", "supercar shorts", "racing shorts", "car review shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "medium", difficulty: "easy" },
    { id: "sports", name: "Sports Highlights", queries: ["sports highlights", "sports moments", "athletic shorts", "action sports shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "medium", difficulty: "easy" },
    { id: "family", name: "Family & Parenting", queries: ["family shorts", "parenting shorts", "baby shorts", "family moments shorts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "low", difficulty: "easy" },
    { id: "art", name: "Art & Design", queries: ["art shorts", "drawing shorts", "design process shorts", "art tutorial shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "low", difficulty: "easy" },
    { id: "education", name: "Educational Shorts", queries: ["educational shorts", "learn something shorts", "knowledge shorts", "science shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "low", difficulty: "easy" },
    { id: "commentary", name: "Commentary / Reaction", queries: ["commentary shorts", "reaction shorts", "viral clip reaction shorts", "hot take shorts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "high", difficulty: "easy" },
    { id: "news", name: "News Shorts", queries: ["news shorts", "breaking news shorts", "current events shorts", "world news shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "medium", difficulty: "easy" },
  ],
};
