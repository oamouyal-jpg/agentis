import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("KEY RAW:", JSON.stringify(apiKey));
console.log("KEY PREFIX:", apiKey ? apiKey.slice(0, 12) : "none");
console.log("KEY LENGTH:", apiKey ? apiKey.length : 0);
  console.log("OPENAI KEY LOADED:", !!apiKey);
  if (!apiKey) return null;

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}

export async function generateJson<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T | null> {
  const openai = getClient();
  if (!openai) return null;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content) as T;
  } catch (error) {
    console.error("AI generation failed:", error);
    return null;
  }
}