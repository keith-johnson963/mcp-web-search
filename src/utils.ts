import type { LocalDescriptionsSearchApiResponse, LocalPoiSearchApiResponse, VideoResult } from 'brave-search/dist/types.js';

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

export function formatVideoResults(results: VideoResult[]) {
  return (results || []).map((video) => {
    return `Title: ${video.title}\n`
      + `URL: ${video.url}\n`
      + `Description: ${video.description}\n`
      + `Age: ${video.age}\n`
      + `Duration: ${video.video.duration}\n`
      + `Views: ${video.video.views}\n`
      + `Creator: ${video.video.creator}\n`
      + `${('requires_subscription' in video.video)
        ? (video.video.requires_subscription ? 'Requires subscription\n' : 'No subscription\n')
        : ''} `
        + `${('tags' in video.video && video.video.tags)
          ? (`Tags: ${video.video.tags.join(', ')}`)
          : ''} `
    ;
  }).join('\n---\n');
}
