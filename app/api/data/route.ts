/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

// function toSlug(name: string): string {
//   const slug = name
//     .toLowerCase() // Convert to lowercase
//     .replace(/\W+/g, "-") // Replace non-word characters with hyphens
//     .replace(/^-+|-+$/g, "")
//     .slice(0, 100); // Trim leading and trailing hyphens

//   if (slug.endsWith("-")) {
//     return slug.slice(0, -1);
//   }

//   return slug;
// }

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY!;
  const languageCode = "en";
  const endpoint = "https://places.googleapis.com/v1/places:searchText";
  const supabase = new SupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: countries, error: countryError } = await supabase
    .from("countries")
    .select("id, name, cities(id, name)").eq("id", 1).eq("cities.id", "022a561b-e8cc-451f-a453-9c7c07950394");

  if (countryError) {
    console.error("Error fetching country data:", countryError);
    return NextResponse.json({ status: 500, error: countryError.message });
  }

  for (const country of countries) {
    const cities = country.cities;
    for (const city of cities) {
      const textQuery = `spa in ${city.name}, ${country.name}`;
      const body = JSON.stringify({
        textQuery,
        languageCode,
        rankPreference: "RELEVANCE",
        minRating: 3.0,
        pageSize: 15,
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




        console.log(newPlaces.places[0].generativeSummary);
        console.log(newPlaces.places[1].generativeSummary);
        console.log(newPlaces.places[2].generativeSummary);
        console.log(newPlaces.places[3].generativeSummary);
        console.log(newPlaces.places[4].generativeSummary);
        console.log(newPlaces.places[5].generativeSummary);
        console.log(newPlaces.places[6].generativeSummary);
        console.log(newPlaces.places[7].generativeSummary);


        console.log(newPlaces.places[0].types);
        console.log(newPlaces.places[1].types);
        console.log(newPlaces.places[2].types);
        console.log(newPlaces.places[3].types);
        console.log(newPlaces.places[0].paymentOptions);
        console.log(newPlaces.places[1].paymentOptions);
        console.log(newPlaces.places[2].paymentOptions);
        console.log(newPlaces.places[3].paymentOptions);


//         if (newPlaces.places) {
//           for (const place of newPlaces.places) {
//             if (place.id && place.displayName?.text) {

// const paymentOptionsArray: string[] = [];
// if (place.paymentOptions) {
//   for (const [key, value] of Object.entries(place.paymentOptions)) {
//     if (value === true) {
//       paymentOptionsArray.push(camelToTitleCase(key));
//     }
//   }
// }
//               const formattedPlace = {
//                 id: place.id,
//                 name: place.displayName.text,
//                 slug: toSlug(place.displayName.text),
//                 international_phone_number: place.internationalPhoneNumber,
//                 address: place.formattedAddress,
//                 opening_hours: place.currentOpeningHours?.weekdayDescriptions,
//                 rating: place.rating,
//                 restroom: place.restroom,
//                 wheelchair_accessible_parking: place.accessibilityOptions?.wheelchairAccessibleParking,
//                 wheelchair_accessible_restroom: place.accessibilityOptions?.wheelchairAccessibleRestroom,
//                 wheelchair_accessible_entrance: place.accessibilityOptions?.wheelchairAccessibleEntrance,
//                 google_maps_uri: place.googleMapsUri,
//                 reviews: place.reviews,
//                 longitude: place.location?.longitude,
//                 latitude: place.location?.latitude,
//                 user_rating_count: place.userRatingCount,
//                 website_uri: place.websiteUri,
//                 descriptions: place.generativeSummary?.overview?.text,
//                 services: place.types.filter((type: string) => type !== "point_of_interest" && type !== "establishment"),
//                 payment_options: place.paymentOptions,
//                 city_id: city.id,
//                 country_id: country.id,
//               };

//               if (!formattedPlace.slug || formattedPlace.slug === "") {
//                 continue;
//               }

//               const { error: insertError } = await supabase
//                 .from("spas")
//                 .insert(formattedPlace)
//                 .select();

//               if (insertError) {
//                 console.error("Error inserting spa:", insertError);
// if (insertError.details.includes("(slug)=")) {
//                   formattedPlace.name = `${formattedPlace.name} - ${city.name}`;
//                   formattedPlace.slug = toSlug(`${formattedPlace.name}-${city.name}`);
//                   const { error: insertError3 } = await supabase
//                     .from("spas")
//                     .insert(formattedPlace);

//                   if (insertError3) {
//                     console.error("AGAIN Error inserting spa:", insertError3);
//                   } 
//                 }
//               }

//             }
//           }

//           console.log(`${city.name} - ${newPlaces.places.length} places found`);
//         } else {
//           console.log(newPlaces);
//         }
      } catch (error: any) {
        console.error("Error writing to file:", error);
        return NextResponse.json({ status: 500, error: error.message });
      }
    }
  }

  return NextResponse.json({ status: 200, message: "Data processing complete" });
}
