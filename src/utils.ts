import type { LocalDescriptionsSearchApiResponse, LocalPoiSearchApiResponse } from 'brave-search/dist/types.js';

export function formatPoiResults(poiData: LocalPoiSearchApiResponse, poiDesc: LocalDescriptionsSearchApiResponse) {
  return (poiData.results || []).map((poi) => {
    const description = poiDesc.results.find(localtionDescription => localtionDescription.id === poi.id);
    return `Name: ${poi.title}`
      + `${poi.serves_cuisine ? `Cuisine: ${poi.serves_cuisine.join(', ')}` : ''}`
      + `Address: ${poi.postal_address.displayAddress}`
      + `Phone: ${poi.contact?.telephone || 'No phone number found'}`
      + `Email: ${poi.contact?.email || 'No email found'}`
      + `Price Range: ${poi.price_range || 'No price range found'}`
      + `Ratings: ${poi.rating?.ratingValue || 'N/A'} (${poi.rating?.reviewCount}) reviews`
      + `Hours: ${(poi.opening_hours) ? JSON.stringify(poi.opening_hours, null, 2) : 'No opening hours found'}`
      + `Description: ${(description) ? description.description : 'No description found'}`;
  }).join('\n---\n');
}
