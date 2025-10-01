// ===== utils.js =====
// A collection of reusable helper functions.

/** Query selector helper. */
export const qs = (selector, scope = document) => scope.querySelector(selector);

/** Query selector all helper. */
export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/** Creates a seeded random number generator function. */
export function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Generates a new random seed. */
export const newSeed = () => (Date.now() >>> 0) ^ (Math.random() * 0xFFFFFFFF >>> 0);

/** Selects a random item from an array using a given RNG function. */
export const randChoice = (arr, rng) => arr[Math.floor(rng() * arr.length)];

/** Generates a random integer within a range using a given RNG function. */
export const randInt = (min, max, rng) => Math.floor(rng() * (max - min + 1)) + min;

/** Returns the URL for a role's card image. */
export const cardUrlFor = (name) => `assets/cards/${String(name).replace(/\s+/g, "-")}.png`;

/** Fetches and parses a JSON file. */
export async function loadJSON(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.statusText}`);
  return response.json();
}