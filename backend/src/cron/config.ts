export const CRON = {
  availabilityInterval: 60 * 1000,
  fullMergeInterval: 6 * 60 * 60 * 1000,
  scraperCheckInterval: 6 * 60 * 60 * 1000,
  scraperRunEveryDays: 7,
};

export const TIMEOUTS = {
  api: 30000,
  scrapeSearch: 30000,
  scrapeFetch: 30000,
  llmExtract: 240000,
  llmHealthCheck: 5000,
  sgcarmart: 30000,
  datamall: 30000,
  parkaholicRate: 10000,
};

export const SCRAPER = {
  recheckDays: 30,
  staleMonths: 1,
  dropAfterMisses: 50,
  maxSearchResults: 10,
  maxPageContentChars: 192000,
  chunkSize: 28000,
  chunkOverlap: 500,
  domains: [
    {
      domain: 'onemotoring.lta.gov.sg',
      searchQuery: 'site:onemotoring.lta.gov.sg parking rates Singapore',
      prompt: 'Extract ALL parking rates. Return name, rates with vehicle_type (car/motorcycle/heavy_vehicle), day_type, amount_dollars, per_minutes, time_start, time_end in HH:MM 24h.',
    },
    {
      domain: 'getgo.sg',
      searchQuery: 'site:getgo.sg parking rates CBD Singapore',
      prompt: 'Extract ALL parking rates. Return name, rates with vehicle_type, day_type, amount_dollars, per_minutes, time_start, time_end.',
    },
    {
      domain: 'singaporebikes.com',
      searchQuery: 'site:singaporebikes.com motorcycle parking rates guide',
      prompt: 'Extract ALL motorcycle parking entries. Each has name, address, rates. vehicle_type is always motorcycle.',
    },
    {
      domain: 'sgcarmart.com',
      searchQuery: 'site:sgcarmart.com carpark parking rates Singapore',
      prompt: 'Extract ALL parking rates. Return name, address, rates with vehicle_type, day_type, amount_dollars, per_minutes, time periods.',
    },
  ],
  smartQueries: [
    'Singapore parking rates per hour latest',
    'Singapore shopping mall carpark rates list',
    'Singapore private carpark parking charges',
    'motorcycle parking rates Singapore guide',
    'Singapore airport parking rates changi',
    'Singapore hospital parking rates',
    'Singapore university campus parking fees',
    'Singapore condo visitor parking rates',
    'Singapore industrial estate parking charges',
    'HDB season parking rates Singapore 2024',
    'Orchard Road carpark rates hourly',
    'Sentosa parking rates entrance fee',
    'Jewel Changi parking rates',
    'Singapore sports hub parking fees',
    'Singapore MRT station parking rates',
  ],
  defaultPrompt: 'Extract ALL parking rates. Return name, address, rates with vehicle_type (car/motorcycle/heavy_vehicle), day_type, amount_dollars, per_minutes, time_start, time_end in HH:MM 24h.',
};

export const SGCARMART = {
  maxId: 1230,
  concurrency: 50,
};

export const PARKAHOLIC = {
  rateConcurrency: 50,
};

export const MERGE = {
  proximityThreshold: 0.001,
};
