/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

function toSlug(name: string): string {
  const slug = name
    .toLowerCase() // Convert to lowercase
    .replace(/\W+/g, "-") // Replace non-word characters with hyphens
    .replace(/^-+|-+$/g, "")
    .slice(0, 100); // Trim leading and trailing hyphens

  if (slug.endsWith("-")) {
    return slug.slice(0, -1);
  }

  return slug;
}

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY!;
  const languageCode = "en";
  const endpoint = "https://places.googleapis.com/v1/places:searchText";
  const supabase = new SupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("name, id")
    .eq("name", "Tummy tuck")
    .single();

  if (categoryError) {
    console.error("Error fetching category data:", categoryError);
    return NextResponse.json({ status: 500, error: categoryError.message });
  }

  const { data: countries, error: countryError } = await supabase
    .from("countries")
    .select("id, name, cities(id, name)");

  if (countryError) {
    console.error("Error fetching country data:", countryError);
    return NextResponse.json({ status: 500, error: countryError.message });
  }

  for (const country of countries) {
    const cities = country.cities;
    for (const city of cities) {
      const textQuery = `${category.name} surgery clinic in ${city.name}, ${country.name}`;
      const body = JSON.stringify({
        textQuery,
        languageCode,
        rankPreference: "RELEVANCE",
        minRating: 3.0,
        pageSize: 12,
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
              const formattedPlace = {
                id: place.id,
                name: place.displayName.text,
                slug: toSlug(place.displayName.text),
                international_phone_number: place.internationalPhoneNumber,
                address: place.formattedAddress,
                opening_hours: place.currentOpeningHours?.weekdayDescriptions,
                rating: place.rating,
                restroom: place.restroom,
                wheelchair_accessible_parking: place.accessibilityOptions?.wheelchairAccessibleParking,
                wheelchair_accessible_restroom: place.accessibilityOptions?.wheelchairAccessibleRestroom,
                wheelchair_accessible_entrance: place.accessibilityOptions?.wheelchairAccessibleEntrance,
                google_maps_uri: place.googleMapsUri,
                reviews: place.reviews,
                longitude: place.location?.longitude,
                latitude: place.location?.latitude,
                user_rating_count: place.userRatingCount,
                website_uri: place.websiteUri,
                city_id: city.id,
              };

              if (!formattedPlace.slug || formattedPlace.slug === "") {
                continue;
              }

              // eslint-disable-next-line prefer-const
              let { data: clinicData, error: insertError } = await supabase
                .from("surgery_clinics")
                .insert(formattedPlace)
                .select();

              if (insertError) {
                console.error("Error inserting place:", insertError);

                if (insertError.details.includes("(id)=")) {
                  const { error: insertError4 } = await supabase.from("clinic_categories").insert({
                    clinic_id: place.id,
                    category_id: category.id,
                  });

                  if (insertError4) {
                    console.error(`Error inserting another clinic category to clinic ${place.name}:`, insertError4);
                  }
                } else if (insertError.details.includes("(slug)=")) {
                  formattedPlace.name = `${formattedPlace.name} - ${city.name}`;
                  formattedPlace.slug = toSlug(`${formattedPlace.name}-${city.name}`);
                  const { data: secondTry, error: insertError3 } = await supabase
                    .from("surgery_clinics")
                    .insert(formattedPlace)
                    .select();

                  if (insertError3) {
                    console.error("AGAIN Error inserting place:", insertError3);
                  } else if (secondTry && secondTry.length > 0) {
                    clinicData = secondTry;
                  }
                }
              }

              if (clinicData && clinicData.length > 0) {
                const { error: insertError2 } = await supabase.from("clinic_categories").insert({
                  clinic_id: clinicData[0].id,
                  category_id: category.id,
                });

                if (insertError2) {
                  console.error("Error inserting clinic category:", insertError2);
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