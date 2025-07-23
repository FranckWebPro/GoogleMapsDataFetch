import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

// Override the default caching to ensure this route is always executed when called
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY env variable" }, { status: 500 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY env variable" }, { status: 500 });
  }

  const supabase = new SupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: chargingStations, error: chargingStationsError } = await supabase
    .from("charging_stations")
    .select("id, name, formatted_address, rating, types, user_rating_count, description, slug")
    .eq("country_id", 1)
    .order("name");

  if (chargingStationsError || chargingStations.length === 0) {
    return NextResponse.json({ error: `Error fetching charging stations: ${JSON.stringify(chargingStationsError)}` }, { status: 500 });
  }

  console.log(chargingStations.length);

//   const filteredParkings = parkings.filter(p => p.description.length < 50 || p.description.length === null);

//   if (filteredParkings.length === 0) {
//     return NextResponse.json({ updated: 0, message: "No parkings matched the criteria" });
//   }

  let updatedCount = 0;
  const failures: string[] = [];

  async function generateDescription(chargingStation: {
    name: string;
    formatted_address: string;
    rating: number;
    user_rating_count: number;
    types: string;
  }): Promise<string | null> {
    const messages = [
      {
        role: "system",
        content: `You are an experienced SEO copywriter for SpotMyCharge.com, an online directory of gas and electric vehicle charging stations.
            Craft concise descriptions that highlight convenience, work procedures, services, pricing, reviews, and any other relevant details.
            Write in an informative tone, no direct talk to visitor. Do not mention that you are an AI language model.
            The description should be in English. Do not add content you're not 100% sure about.
            Avoid to add content which won't add value to the user to read. `,
      },
      {
        role: "user",
        content: `Write a plain-text description (about 80-120 words, 1-2 short paragraphs) for the following charging station.
          \nName: ${chargingStation.name}.
          \nAddress: ${chargingStation.formatted_address}.
          \nServices offered: ${chargingStation.types}.
          \nRating: ${chargingStation.rating} based on ${chargingStation.user_rating_count} reviews.
          \nInclude nearby points of interest if relevant and persuasive calls to action to reserve.
          \nImportant formatting rules:
          • Do NOT include any headings, titles, markdown, links, or URLs.
          • Start directly with the description sentence.
          • Return only the description text and nothing else.`,
      },
    ];

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
        }),
      });

      if (!response.ok) {
        console.error(`OpenAI API error ${response.status}: ${response.statusText}`);
        console.error(await response.text());
        return null;
      }

      const json = (await response.json()) as {
        choices: { message: { content: string } }[];
      };

      return json.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      console.error("OpenAI fetch error", err);
      return null;
    }
  }

  for (const chargingStation of chargingStations) {
    const newDescription = await generateDescription(chargingStation);

    if (!newDescription) {
      failures.push(chargingStation.slug as string);
      continue;
    }

    const { error: updateError } = await supabase
      .from("charging_stations")
      .update({ description: newDescription })
      .eq("id", chargingStation.id);

    if (updateError) {
      console.error(`Failed to update charging station ${chargingStation.id}:`, updateError);
      failures.push(chargingStation.slug as string);
      continue;
    }

    updatedCount += 1;
  }

  return NextResponse.json({ updated: updatedCount, failed: failures });
}