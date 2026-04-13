/**
 * Copyright 2026 Daniel Smith
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { AlapConfig } from 'alap/core';
import { atprotoHandler } from 'alap';

export const demoConfig: AlapConfig = {
  settings: {
    listType: 'ul',
    menuTimeout: 8000,
  },

  macros: {
    cars: { linkItems: 'vwbug, bmwe36, miata' },
    favorites: { linkItems: 'goldengate, bluebottle, highline, spaceneedle' },
  },

  protocols: {
    atproto: {
      generate: atprotoHandler,
      cache: 5,
      accessJwt: null,
      searches: {},
    },
  },

  allLinks: {
    // --- Cars ---

    vwbug: {
      label: 'VW Bug — Wikipedia',
      url: 'https://en.wikipedia.org/wiki/Volkswagen_Beetle',
      tags: ['car', 'vw', 'germany'],
      description: 'The people\'s car — over 21 million produced, making it the longest-running and most-manufactured car on a single platform.',
    },
    bmwe36: {
      label: 'BMW E36 — Wikipedia',
      url: 'https://en.wikipedia.org/wiki/BMW_3_Series_(E36)',
      tags: ['car', 'bmw', 'germany'],
      description: 'The third generation 3 Series, produced from 1990 to 2000. A favorite among enthusiasts for its balance and tunability.',
    },
    miata: {
      label: 'Mazda Miata — Wikipedia',
      url: 'https://en.wikipedia.org/wiki/Mazda_MX-5',
      tags: ['car', 'mazda', 'japan'],
      description: 'The best-selling two-seat convertible sports car in history. Miata Is Always The Answer.',
    },

    // --- NYC ---

    brooklyn: {
      label: 'Brooklyn Bridge',
      url: 'https://en.wikipedia.org/wiki/Brooklyn_Bridge',
      tags: ['nyc', 'bridge', 'landmark'],
      description: 'Opened in 1883, connecting Manhattan and Brooklyn over the East River. One of the oldest roadway bridges in the United States.',
      thumbnail: '../shared/img/brooklyn.jpg',
      meta: { photoCredit: 'Hannes Richter', photoCreditUrl: 'https://unsplash.com/@harimedia' },
    },
    manhattan: {
      label: 'Manhattan Bridge',
      url: 'https://en.wikipedia.org/wiki/Manhattan_Bridge',
      tags: ['nyc', 'bridge'],
      description: 'A suspension bridge crossing the East River, connecting Lower Manhattan with Downtown Brooklyn.',
      thumbnail: '../shared/img/manhattan.jpg',
      meta: { photoCredit: 'YM', photoCreditUrl: 'https://unsplash.com/@ymoran' },
    },
    highline: {
      label: 'The High Line',
      url: 'https://en.wikipedia.org/wiki/High_Line',
      tags: ['nyc', 'park', 'landmark'],
      description: 'An elevated linear park built on a historic freight rail line on the west side of Manhattan.',
      thumbnail: '../shared/img/highline.jpg',
      meta: { photoCredit: 'lo lindo', photoCreditUrl: 'https://unsplash.com/@lolindo' },
    },
    centralpark: {
      label: 'Central Park',
      url: 'https://en.wikipedia.org/wiki/Central_Park',
      tags: ['nyc', 'park'],
      description: 'An 843-acre urban park in the heart of Manhattan, the most visited urban park in the United States.',
      thumbnail: '../shared/img/centralpark.jpg',
      meta: { photoCredit: 'Harry Gillen', photoCreditUrl: 'https://unsplash.com/@gillenha' },
    },

    // --- SF ---

    goldengate: {
      label: 'Golden Gate Bridge',
      url: 'https://en.wikipedia.org/wiki/Golden_Gate_Bridge',
      tags: ['sf', 'bridge', 'landmark'],
      description: 'Spanning the Golden Gate strait, this 1937 suspension bridge is an internationally recognized symbol of San Francisco.',
      thumbnail: '../shared/img/goldengate.jpg',
      meta: { photoCredit: 'Maarten van den Heuvel', photoCreditUrl: 'https://unsplash.com/@mvdheuvel' },
    },
    dolores: {
      label: 'Dolores Park',
      url: 'https://en.wikipedia.org/wiki/Dolores_Park',
      tags: ['sf', 'park'],
      description: 'A city park in the Mission District with views of downtown San Francisco and the East Bay.',
      thumbnail: '../shared/img/dolores.jpg',
      meta: { photoCredit: 'Leo Korman', photoCreditUrl: 'https://unsplash.com/@leokorman' },
    },

    // --- Coffee ---

    aqus: {
      label: 'Aqus Cafe',
      url: 'https://aqus.com',
      tags: ['coffee', 'sf'],
      description: 'A worker-owned cooperative cafe in Petaluma, California. Community gathering spot since 2003.',
    },
    bluebottle: {
      label: 'Blue Bottle Coffee',
      url: 'https://bluebottlecoffee.com',
      tags: ['coffee', 'sf', 'nyc'],
      description: 'Third-wave coffee roaster founded in Oakland in 2002. Known for single-origin beans and minimalist cafes.',
      thumbnail: '../shared/img/bluebottle.jpg',
      meta: { photoCredit: 'Braden Collum', photoCreditUrl: 'https://unsplash.com/@bradencollum' },
    },
    acre: {
      label: 'Acre Coffee',
      url: 'https://acrecoffee.com',
      tags: ['coffee'],
      description: 'Petaluma-born roaster with a focus on ethically sourced, small-batch beans and a warm neighborhood vibe.',
    },
    stumptown: {
      label: 'Stumptown Coffee',
      url: 'https://stumptowncoffee.com',
      tags: ['coffee', 'portland'],
      description: 'Portland-based roaster known for direct trade sourcing and hair bender espresso blend.',
      thumbnail: '../shared/img/stumptown.jpg',
      meta: { photoCredit: 'Jordan Ringo', photoCreditUrl: 'https://unsplash.com/@jordyringo' },
    },

    // --- Seattle ---

    spaceneedle: {
      label: 'Space Needle',
      url: 'https://en.wikipedia.org/wiki/Space_Needle',
      tags: ['seattle', 'landmark'],
      description: 'Built for the 1962 World\'s Fair, this 605-foot observation tower defines the Seattle skyline.',
      thumbnail: '../shared/img/spaceneedle.jpg',
      meta: { photoCredit: 'Andrea Leopardi', photoCreditUrl: 'https://unsplash.com/@whatyouhide' },
    },
    pikeplace: {
      label: 'Pike Place Market',
      url: 'https://en.wikipedia.org/wiki/Pike_Place_Market',
      tags: ['seattle', 'landmark'],
      description: 'One of the oldest continuously operated public farmers\' markets in the US, opened in 1907 overlooking Elliott Bay.',
      thumbnail: '../shared/img/pikeplace.jpg',
      meta: { photoCredit: 'Doctor Tinieblas', photoCreditUrl: 'https://unsplash.com/@doctortinieblas' },
    },

    // --- Portland ---

    stjohns: {
      label: 'St. Johns Bridge',
      url: 'https://en.wikipedia.org/wiki/St._Johns_Bridge',
      tags: ['portland', 'bridge', 'landmark'],
      description: 'A Gothic Revival suspension bridge spanning the Willamette River, with 400-foot towers inspired by medieval cathedrals.',
      thumbnail: '../shared/img/stjohns.jpg',
      meta: { photoCredit: 'Kevin Butz', photoCreditUrl: 'https://unsplash.com/@kevin_butz' },
    },

    // --- Tokyo ---

    rainbowbridge: {
      label: 'Rainbow Bridge',
      url: 'https://en.wikipedia.org/wiki/Rainbow_Bridge_(Tokyo)',
      tags: ['tokyo', 'bridge', 'landmark'],
      description: 'A suspension bridge spanning Tokyo Bay between Shibaura Pier and Odaiba, lit in white at night against the city skyline.',
      thumbnail: '../shared/img/rainbowbridge.jpg',
      meta: { photoCredit: 'Se. Tsuchiya', photoCreditUrl: 'https://unsplash.com/@s_tsuchiya' },
    },

    // --- London ---

    towerbridge: {
      label: 'Tower Bridge',
      url: 'https://en.wikipedia.org/wiki/Tower_Bridge',
      tags: ['london', 'bridge', 'landmark'],
      description: 'A combined bascule and suspension bridge over the Thames, built in 1894 with Victorian Gothic towers.',
      thumbnail: '../shared/img/towerbridge.jpg',
      meta: { photoCredit: 'Flavio Vallone', photoCreditUrl: 'https://unsplash.com/@fotartistadigitale' },
    },

    // --- Paris ---

    pontneuf: {
      label: 'Pont Neuf',
      url: 'https://en.wikipedia.org/wiki/Pont_Neuf',
      tags: ['paris', 'bridge', 'landmark'],
      description: 'The oldest standing bridge across the Seine in Paris, completed in 1607 despite its name meaning "New Bridge."',
      thumbnail: '../shared/img/pontneuf.jpg',
      meta: { photoCredit: 'Rachel Calvo', photoCreditUrl: 'https://unsplash.com/@rachelcalvophoto' },
    },

    // --- Sydney ---

    harbourbridge: {
      label: 'Sydney Harbour Bridge',
      url: 'https://en.wikipedia.org/wiki/Sydney_Harbour_Bridge',
      tags: ['sydney', 'bridge', 'landmark'],
      description: 'The world\'s largest steel arch bridge, connecting Sydney\'s CBD to the North Shore across the harbour since 1932.',
      thumbnail: '../shared/img/harbourbridge.jpg',
      meta: { photoCredit: 'Halley Tian', photoCreditUrl: 'https://unsplash.com/@stia004' },
    },
  },
};
