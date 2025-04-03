import type { DayOpeningHours, LocationResult } from 'brave-search/dist/types.js';

export function formatLocationResult(locationResult: LocationResult) {
  return `Name: ${locationResult.title}\n
  Address: ${locationResult.postal_address.displayAddress}\n
  Phone: ${locationResult.contact?.telephone || 'No phone number found'}\n
  Email: ${locationResult.contact?.email || 'No email found'}\n
  ${formatOpeningHours(locationResult)}
  ${formatPriceRange(locationResult)}
  ${formatRating(locationResult)}
  ${formatCuisine(locationResult)}`;
}

function formatOpeningHours(locationResult: LocationResult) {
  if (locationResult.opening_hours) {
    return `Opening Hours:\n
    Today: ${formatDayOpeningHours(locationResult.opening_hours.current_day)}
    Weekly: ${formatDayOpeningHours2D(locationResult.opening_hours.days)}`;
  }
  return '';
}

function formatDayOpeningHours2D(dayOpeningHours: DayOpeningHours[][]) {
  return dayOpeningHours.map(hours => formatDayOpeningHours(hours));
}

function formatDayOpeningHours(dayOpeningHours: DayOpeningHours[]) {
  return dayOpeningHours.map(formatDayOpeningHour).join('\n');
}

function formatDayOpeningHour(dayOpeningHours: DayOpeningHours) {
  if (dayOpeningHours) {
    return `${dayOpeningHours.full_name} Opens: ${dayOpeningHours.opens} Closes: ${dayOpeningHours.closes}\n`;
  }
  return '';
}

function formatPriceRange(locationResult: LocationResult) {
  if (locationResult.price_range) {
    return `Price Range: ${locationResult.price_range}\n`;
  }
  return '';
}

function formatRating(locationResult: LocationResult) {
  if (locationResult.rating) {
    return `Rating: Current ${locationResult.rating.ratingValue} Count ${locationResult.rating.reviewCount}\n`;
  }
  return '';
}

function formatCuisine(locationResult: LocationResult) {
  if (locationResult.serves_cuisine) {
    return `Cuisine: ${locationResult.serves_cuisine.join(',')}\n`;
  }
  return '';
}
