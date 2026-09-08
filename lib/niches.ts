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
    { id: "faceless", name: "AI-Generated Faceless Content", queries: ["ai generated documentary", "ai narration story", "ai history documentary", "ai animated story", "ai generated facts video", "ai book summary", "ai sleep story narration", "ai psychology facts"], rpm: { min: 2, max: 6, avg: 4 }, competition: "medium", difficulty: "easy" },
    { id: "crypto", name: "Cryptocurrency", queries: ["crypto tutorial 2026", "bitcoin explained", "crypto investing guide", "blockchain explained"], rpm: { min: 8, max: 20, avg: 13 }, competition: "high", difficulty: "hard" },
    { id: "travel", name: "Travel & Lifestyle", queries: ["travel guide 2026", "budget travel tips", "destination review", "travel vlog"], rpm: { min: 4, max: 12, avg: 7 }, competition: "medium", difficulty: "medium" },
    { id: "music", name: "Music / Production", queries: ["music production tutorial", "beat making tutorial", "music theory explained", "DAW tutorial"], rpm: { min: 2, max: 8, avg: 4 }, competition: "medium", difficulty: "medium" },
    { id: "pets", name: "Pets & Animals", queries: ["pet care guide", "dog training tutorial", "cat behavior explained", "animal facts"], rpm: { min: 2, max: 6, avg: 3.5 }, competition: "low", difficulty: "easy" },
    { id: "kids", name: "Kids Content", queries: ["kids educational videos", "fun learning for kids", "kids science experiment", "kids story time", "nursery rhymes for kids", "kids drawing tutorial"], rpm: { min: 1.5, max: 6, avg: 3 }, competition: "low", difficulty: "easy" },
    { id: "news_politics", name: "News & Politics", queries: ["news explained", "political analysis", "current events explained", "world news breakdown"], rpm: { min: 3, max: 8, avg: 5 }, competition: "high", difficulty: "medium" },
  ],
  shortform: [
    { id: "faceless", name: "AI-Generated Faceless Shorts", queries: ["ai story shorts #shorts", "ai generated shorts #shorts", "ai animation shorts #shorts", "ai history facts shorts #shorts", "ai reddit story shorts #shorts", "ai narration shorts #shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "medium", difficulty: "easy" },
    { id: "tech_ai", name: "AI Mini Tools / Quick Hacks", queries: ["AI tool shorts #shorts", "tech hack shorts #shorts", "AI quick tip #shorts", "gadget hack shorts #shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "medium", difficulty: "easy" },
    { id: "micro_learning", name: "Micro-Learning / One-Minute Facts", queries: ["did you know shorts #shorts", "quick facts shorts #shorts", "learn in 60 seconds #shorts", "trivia shorts #shorts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "low", difficulty: "easy" },
    { id: "comedy", name: "Comedy / Memes / Skits", queries: ["funny shorts #shorts", "comedy skit shorts #shorts", "meme compilation shorts #shorts", "humor shorts #shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "high", difficulty: "easy" },
    { id: "fitness", name: "Quick Fitness Tips", queries: ["30 second workout #shorts", "fitness tip shorts #shorts", "exercise form fix #shorts", "quick abs workout #shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "medium", difficulty: "easy" },
    { id: "gaming", name: "Gaming Highlights / Clips", queries: ["gaming moments shorts #shorts", "epic gaming clip #shorts", "funny gaming moments #shorts", "game highlight shorts #shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "high", difficulty: "easy" },
    { id: "finance", name: "Money & Business Tips", queries: ["money tips shorts #shorts", "finance hack shorts #shorts", "side hustle shorts #shorts", "business tip shorts #shorts"], rpm: { min: 2, max: 8, avg: 4 }, competition: "medium", difficulty: "medium" },
    { id: "motivation", name: "Motivation / Mindset Quotes", queries: ["motivational shorts #shorts", "inspirational quote shorts #shorts", "mindset shorts #shorts", "success quotes #shorts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "low", difficulty: "easy" },
    { id: "animals", name: "Pet & Animal Clips", queries: ["cute animal shorts #shorts", "funny pet shorts #shorts", "animal moments shorts #shorts", "cat dog shorts #shorts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "low", difficulty: "easy" },
    { id: "products", name: "Product Reviews / Unboxing", queries: ["unboxing shorts #shorts", "quick review shorts #shorts", "product test shorts #shorts", "gadget review shorts #shorts"], rpm: { min: 1, max: 5, avg: 2.5 }, competition: "medium", difficulty: "easy" },
    { id: "cooking", name: "Cooking Hacks / Recipe Snippets", queries: ["cooking hack shorts #shorts", "recipe shorts #shorts", "quick recipe shorts #shorts", "food hack shorts #shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "low", difficulty: "easy" },
    { id: "beauty_fashion", name: "Beauty & Fashion Quick Tips", queries: ["makeup hack shorts #shorts", "fashion tip shorts #shorts", "outfit idea shorts #shorts", "beauty hack shorts #shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "medium", difficulty: "easy" },
    { id: "compilations", name: "Compilation Clips", queries: ["compilation shorts #shorts", "best moments compilation #shorts", "viral clip compilation #shorts", "funny moments compilation #shorts"], rpm: { min: 0.3, max: 1.5, avg: 0.8 }, competition: "high", difficulty: "easy" },
    { id: "facts", name: "Psychology / Life Facts", queries: ["psychology fact shorts #shorts", "life hack shorts #shorts", "brain fact shorts #shorts", "human body facts #shorts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "low", difficulty: "easy" },
    { id: "travel", name: "Travel Snapshots", queries: ["travel shorts #shorts", "beautiful places shorts #shorts", "travel vlog shorts #shorts", "hidden gems travel #shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "medium", difficulty: "easy" },
    { id: "diy", name: "DIY Quick Fixes", queries: ["DIY hack shorts #shorts", "quick fix shorts #shorts", "life hack DIY #shorts", "home repair shorts #shorts"], rpm: { min: 1, max: 3, avg: 1.5 }, competition: "low", difficulty: "easy" },
    { id: "dance", name: "Dance & Challenges", queries: ["dance shorts #shorts", "viral dance challenge #shorts", "trending dance shorts #shorts", "dance tutorial shorts #shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "high", difficulty: "easy" },
    { id: "scary", name: "Scary Stories / Horror", queries: ["horror shorts #shorts", "scary story shorts #shorts", "creepy shorts #shorts", "horror story shorts #shorts"], rpm: { min: 1, max: 3, avg: 2 }, competition: "low", difficulty: "easy" },
    { id: "asmr", name: "ASMR", queries: ["ASMR shorts #shorts", "satisfying shorts #shorts", "relaxing shorts #shorts", "oddly satisfying shorts #shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "medium", difficulty: "easy" },
    { id: "cars", name: "Cars & Racing", queries: ["car shorts #shorts", "supercar shorts #shorts", "racing shorts #shorts", "car review shorts #shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "medium", difficulty: "easy" },
    { id: "sports", name: "Sports Highlights", queries: ["sports highlights #shorts", "sports moments #shorts", "athletic shorts #shorts", "action sports shorts #shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "medium", difficulty: "easy" },
    { id: "family", name: "Family & Parenting", queries: ["family shorts #shorts", "parenting shorts #shorts", "baby shorts #shorts", "family moments shorts #shorts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "low", difficulty: "easy" },
    { id: "art", name: "Art & Design", queries: ["art shorts #shorts", "drawing shorts #shorts", "design process shorts #shorts", "art tutorial shorts #shorts"], rpm: { min: 0.5, max: 3, avg: 1.5 }, competition: "low", difficulty: "easy" },
    { id: "education", name: "Educational Shorts", queries: ["educational shorts #shorts", "learn something shorts #shorts", "knowledge shorts #shorts", "science shorts #shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "low", difficulty: "easy" },
    { id: "kids", name: "Kids Shorts", queries: ["kids learning shorts #shorts", "fun facts for kids #shorts", "kids rhymes shorts #shorts", "kids drawing shorts #shorts", "kids science shorts #shorts"], rpm: { min: 0.8, max: 3, avg: 1.5 }, competition: "low", difficulty: "easy" },
    { id: "commentary", name: "Commentary / Reaction", queries: ["commentary shorts #shorts", "reaction shorts #shorts", "viral clip reaction shorts #shorts", "hot take shorts #shorts"], rpm: { min: 0.5, max: 2, avg: 1 }, competition: "high", difficulty: "easy" },
    { id: "news", name: "News Shorts", queries: ["news shorts #shorts", "breaking news shorts #shorts", "current events shorts #shorts", "world news shorts #shorts"], rpm: { min: 1, max: 4, avg: 2 }, competition: "medium", difficulty: "easy" },
  ],
};
