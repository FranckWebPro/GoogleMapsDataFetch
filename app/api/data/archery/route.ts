/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { toSlug } from "@/libs/utils";
import { camelToTitleCase } from "@/libs/utils";

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY!;
  const languageCode = "en";
  const endpoint = "https://places.googleapis.com/v1/places:searchText";
  const supabase = new SupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: countries, error: countryError } = await supabase
    .from("countries")
    .select("id, name, cities(id, name)").eq("id", "b07a5acf-95df-4916-8a1c-8f31fccc2156");

  if (countryError) {
    console.error("Error fetching country data:", countryError);
    return NextResponse.json({ status: 500, error: countryError.message });
  }

  for (const country of countries) {
    const cities = country.cities;
    for (const city of cities) {
      const textQuery = `Archery range in ${city.name}, ${country.name}`;
      const body = JSON.stringify({
        textQuery,
        languageCode,
        rankPreference: "RELEVANCE",
        minRating: 3.0,
        pageSize: 20,
      });

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places",
          },
          body,
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error from Google Places API:", errorData);
          return NextResponse.json({ status: response.status, error: errorData });
        }

        const newPlaces = await response.json(); 
 
        if (newPlaces.places) {
          for (const place of newPlaces.places) {
            if (place.id && place.displayName?.text) {

        const paymentOptionsArray: string[] = [];
        if (place.paymentOptions) {
        for (const [key, value] of Object.entries(place.paymentOptions)) {
            if (value === true) {
            paymentOptionsArray.push(camelToTitleCase(key));
            }
        }

        }
              const formattedPlace = {
                id: place.id,
                name: place.displayName.text,
                slug: toSlug(place.displayName.text),
                international_phone_number: place.internationalPhoneNumber,
                formatted_address: place.formattedAddress,
                opening_hours: place.currentOpeningHours?.weekdayDescriptions,
                rating: place.rating,
                user_rating_count: place.userRatingCount,
                website_uri: place.websiteUri,
                google_maps_uri: place.googleMapsUri,
                description: place.generativeSummary?.overview?.text,
                types: place.types.filter((type: string) => type !== "point_of_interest" && type !== "establishment").join(", "),
                wheelchair_accessible_entrance: place?.accessibilityOptions?.wheelchairAccessibleEntrance === true,
                wheelchair_accessible_parking: place?.accessibilityOptions?.wheelchairAccessibleParking === true,
                wheelchair_accessible_restroom: place?.accessibilityOptions?.wheelchairAccessibleRestroom === true,
                accepts_credit_card: place.paymentOptions?.creditCard === true,
                accepts_nfc: place.paymentOptions?.nfc === true,
                city_id: city.id,
                published: true,
                country_id: country.id,
              };

              if (!formattedPlace.slug || formattedPlace.slug === "") {
                continue;
              }

              const { error: insertError } = await supabase
                .from("archery_ranges")
                .insert(formattedPlace)
                .select();

              if (insertError) {
                console.error("Error inserting archery range:", insertError);
                if (insertError.details && insertError.details.includes("(slug)=")) {
                  formattedPlace.name = `${formattedPlace.name} - ${city.name}`;
                  formattedPlace.slug = toSlug(`${formattedPlace.name}-${city.name}`);
                  const { error: insertError3 } = await supabase
                    .from("archery_ranges")
                    .insert(formattedPlace);

                  if (insertError3) {
                    console.error("AGAIN Error inserting archery range:", insertError3);
                  } 
                }
              }

            }
          }

          console.log(`${city.name} - ${newPlaces.places.length} places found`);
        } else {
          console.log(newPlaces);
        }
      } catch (error: any) {
        console.error("Error writing to file:", error);
        return NextResponse.json({ status: 500, error: error.message });
      }
    }
  }

  return NextResponse.json({ status: 200, message: "Data processing complete" });
}
