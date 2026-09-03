const AIHUBMIX_API_KEY = process.env.AIHUBMIX_API_KEY;
const AIHUBMIX_BASE_URL = "https://aihubmix.com/v1";

export interface ThumbnailOptions {
  title: string;
  style?: "modern" | "bold" | "minimal" | "cinematic" | "vibrant";
  niche?: string;
}

export interface ThumbnailResult {
  success: boolean;
  imageData?: string;
  revisedPrompt?: string;
  error?: string;
}

const STYLE_PROMPTS: Record<string, string> = {
  modern: "clean modern design, gradient background, bold sans-serif text, minimalist, professional",
  bold: "bold dramatic design, high contrast, big typography, eye-catching colors, intense",
  minimal: "minimalist design, simple composition, white space, elegant typography, clean",
  cinematic: "cinematic look, dramatic lighting, film grain, moody atmosphere, professional photography",
  vibrant: "vibrant colorful design, neon accents, dynamic composition, energetic, playful",
};

export async function generateThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult> {
  if (!AIHUBMIX_API_KEY) {
    return { success: false, error: "AIHUBMIX_API_KEY not configured" };
  }

  const style = options.style || "bold";
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.bold;

  const prompt = `YouTube thumbnail: "${options.title}". ${stylePrompt}. ${options.niche ? `Niche: ${options.niche}.` : ""} Aspect ratio 16:9, high resolution, clickable, professional quality. No text overlay.`;

  try {
    const response = await fetch(`${AIHUBMIX_BASE_URL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AIHUBMIX_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-2-free",
        prompt,
        n: 1,
        size: "1536x1024",
        quality: "auto",
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return { success: false, error: `API error ${response.status}: ${errorText}` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message || JSON.stringify(data.error) };
    }

    const imageData = data.data?.[0]?.b64_json;
    const revisedPrompt = data.data?.[0]?.revised_prompt;

    if (!imageData) {
      return { success: false, error: "No image data in response" };
    }

    return {
      success: true,
      imageData: `data:image/png;base64,${imageData}`,
      revisedPrompt,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Thumbnail generation failed",
    };
  }
}
