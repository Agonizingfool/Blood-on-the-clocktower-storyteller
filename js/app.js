// ===== app.js =====
// Main application logic, state management, and event handling.

import * as utils from './utils.js';
import * as ui from './ui.js';

// --- App State ---
let DATA = null;
let RNG = null;
const STEP_STATE = new Map();
let POISONED_ROLE_FOR_NIGHT = null;

// --- DOM Element References ---
const DOMElements = {
    roleForm: utils.qs("#roleForm"),
    generateBtn: utils.qs("#generateBtn"),
    resetBtn: utils.qs("#resetBtn"),
    toggleMetaBtn: utils.qs("#toggleMetaBtn"),
    firstNightList: utils.qs("#firstNightList"),
    eachNightList: utils.qs("#eachNightList"),
    // ... add all other element references here
};

// --- Initialization ---
async function initialize() {
    try {
        DATA = await utils.loadJSON("tbData.json");
        ui.renderRoleForm(DOMElements.roleForm, DATA);
        attachEventListeners();
    } catch (e) {
        alert("Failed to initialize the application. See console for details.");
        console.error(e);
    }
}

// --- Event Listeners ---
function attachEventListeners() {
    DOMElements.generateBtn.addEventListener("click", onGenerate);
    DOMElements.resetBtn.addEventListener("click", resetAll);
    // ... add other event listeners (picker, text card, etc.)
}

// --- Event Handlers ---
function onGenerate() {
    RNG = utils.mulberry32(utils.newSeed());
    STEP_STATE.clear();
    POISONED_ROLE_FOR_NIGHT = null;

    const rolesInPlay = utils.qsa('#roleForm input:checked').map(cb => cb.value);
    const playerNames = readPlayerNames();

    ui.renderList(DOMElements.firstNightList, "firstNightList", DATA.firstNight, rolesInPlay, playerNames, openStep);
    ui.renderList(DOMElements.eachNightList, "eachNightList", DATA.eachNight, rolesInPlay, playerNames, openStep);
    
    // ui.goFullscreen(); // Example call to UI module
}

function openStep(listId, index, step, clickedLi) {
    // ... logic for opening a step ...
    // This function will call other helper functions and UI functions
    console.log(`Opening step: ${step.role || step.text}`);
}

function resetAll() {
    DOMElements.roleForm.reset();
    DOMElements.firstNightList.innerHTML = "";
    DOMElements.eachNightList.innerHTML = "";
    STEP_STATE.clear();
    const impCheckbox = utils.qs('input[value="Imp"]', DOMElements.roleForm);
    if (impCheckbox) impCheckbox.disabled = false;
}

// --- State Readers ---
function readPlayerNames() {
    const nameMap = new Map();
    utils.qsa('.player-name-input').forEach(input => {
        if (input.value.trim() !== '') {
            nameMap.set(input.dataset.roleName, input.value.trim());
        }
    });
    return nameMap;
}

// --- Boot ---
document.addEventListener("DOMContentLoaded", initialize);