// ===== app.js =====
// Main application logic, state management, and event handling.

import * as utils from './utils.js';
import * as ui from './ui.js';
import { updateCharacterCountDisplay } from './character-counts.js';

// --- App State ---
let DATA = null;
let RNG = null;
const STEP_STATE = new Map();
let POISONED_ROLE_FOR_NIGHT = null;
let PLAYER_POOL = new Map();

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
    selfKillBtn: utils.qs("#selfKillBtn"),
    playerCountInput: utils.qs("#player-count-input"),
    playerPoolInput: utils.qs("#player-pool-input"),
    addPlayersBtn: utils.qs("#addPlayersBtn"),
    playerPoolDisplay: utils.qs("#player-pool-display"),
};

// --- Initialization ---
async function initialize() {
    try {
        DATA = await utils.loadJSON("tbData.json");
        ui.renderRoleForm(DOMElements.roleForm, DATA);
        attachEventListeners();
        updateCharacterCountDisplay(0);
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
    DOMElements.selfKillBtn.addEventListener("click", onSelfKill);
    DOMElements.pickerCancel.addEventListener("click", () => ui.openPicker(false));
    DOMElements.pickerSearch.addEventListener("input", filterPicker);

    // Player Pool Listeners
    DOMElements.addPlayersBtn.addEventListener("click", onAddPlayers);
    DOMElements.playerPoolDisplay.addEventListener("click", onPlayerTagClick);
    DOMElements.roleForm.addEventListener('change', onRoleAssign);

    // Night List Listeners (for status toggles and opening steps)
    DOMElements.firstNightList.addEventListener("click", onNightListClick);
    DOMElements.eachNightList.addEventListener("click", onNightListClick);

    document.addEventListener("keydown", e => {
        if (e.key === "Enter" && document.activeElement === DOMElements.playerPoolInput) {
            DOMElements.addPlayersBtn.click();
        }
        if (e.key.toLowerCase() === "p" && DOMElements.textCard.classList.contains("show")) {
            DOMElements.poisonToggle.click();
        }
        if (e.key === "Escape") {
            ui.openTextCard(false);
            ui.openPicker(false);
        }
    });

    DOMElements.playerCountInput.addEventListener('input', (e) => {
        const count = parseInt(e.target.value, 10);
        updateCharacterCountDisplay(count >= 5 ? count : 0);
        ui.updateLegendCounts(count >= 5 ? count : 0);
    });
}

// --- Event Handlers ---

function onNightListClick(event) {
    const statusToggle = event.target.closest('.status-toggle');
    const li = event.target.closest('li');

    // Handle status toggle click
    if (statusToggle) {
        const roleName = statusToggle.dataset.role;
        if (!roleName) return;

        const playerName = readPlayerNames().get(roleName);
        if (!playerName) return;

        const player = PLAYER_POOL.get(playerName);
        if (!player) return;

        player.isDead = !player.isDead; // Toggle the status
        
        rerenderScriptsAndPool();
        return;
    }

    // Handle opening the step card (but not for dead roles)
    if (li && li.dataset.stepKey && !li.classList.contains('dead')) {
        const [listId, idx] = li.dataset.stepKey.split(":");
        const step = (listId === "firstNightList" ? DATA.firstNight : DATA.eachNight)[+idx];
        if (step) {
            openStep(listId, parseInt(idx), step, li);
        }
    }
}

function onAddPlayers() {
    const names = DOMElements.playerPoolInput.value
        .split(',')
        .map(name => name.trim())
        .filter(name => name && !PLAYER_POOL.has(name));

    names.forEach(name => PLAYER_POOL.set(name, { assignedRole: null, isDead: false }));

    DOMElements.playerPoolInput.value = '';
    ui.renderPlayerPool(DOMElements.playerPoolDisplay, PLAYER_POOL);
    updateAllRoleDropdowns();
}

function onPlayerTagClick(event) {
    if (event.target.classList.contains('remove-player-btn')) {
        const playerName = event.target.dataset.name;
        
        // Unassign the role if the player had one
        const player = PLAYER_POOL.get(playerName);
        if (player && player.assignedRole) {
            const select = utils.qs(`select[data-role-name="${player.assignedRole}"]`);
            if (select) select.value = '';
        }

        PLAYER_POOL.delete(playerName);
        rerenderScriptsAndPool();
    }
}

function onRoleAssign(event) {
    const target = event.target;
    if (target.tagName !== 'SELECT' || !target.classList.contains('player-assign-select')) return;

    const roleName = target.dataset.roleName;
    const selectedPlayerName = target.value;

    PLAYER_POOL.forEach(p => {
        if (p.assignedRole === roleName) p.assignedRole = null;
    });
    
    if (selectedPlayerName) {
        const player = PLAYER_POOL.get(selectedPlayerName);
        if (!player) return;

        if (player.assignedRole && player.assignedRole !== roleName) {
            const oldSelect = utils.qs(`select[data-role-name="${player.assignedRole}"]`);
            if (oldSelect) oldSelect.value = '';
        }
        player.assignedRole = roleName;
    }

    rerenderScriptsAndPool();
}

function onGenerate() {
    RNG = utils.mulberry32(utils.newSeed());
    STEP_STATE.clear();
    POISONED_ROLE_FOR_NIGHT = null;
    rerenderScriptsAndPool();
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

    const isImpKillStep = step.role === 'Imp' && listId.startsWith('eachNight');
    DOMElements.selfKillBtn.style.display = isImpKillStep ? 'inline-block' : 'none';

    ui.renderValueDisplay(step, value);
    ui.openTextCard(true);
}

function onSelfKill() {
    DOMElements.textCardText.textContent = "The Demon has died. You are now the Imp.";
    const displayInfo = { role: "Scarlet Woman", revealType: "token" };
    ui.renderValueDisplay(displayInfo, "Imp");
    DOMElements.pickBtn.style.display = 'none';
    DOMElements.selfKillBtn.style.display = 'none';
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
    DOMElements.playerCountInput.value = '';
    
    STEP_STATE.clear();
    POISONED_ROLE_FOR_NIGHT = null;
    
    PLAYER_POOL.forEach(player => {
        player.assignedRole = null;
        player.isDead = false;
    });

    rerenderScriptsAndPool();
    updateCharacterCountDisplay(0);
    ui.updateLegendCounts(0);
}


// --- State and Logic Helpers ---
function rerenderScriptsAndPool() {
    const roles = utils.qsa('input[name="role"]:checked').map(cb => cb.value);
    const names = readPlayerNames();
    
    ui.renderList(DOMElements.firstNightList, "firstNightList", DATA.firstNight, roles, names, PLAYER_POOL);
    ui.renderList(DOMElements.eachNightList, "eachNightList", DATA.eachNight, roles, names, PLAYER_POOL);
    ui.renderPlayerPool(DOMElements.playerPoolDisplay, PLAYER_POOL);
    updateAllRoleDropdowns();
}

function updateAllRoleDropdowns() {
    const allSelects = utils.qsa('select.player-assign-select', DOMElements.roleForm);

    allSelects.forEach(select => {
        const currentlySelectedPlayer = select.value;
        let optionsHtml = '<option value="">— Unassigned —</option>';

        PLAYER_POOL.forEach((player, name) => {
            const isAvailable = !player.assignedRole || name === currentlySelectedPlayer;
            if (isAvailable) {
                optionsHtml += `<option value="${name}">${name}</option>`;
            }
        });

        select.innerHTML = optionsHtml;
        select.value = currentlySelectedPlayer;
    });
}

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
    const names = new Map();
    PLAYER_POOL.forEach((player, name) => {
        if (player.assignedRole) {
            names.set(player.assignedRole, name);
        }
    });
    return names;
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

    const createListItem = (item) => {
        const imgUrl = utils.cardUrlFor(item.role);
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
