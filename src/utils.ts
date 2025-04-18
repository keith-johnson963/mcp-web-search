import type { LocalDescriptionsSearchApiResponse, LocalPoiSearchApiResponse, OpeningHours } from 'brave-search/dist/types.js';
import type { BraveVideoResult } from './tools/BraveVideoSearchTool.js';

export function formatPoiResults(poiData: LocalPoiSearchApiResponse, poiDesc: LocalDescriptionsSearchApiResponse) {
  return (poiData.results || []).map((poi) => {
    const description = poiDesc.results.find(locationDescription => locationDescription.id === poi.id);
    return `Name: ${poi.title}\n`
      + `${poi.serves_cuisine ? `Cuisine: ${poi.serves_cuisine.join(', ')}\n` : ''}`
      + `Address: ${poi.postal_address.displayAddress}\n`
      + `Phone: ${poi.contact?.telephone || 'No phone number found'}\n`
      + `Email: ${poi.contact?.email || 'No email found'}\n`
      + `Price Range: ${poi.price_range || 'No price range found'}\n`
      + `Ratings: ${poi.rating?.ratingValue || 'N/A'} (${poi.rating?.reviewCount}) reviews\n`
      + `Hours:\n ${(poi.opening_hours) ? formatOpeningHours(poi.opening_hours).join('\n') : 'No opening hours found'}\n`
      + `Description: ${(description) ? description.description : 'No description found'}\n`;
  }).join('\n---\n');
}

export function formatVideoResults(results: BraveVideoResult[]) {
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

function formatOpeningHours(data: OpeningHours): string[] {
  const WEEK_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Build a lookup map: abbr_name → { full_name, intervals, isToday }
  const lookup: Record<string, {
    full_name: string;
    intervals: { opens: string; closes: string }[];
    isToday: boolean;
  }> = {};

  // Populate from the weekly days
  data.days.forEach((daySlots) => {
    if (!daySlots.length)
      return;
    const { abbr_name, full_name } = daySlots[0];
    lookup[abbr_name] = {
      full_name,
      intervals: daySlots.map(d => ({ opens: d.opens, closes: d.closes })),
      isToday: false,
    };
  });

  // Override today’s entry and mark it
  if (data.current_day.length) {
    const todayAbbr = data.current_day[0].abbr_name;
    const todayFull = data.current_day[0].full_name;
    const todaySlots = data.current_day.map(d => ({ opens: d.opens, closes: d.closes }));
    lookup[todayAbbr] = {
      full_name: todayFull,
      intervals: todaySlots,
      isToday: true,
    };
  }

  // Sort days Mon→Sun, filtering out any missing
  const sorted = WEEK_ORDER
    .map(abbr => lookup[abbr])
    .filter(Boolean);

  // Helper: compare two arrays of {opens,closes}
  const sameIntervals = (
    a: { opens: string; closes: string }[],
    b: { opens: string; closes: string }[],
  ): boolean => {
    if (a.length !== b.length)
      return false;
    return a.every((slot, i) =>
      slot.opens === b[i].opens && slot.closes === b[i].closes,
    );
  };

  // Group consecutive days with identical intervals
  interface Group {
    days: string[];
    intervals: { opens: string; closes: string }[];
    isToday: boolean;
  }
  const groups: Group[] = [];
  let current: Group | null = null;

  for (const day of sorted) {
    if (
      current
      && sameIntervals(current.intervals, day.intervals)
    ) {
      // extend current group
      current.days.push(day.full_name);
      current.isToday ||= day.isToday;
    }
    else {
      // push previous and start new
      if (current)
        groups.push(current);
      current = {
        days: [day.full_name],
        intervals: day.intervals,
        isToday: day.isToday,
      };
    }
  }
  if (current)
    groups.push(current);

  // Render each group
  return groups.map((g) => {
    const dayLabel = g.days.length > 1
      ? `${g.days[0]}–${g.days[g.days.length - 1]}`
      : g.days[0];
    const hoursLabel = g.intervals
      .map(slot => `${slot.opens}–${slot.closes}`)
      .join(', ');
    const todayMark = g.isToday ? ' (today)' : '';
    return `${dayLabel}: ${hoursLabel}${todayMark}`;
  });
}
