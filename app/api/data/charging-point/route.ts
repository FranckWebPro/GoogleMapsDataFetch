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
    .select("id, name, cities(id, name, charging_points(id))")
    .eq("id", 1);

  if (countryError) {
    console.error("Error fetching country data:", countryError);
    return NextResponse.json({ status: 500, error: countryError.message });
  }

  for (const country of countries) {
    const cities = country.cities;

    for (const city of cities) {
      const textQuery = `ev charging station in ${city.name}, ${country.name}`;
      const body = JSON.stringify({
        textQuery,
        languageCode,
        includedType: "electric_vehicle_charging_station",
        rankPreference: "RELEVANCE",
        minRating: 2.5,
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
              const newCategorySlug = "ev-charging-station";

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
                description: place.generativeSummary?.overview?.text,
                fuel_options: place.fuelOptions,
                charge_options: place.chargeOptions,
                services: place.types.filter((type: string) => type !== "point_of_interest" && type !== "establishment"),
                payment_options: paymentOptionsArray,
                city_id: city.id,
                categories: [newCategorySlug],
                country_id: country.id,
              };

              if (!formattedPlace.slug || formattedPlace.slug === "") {
                continue;
              }

              // Check if charging point already exists
              const { data: existingPoint, error: fetchPointError } = await supabase
                .from("charging_points")
                .select("categories")
                .eq("id", formattedPlace.id)
                .maybeSingle();

              if (fetchPointError) {
                console.error("Error checking existing charging_points:", fetchPointError);
              }

              if (existingPoint) {
                const currentCategories: string[] = existingPoint.categories ?? [];
                if (!currentCategories.includes(newCategorySlug)) {
                  const { error: updateError } = await supabase
                    .from("charging_points")
                    .update({ categories: [...currentCategories, newCategorySlug] })
                    .eq("id", formattedPlace.id);

                  if (updateError) {
                    console.error("Error updating categories for existing charging_points:", updateError);
                  }
                }
                continue;
              }

              const baseName = `${place.displayName.text} - ${city.name}`;
              let attempt = 0;
              let insertError: any;

              // Start with the base name/slug (no suffix), then append a number
              // that increments on every duplicate-slug error (base-name-1, 2 …).
              formattedPlace.slug = toSlug(baseName);

              do {
                const { error } = await supabase
                  .from("charging_points")
                  .insert(formattedPlace)
                  .select();

                insertError = error;

                if (insertError && insertError.details?.includes("(slug)=")) {
                  attempt += 1;
                  formattedPlace.name = `${baseName}-${attempt}`;
                  formattedPlace.slug = toSlug(formattedPlace.name);
                } else if (insertError) {
                  console.error("Error inserting charging_points:", insertError);
                }
              } while (insertError && insertError.details?.includes("(slug)="));

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
