import type { LocalDescriptionsSearchApiResponse, LocalPoiSearchApiResponse } from 'brave-search/dist/types.js';
import type { MCPVideoResult } from './index.js';

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

export function formatVideoResults(results: MCPVideoResult[]) {
  return (results || []).map((video) => {
    return `Title: ${video.title} `
      + `URL: ${video.url} `
      + `Description: ${video.description} `
      + `Age: ${video.age} `
      + `Duration: ${video.video.duration} `
      + `Views: ${video.video.views} `
      + `Creator: ${video.video.creator} `
      + `${('requires_subscription' in video.video)
        ? (video.video.requires_subscription ? 'Requires subscription' : 'No subscription')
        : ''} `
        + `${('tags' in video.video && video.video.tags)
          ? (`Tags: ${video.video.tags.join(', ')}`)
          : ''} `
    ;
  }).join('\n---\n');
}
