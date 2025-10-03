// ===== app.js =====
// Main application logic, state management, and event handling.

import * as utils from './utils.js';
import * as ui from './ui.js';
// UPDATED THIS LINE
import { updateCharacterCountDisplay } from './character-counts.js';

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
    firstNightList: utils.qs("#firstNightList"),
    eachNightList: utils.qs("#eachNightList"),
    textCard: utils.qs("#textCard"),
    textCardText: utils.qs("#textCardText"),
    textCardCloseBtn: utils.qs("#textCardCloseBtn"),
    poisonToggle: utils.qs("#poisonToggle"),
    pickBtn: utils.qs("#pickBtn"),
    pickerCancel: utils.qs("#pickerCancel"),
    pickerSearch: utils.qs("#pickerSearch"),
    // ADD THIS LINE
    playerCountInput: utils.qs("#player-count-input"),
};

// --- Initialization ---
async function initialize() {
    try {
        DATA = await utils.loadJSON("tbData.json");
        ui.renderRoleForm(DOMElements.roleForm, DATA);
        attachEventListeners();
        
        // Initial call to ensure labels are updated if roles were pre-checked 
        // (though we rely on player count input primarily now)
        const initialRoles = utils.qsa('input[name="role"]:checked');
        updateCharacterCountDisplay(initialRoles.length);
        
    } catch (e) {
        alert("Failed to initialize. See console for details.");
        console.error(e);
    }
}

function attachEventListeners() {
    DOMElements.generateBtn.addEventListener("click", onGenerate);
    DOMElements.resetBtn.addEventListener("click", resetAll);
    DOMElements.textCardCloseBtn.addEventListener("click", () => ui.openTextCard(false));
    DOMElements.poisonToggle.addEventListener("change", onPoisonToggle);
    DOMElements.pickBtn.addEventListener("click", onPick);
    DOMElements.pickerCancel.addEventListener("click", () => ui.openPicker(false));
    DOMElements.pickerSearch.addEventListener("input", filterPicker);
    document.addEventListener("keydown", e => {
        if (e.key.toLowerCase() === "p" && DOMElements.textCard.classList.contains("show")) DOMElements.poisonToggle.click();
        if (e.key === "Escape") { ui.openTextCard(false); ui.openPicker(false); }
    });
    // MODIFIED THIS LISTENER to update the legend counts dynamically
    DOMElements.playerCountInput.addEventListener('input', (e) => {
        const count = parseInt(e.target.value, 10);
        if (count >= 5) {
            updateCharacterCountDisplay(count);
            ui.updateLegendCounts(count); // NEW CALL
        } else {
            // Clear the display if the number is too low
            const displayContainer = utils.qs('#character-counts-display');
            if (displayContainer) displayContainer.innerHTML = '';
            ui.updateLegendCounts(0); // Pass 0 to clear legend counts
        }
    });
}

// --- Event Handlers (rest unchanged) ---
function onGenerate() {
    RNG = utils.mulberry32(utils.newSeed());
    STEP_STATE.clear();
    POISONED_ROLE_FOR_NIGHT = null;
    const roles = utils.qsa('input[name="role"]:checked').map(cb => cb.value);
    const names = readPlayerNames();
    ui.renderList(DOMElements.firstNightList, "firstNightList", DATA.firstNight, roles, names, openStep);
    ui.renderList(DOMElements.eachNightList, "eachNightList", DATA.eachNight, roles, names, openStep);
    // REMOVED: ui.toggleFullscreen(true); to prevent the automatic script pop-up
}

function openStep(listId, index, step, clickedLi) {
    utils.qsa("li.active").forEach(li => li.classList.remove("active"));
    clickedLi.classList.add("active");

    const key = `${listId}:${index}`;
    DOMElements.textCard.dataset.key = key;
    const state = ensureState(key, step);

    if (step.role && step.role === POISONED_ROLE_FOR_NIGHT) state.isPoisoned = true;
    DOMElements.poisonToggle.checked = state.isPoisoned;

    const value = state.isPoisoned ? ensurePoisonedValue(state, step) : ensureTruthfulValue(state, step);
    
    DOMElements.textCardText.textContent = step.ask || "";
    DOMElements.pickBtn.style.display = (step.revealType || step.role === "Poisoner") ? 'inline-block' : 'none';
    
    ui.renderValueDisplay(step, value);
    ui.openTextCard(true); // NOTE: This still opens the token/number card when you click an *individual* step.
}

function onPoisonToggle() {
    const key = DOMElements.textCard.dataset.key; if (!key) return;
    const { step, state } = getStepInfo(key);
    state.isPoisoned = DOMElements.poisonToggle.checked;
    const value = state.isPoisoned ? ensurePoisonedValue(state, step) : state.truthfulValue;
    ui.renderValueDisplay(step, value);
}

function onPick() {
    const key = DOMElements.textCard.dataset.key; if (!key) return;
    const { step, state } = getStepInfo(key);
    const playerNames = readPlayerNames();

    if (step.role === "Poisoner") {
        const rolesInPlay = utils.qsa('input[name="role"]:checked').map(cb => cb.value);
        const targets = rolesInPlay.filter(r => DATA.roles.find(d => d.name === r)?.team.match(/Townsfolk|Outsider/));
        ui.buildPicker(targets, playerNames);
        utils.qs("#pickerTitle").textContent = "Select poison target";
        utils.qsa(".picker-item").forEach(item => item.addEventListener("click", () => {
            POISONED_ROLE_FOR_NIGHT = item.dataset.value;
            const targetName = playerNames.get(POISONED_ROLE_FOR_NIGHT) || POISONED_ROLE_FOR_NIGHT;
            DOMElements.textCardText.textContent = `You have poisoned the ${targetName}.`;
            DOMElements.pickBtn.style.display = 'none';
            ui.openPicker(false);
        }));
    } else if (state.revealType === "token") {
        const poolName = step.randomPolicy?.pool || teamForRole(step.role) || "Any";
        let pool = poolFor(poolName).filter(r => r !== step.role);
        ui.buildPicker(pool, playerNames);
        utils.qsa(".picker-item").forEach(item => item.addEventListener("click", () => handlePickChoice(item.dataset.value)));
    } else if (state.revealType === "numeric" || state.revealType === "boolean") {
        const opts = state.revealType === "numeric" ? (step.randomPolicy?.values ?? [0, 1, 2, "≥3"]) : ["Yes", "No"];
        ui.buildPicker(opts);
        utils.qsa(".picker-item").forEach(item => item.addEventListener("click", () => handlePickChoice(item.dataset.value)));
    }
    ui.openPicker(true);
}

function handlePickChoice(choice) {
    const key = DOMElements.textCard.dataset.key; if (!key) return;
    const { step, state } = getStepInfo(key);
    if (state.isPoisoned) state.poisonedValue = choice;
    else state.truthfulValue = choice;
    ui.renderValueDisplay(step, choice);
    ui.openPicker(false);
}

function filterPicker() {
    const query = utils.qs("#pickerSearch").value.trim().toLowerCase();
    utils.qsa(".picker-item").forEach(el => el.style.display = el.textContent.toLowerCase().includes(query) ? "" : "none");
}

function resetAll() {
    ui.renderRoleForm(DOMElements.roleForm, DATA);
    DOMElements.firstNightList.innerHTML = "";
    DOMElements.eachNightList.innerHTML = "";
    STEP_STATE.clear();
    POISONED_ROLE_FOR_NIGHT = null;
    ui.toggleFullscreen(false);
    // ADD THIS BLOCK
    DOMElements.playerCountInput.value = '';
    const displayContainer = utils.qs('#character-counts-display');
    if (displayContainer) displayContainer.innerHTML = '';
    ui.updateLegendCounts(0); // NEW CALL on reset
}


// --- State and Logic Helpers ---
function getStepInfo(key) {
    const [listId, idx] = key.split(":");
    const step = (listId === "firstNightList" ? DATA.firstNight : DATA.eachNight)[+idx];
    const state = ensureState(key, step);
    return { step, state };
}

function ensureState(key, step) {
    if (!STEP_STATE.has(key)) {
        STEP_STATE.set(key, {
            isPoisoned: false, truthfulValue: null, poisonedValue: null,
            revealType: step.revealType || (DATA.roles.find(r => r.name === step.role)?.revealType)
        });
    }
    return STEP_STATE.get(key);
}

function ensureTruthfulValue(state, step) {
    if (state.truthfulValue != null) return state.truthfulValue;
    const presets = readPresetValues();
    if (step.id === 'demon_bluffs') {
        state.truthfulValue = presets.DemonBluffs;
    } else if (state.revealType === "token") {
        if (step.role === "Washerwoman") state.truthfulValue = presets.Washerwoman;
        else if (step.role === "Librarian") state.truthfulValue = presets.Librarian;
        else if (step.role === "Investigator") state.truthfulValue = presets.Investigator;
    } else if (state.revealType === "numeric" && step.role === "Chef") {
        state.truthfulValue = presets.Chef;
    } else if (state.revealType === "info_list") {
        state.truthfulValue = buildInfoListHtml(step.id);
    }
    return state.truthfulValue;
}

function ensurePoisonedValue(state, step) {
    if (state.poisonedValue != null) return state.poisonedValue;
    const pol = step.randomPolicy || DATA.roles.find(r => r.name === step.role)?.randomPolicy || {};
    if (state.revealType === "numeric") {
        state.poisonedValue = pol.values ? utils.randChoice(pol.values, RNG) : utils.randInt(pol.min ?? 0, pol.max ?? 2, RNG);
    } else if (state.revealType === "boolean") {
        state.poisonedValue = (RNG() < (pol.pTrue ?? 0.5)) ? "Yes" : "No";
    } else if (state.revealType === "token") {
        if (pol.allowZero && RNG() < (pol.pZero ?? 0.2)) state.poisonedValue = "0";
        else state.poisonedValue = utils.randChoice(poolFor(pol.pool || teamForRole(step.role)), RNG);
    } else if (state.revealType === "info_list") {
        state.poisonedValue = buildInfoListHtml(step.id, true);
    }
    return state.poisonedValue;
}

function readPlayerNames() {
    return new Map(utils.qsa('.player-name-input').filter(i => i.value.trim()).map(i => [i.dataset.roleName, i.value.trim()]));
}

function readPresetValues() {
    return {
        Washerwoman: utils.qs("#presetWasherwomanRole")?.value || null,
        Librarian:   utils.qs("#presetLibrarianRole")?.value || null,
        Investigator:utils.qs("#presetInvestigatorRole")?.value || null,
        Chef:        utils.qs("#presetChefNumber")?.value || null,
        DemonBluffs: [
            utils.qs("#presetDemonBluff1")?.value,
            utils.qs("#presetDemonBluff2")?.value,
            utils.qs("#presetDemonBluff3")?.value
        ]
    };
}


function teamForRole(role) { return DATA.roles.find(r => r.name === role)?.team || "Any"; }
function poolFor(poolName) {
    if (poolName === "Any") return DATA.roles.map(r => r.name);
    return DATA.roles.filter(r => r.team === poolName).map(r => r.name);
}

function buildInfoListHtml(stepId, isPoisoned = false) {
    const rolesInPlay = utils.qsa('input[name="role"]:checked').map(cb => cb.value);
    const playerNames = readPlayerNames();
    const minions = [];
    const demons = [];

    rolesInPlay.forEach(roleName => {
        const team = teamForRole(roleName);
        const name = playerNames.get(roleName) || roleName;
        
        if (team === 'Minion') minions.push({name: name, role: roleName});
        if (team === 'Demon') demons.push({name: name, role: roleName});
    });

    let displayDemons = [...demons];
    if (isPoisoned && minions.length > 0) {
        const fakeDemon = utils.randChoice(minions, RNG);
        displayDemons.push(fakeDemon);
    }

    // Helper function to create an HTML list item with a role token and name
    const createListItem = (item) => {
        // Use cardUrlFor to get the image source
        const imgUrl = utils.cardUrlFor(item.role);
        // Add a class 'role-token-small' for styling (to be added to styles.css)
        return `<li><img src="${imgUrl}" alt="${item.role} token" class="role-token-small" /> ${item.name} (${item.role})</li>`;
    };

    if (stepId === 'evil_team_info') {
        let html = '';
        if (displayDemons.length > 0) {
            html += `<h4>Demon</h4><ul>${displayDemons.map(createListItem).join('')}</ul>`;
        }
        if (minions.length > 0) {
            html += `<h4>Minions</h4><ul>${minions.map(createListItem).join('')}</ul>`;
        }
        return html || '<h4>No Evil Players</h4>';
    }
    
    return "";
}

// --- Boot ---
document.addEventListener("DOMContentLoaded", initialize);
