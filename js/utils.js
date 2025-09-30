// ===== utils.js =====
// A collection of reusable helper functions.

// --- DOM Helpers ---
export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

// --- RNG (Seeded Random Number Generator) ---
export function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const newSeed = () => (Date.now() >>> 0) ^ (Math.random() * 0xFFFFFFFF >>> 0);
export const randChoice = (arr, rng) => arr[Math.floor(rng() * arr.length)];
export const randInt = (min, max, rng) => Math.floor(rng() * (max - min + 1)) + min;

// --- Asset & Data Loading ---
export const cardUrlFor = (name) => `assets/cards/${String(name).replace(/\s+/g, "-")}.png`;

export async function loadJSON(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.statusText}`);
  return response.json();
}