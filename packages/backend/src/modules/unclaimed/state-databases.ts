export interface StateDatabase {
  name: string;
  abbreviation: string;
  url: string;
  searchUrl: string;
  apiAvailable: boolean;
}

export const STATE_DATABASES: Record<string, StateDatabase> = {
  AL: {
    name: 'Alabama',
    abbreviation: 'AL',
    url: 'https://unclaimedproperty.alabama.gov',
    searchUrl: 'https://unclaimedproperty.alabama.gov/Search',
    apiAvailable: false,
  },
  AK: {
    name: 'Alaska',
    abbreviation: 'AK',
    url: 'https://unclaimedproperty.alaska.gov',
    searchUrl: 'https://unclaimedproperty.alaska.gov/Search',
    apiAvailable: false,
  },
  AZ: {
    name: 'Arizona',
    abbreviation: 'AZ',
    url: 'https://azdor.gov/unclaimed-property',
    searchUrl: 'https://azdor.gov/unclaimed-property/search',
    apiAvailable: false,
  },
  AR: {
    name: 'Arkansas',
    abbreviation: 'AR',
    url: 'https://www.claimit.arkansas.gov',
    searchUrl: 'https://www.claimit.arkansas.gov/app/claim-search',
    apiAvailable: false,
  },
  CA: {
    name: 'California',
    abbreviation: 'CA',
    url: 'https://sco.ca.gov/upd_msg.html',
    searchUrl: 'https://ucpi.sco.ca.gov/ucp/Default.aspx',
    apiAvailable: false,
  },
  CO: {
    name: 'Colorado',
    abbreviation: 'CO',
    url: 'https://colorado.findyourunclaimedproperty.com',
    searchUrl: 'https://colorado.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  CT: {
    name: 'Connecticut',
    abbreviation: 'CT',
    url: 'https://portal.ct.gov/OTT/Unclaimed-Property',
    searchUrl: 'https://ctbiglist.com',
    apiAvailable: false,
  },
  DE: {
    name: 'Delaware',
    abbreviation: 'DE',
    url: 'https://unclaimedproperty.delaware.gov',
    searchUrl: 'https://unclaimedproperty.delaware.gov/Search',
    apiAvailable: false,
  },
  DC: {
    name: 'District of Columbia',
    abbreviation: 'DC',
    url: 'https://cfo.dc.gov/page/unclaimed-property-holder-reporting',
    searchUrl: 'https://dc.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  FL: {
    name: 'Florida',
    abbreviation: 'FL',
    url: 'https://fltreasurehunt.gov',
    searchUrl: 'https://fltreasurehunt.gov/Property/Search',
    apiAvailable: false,
  },
  GA: {
    name: 'Georgia',
    abbreviation: 'GA',
    url: 'https://dor.georgia.gov/unclaimed-property',
    searchUrl: 'https://georgia.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  HI: {
    name: 'Hawaii',
    abbreviation: 'HI',
    url: 'https://budget.hawaii.gov/unclaimed-property',
    searchUrl: 'https://hawaii.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  ID: {
    name: 'Idaho',
    abbreviation: 'ID',
    url: 'https://sto.idaho.gov/unclaimed-property',
    searchUrl: 'https://yourmoney.idaho.gov/Search',
    apiAvailable: false,
  },
  IL: {
    name: 'Illinois',
    abbreviation: 'IL',
    url: 'https://icash.illinoistreasurer.gov',
    searchUrl: 'https://icash.illinoistreasurer.gov/app/claim-search',
    apiAvailable: false,
  },
  IN: {
    name: 'Indiana',
    abbreviation: 'IN',
    url: 'https://indianaunclaimed.gov',
    searchUrl: 'https://indianaunclaimed.gov/app/claim-search',
    apiAvailable: false,
  },
  IA: {
    name: 'Iowa',
    abbreviation: 'IA',
    url: 'https://greatiowatreasurehunt.gov',
    searchUrl: 'https://greatiowatreasurehunt.gov/app/claim-search',
    apiAvailable: false,
  },
  KS: {
    name: 'Kansas',
    abbreviation: 'KS',
    url: 'https://kansascash.ks.gov',
    searchUrl: 'https://kansascash.ks.gov/app/claim-search',
    apiAvailable: false,
  },
  KY: {
    name: 'Kentucky',
    abbreviation: 'KY',
    url: 'https://treasury.ky.gov/unclaimedproperty',
    searchUrl: 'https://treasury.ky.gov/unclaimedproperty/Search',
    apiAvailable: false,
  },
  LA: {
    name: 'Louisiana',
    abbreviation: 'LA',
    url: 'https://treasury.la.gov/unclaimed-property',
    searchUrl: 'https://louisiana.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  ME: {
    name: 'Maine',
    abbreviation: 'ME',
    url: 'https://maineunclaimedproperty.gov',
    searchUrl: 'https://maineunclaimedproperty.gov/app/claim-search',
    apiAvailable: false,
  },
  MD: {
    name: 'Maryland',
    abbreviation: 'MD',
    url: 'https://marylandtaxes.gov/unclaimed-property',
    searchUrl: 'https://interactive.marylandtaxes.gov/Unclaimed/Default.aspx',
    apiAvailable: false,
  },
  MA: {
    name: 'Massachusetts',
    abbreviation: 'MA',
    url: 'https://findmassmoney.com',
    searchUrl: 'https://findmassmoney.com/app/claim-search',
    apiAvailable: false,
  },
  MI: {
    name: 'Michigan',
    abbreviation: 'MI',
    url: 'https://unclaimedproperty.michigan.gov',
    searchUrl: 'https://unclaimedproperty.michigan.gov/Search',
    apiAvailable: false,
  },
  MN: {
    name: 'Minnesota',
    abbreviation: 'MN',
    url: 'https://mn.gov/commerce/consumers/unclaimed-property',
    searchUrl: 'https://minnesota.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  MS: {
    name: 'Mississippi',
    abbreviation: 'MS',
    url: 'https://treasury.ms.gov/unclaimed-property',
    searchUrl: 'https://mississippi.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  MO: {
    name: 'Missouri',
    abbreviation: 'MO',
    url: 'https://treasurer.mo.gov/unclaimedproperty',
    searchUrl: 'https://treasurer.mo.gov/unclaimedproperty/Search',
    apiAvailable: false,
  },
  MT: {
    name: 'Montana',
    abbreviation: 'MT',
    url: 'https://tap.dor.mt.gov/unclaimedproperty',
    searchUrl: 'https://montana.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  NE: {
    name: 'Nebraska',
    abbreviation: 'NE',
    url: 'https://treasurer.nebraska.gov/up',
    searchUrl: 'https://treasurer.nebraska.gov/up/Search.aspx',
    apiAvailable: false,
  },
  NV: {
    name: 'Nevada',
    abbreviation: 'NV',
    url: 'https://unclaimedproperty.nv.gov',
    searchUrl: 'https://nevadatreasurer.gov/UPSearch',
    apiAvailable: false,
  },
  NH: {
    name: 'New Hampshire',
    abbreviation: 'NH',
    url: 'https://www.nh.gov/treasury/unclaimed-property',
    searchUrl: 'https://newhampshire.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  NJ: {
    name: 'New Jersey',
    abbreviation: 'NJ',
    url: 'https://unclaimedproperty.nj.gov',
    searchUrl: 'https://unclaimedproperty.nj.gov/Search',
    apiAvailable: false,
  },
  NM: {
    name: 'New Mexico',
    abbreviation: 'NM',
    url: 'https://nmpossession.com',
    searchUrl: 'https://nmpossession.com/app/claim-search',
    apiAvailable: false,
  },
  NY: {
    name: 'New York',
    abbreviation: 'NY',
    url: 'https://osc.ny.gov/unclaimed-funds',
    searchUrl: 'https://ouf.osc.ny.gov/ouf',
    apiAvailable: false,
  },
  NC: {
    name: 'North Carolina',
    abbreviation: 'NC',
    url: 'https://www.nccash.com',
    searchUrl: 'https://www.nccash.com/search',
    apiAvailable: false,
  },
  ND: {
    name: 'North Dakota',
    abbreviation: 'ND',
    url: 'https://land.nd.gov/unclaimed-property',
    searchUrl: 'https://northdakota.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  OH: {
    name: 'Ohio',
    abbreviation: 'OH',
    url: 'https://com.ohio.gov/divisions-and-programs/unclaimed-funds',
    searchUrl: 'https://unclaimedproperty.ohio.gov/Search',
    apiAvailable: false,
  },
  OK: {
    name: 'Oklahoma',
    abbreviation: 'OK',
    url: 'https://oklahoma.gov/treasurer/unclaimed-property.html',
    searchUrl: 'https://oklahoma.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  OR: {
    name: 'Oregon',
    abbreviation: 'OR',
    url: 'https://oregon.gov/dsl/unclaimed-property',
    searchUrl: 'https://oregonup.us/Search',
    apiAvailable: false,
  },
  PA: {
    name: 'Pennsylvania',
    abbreviation: 'PA',
    url: 'https://patreasury.gov/unclaimed-property',
    searchUrl: 'https://patreasury.gov/unclaimed-property/Search',
    apiAvailable: false,
  },
  RI: {
    name: 'Rhode Island',
    abbreviation: 'RI',
    url: 'https://treasury.ri.gov/unclaimed-property',
    searchUrl: 'https://findritreasure.com/app/claim-search',
    apiAvailable: false,
  },
  SC: {
    name: 'South Carolina',
    abbreviation: 'SC',
    url: 'https://treasurer.sc.gov/unclaimed-property',
    searchUrl: 'https://southcarolina.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  SD: {
    name: 'South Dakota',
    abbreviation: 'SD',
    url: 'https://sdtreasurer.gov/unclaimed-property',
    searchUrl: 'https://southdakota.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  TN: {
    name: 'Tennessee',
    abbreviation: 'TN',
    url: 'https://claimittn.gov',
    searchUrl: 'https://claimittn.gov/app/claim-search',
    apiAvailable: false,
  },
  TX: {
    name: 'Texas',
    abbreviation: 'TX',
    url: 'https://claimittexas.org',
    searchUrl: 'https://claimittexas.org/app/claim-search',
    apiAvailable: false,
  },
  UT: {
    name: 'Utah',
    abbreviation: 'UT',
    url: 'https://mycash.utah.gov',
    searchUrl: 'https://mycash.utah.gov/Search',
    apiAvailable: false,
  },
  VT: {
    name: 'Vermont',
    abbreviation: 'VT',
    url: 'https://vermonttreasurer.gov/unclaimed-property',
    searchUrl: 'https://vermont.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  VA: {
    name: 'Virginia',
    abbreviation: 'VA',
    url: 'https://vamoneysearch.org',
    searchUrl: 'https://vamoneysearch.org/Search',
    apiAvailable: false,
  },
  WA: {
    name: 'Washington',
    abbreviation: 'WA',
    url: 'https://ucp.dor.wa.gov',
    searchUrl: 'https://ucp.dor.wa.gov/Search',
    apiAvailable: false,
  },
  WV: {
    name: 'West Virginia',
    abbreviation: 'WV',
    url: 'https://wvtreasury.com/unclaimed-property',
    searchUrl: 'https://westvirginia.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  WI: {
    name: 'Wisconsin',
    abbreviation: 'WI',
    url: 'https://statetreasurer.wi.gov/unclaimed-property',
    searchUrl: 'https://wisconsin.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
  WY: {
    name: 'Wyoming',
    abbreviation: 'WY',
    url: 'https://treasurer.wyo.gov/unclaimed-property',
    searchUrl: 'https://wyoming.findyourunclaimedproperty.com/app/claim-search',
    apiAvailable: false,
  },
};

export function getStateSearchUrl(
  state: string,
  firstName?: string,
  lastName?: string,
): string | null {
  const stateDb = STATE_DATABASES[state.toUpperCase()];
  if (!stateDb) return null;
  return stateDb.searchUrl;
}

export function getSupportedStates(): Array<{
  abbreviation: string;
  name: string;
  url: string;
}> {
  return Object.values(STATE_DATABASES).map((s) => ({
    abbreviation: s.abbreviation,
    name: s.name,
    url: s.url,
  }));
}
