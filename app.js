// ===== app.js =====
// Main application logic, state management, and event handling.

import * as utils from './utils.js';
import * as ui from './ui.js';
import * as playerStatusUI from './player-status.js';
import { updateCharacterCountDisplay } from './character-counts.js';

// --- App State ---
let DATA = null;
let RNG = null;
const STEP_STATE = new Map();
let POISONED_ROLE_FOR_NIGHT = null;
let PLAYER_POOL = new Map();
let RAVENKEEPER_IS_ACTIVATED = false;
let RAVENKEEPER_ABILITY_USED = false;
let MONK_PROTECTED_PLAYER = null; // NEW: Player name protected by the Monk
// State for Undertaker ability
let EXECUTED_PLAYER_ROLE_THIS_DAY = null;
let UNDERTAKER_ABILITY_USED_THIS_NIGHT = false;

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
    noOutsiderBtn: utils.qs("#noOutsiderBtn"),
    playerCountInput: utils.qs("#player-count-input"),
    playerPoolInput: utils.qs("#player-pool-input"),
    addPlayersBtn: utils.qs("#addPlayersBtn"),
    playerPoolDisplay: utils.qs("#player-pool-display"),
    executionBtn: utils.qs("#executionBtn"),
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
    DOMElements.textCardCloseBtn.addEventListener("click", () => {
        ui.openTextCard(false);
        renderNightLists();
    });
    DOMElements.poisonToggle.addEventListener("change", onPoisonToggle);
    DOMElements.pickBtn.addEventListener("click", onPick);
    DOMElements.selfKillBtn.addEventListener("click", onSelfKill);
    DOMElements.noOutsiderBtn.addEventListener("click", onNoOutsider);
    DOMElements.pickerCancel.addEventListener("click", () => ui.openPicker(false));
    DOMElements.pickerSearch.addEventListener("input", filterPicker);
    DOMElements.addPlayersBtn.addEventListener("click", onAddPlayers);
    DOMElements.playerPoolDisplay.addEventListener("click", onPlayerTagClick);
    DOMElements.roleForm.addEventListener('change', onRoleAssign);
    DOMElements.roleForm.addEventListener('change', updateDrunkState);
    
    // Listener for the execution button
    DOMElements.executionBtn.addEventListener("click", onExecution);
    // Prevent the details block from closing when the button is clicked
    DOMElements.executionBtn.addEventListener("click", e => e.stopPropagation());

    document.addEventListener("keydown", e => {
        if (e.key === "Enter" && document.activeElement === DOMElements.playerPoolInput) { DOMElements.addPlayersBtn.click(); }
        if (e.key.toLowerCase() === "p" && DOMElements.textCard.classList.contains("show")) { DOMElements.poisonToggle.click(); }
        if (e.key === "Escape") {
            ui.openTextCard(false);
            ui.openPicker(false);
            renderNightLists();
        }
    });

    DOMElements.playerCountInput.addEventListener('input', (e) => {
        const count = parseInt(e.target.value, 10);
        updateCharacterCountDisplay(count >= 5 ? count : 0);
        ui.updateLegendCounts(count >= 5 ? count : 0);
    });
}

// --- Event Handlers & Core Logic ---

function onExecution() {
    const potentialTargets = [];
    PLAYER_POOL.forEach(player => {
        if (player.isAlive && player.assignedRole) {
            potentialTargets.push(player.assignedRole);
        }
    });

    if (potentialTargets.length === 0) {
        alert("No living, assigned players to execute.");
        return;
    }

    const playerNames = readPlayerNames();
    ui.buildPicker(potentialTargets.sort(), playerNames);
    utils.qs("#pickerTitle").textContent = "Select Executed Role";
    ui.openPicker(true);

    utils.qsa(".picker-item").forEach(item => {
        item.addEventListener("click", () => {
            const executedRole = item.dataset.value;

            for (const player of PLAYER_POOL.values()) {
                if (player.assignedRole === executedRole) {
                    player.isAlive = false;
                    break;
                }
            }
            
            EXECUTED_PLAYER_ROLE_THIS_DAY = executedRole;
            UNDERTAKER_ABILITY_USED_THIS_NIGHT = false; 

            playerStatusUI.renderPlayerManager(DOMElements.playerPoolDisplay, PLAYER_POOL, MONK_PROTECTED_PLAYER);
            renderNightLists();
            ui.openPicker(false);
        }, { once: true });
    });
}

function onAddPlayers() {
    const names = DOMElements.playerPoolInput.value.split(',').map(name => name.trim()).filter(name => name && !PLAYER_POOL.has(name));
    names.forEach(name => PLAYER_POOL.set(name, { assignedRole: null, isDrunk: false, isAlive: true, fakeRole: null }));
    DOMElements.playerPoolInput.value = '';
    playerStatusUI.renderPlayerManager(DOMElements.playerPoolDisplay, PLAYER_POOL, MONK_PROTECTED_PLAYER);
    updateAllRoleDropdowns();
}

function onPlayerTagClick(event) {
    const removeBtn = event.target.closest('.remove-player-btn');
    const playerTag = event.target.closest('.player-tag');
    if (removeBtn) {
        const playerName = removeBtn.dataset.name;
        const player = PLAYER_POOL.get(playerName);
        if (player && player.assignedRole) {
            const select = utils.qs(`select[data-role-name="${player.assignedRole}"]`, DOMElements.roleForm);
            if (select) select.value = '';
        }
        PLAYER_POOL.delete(playerName);
        updateAllRoleDropdowns();
        updateDrunkState();
    } else if (playerTag) {
        const playerName = playerTag.dataset.name;
        const player = PLAYER_POOL.get(playerName);
        if (player) {
            player.isAlive = !player.isAlive;
            renderNightLists();
        }
    }
    playerStatusUI.renderPlayerManager(DOMElements.playerPoolDisplay, PLAYER_POOL, MONK_PROTECTED_PLAYER);
}

function onRoleAssign(event) {
    const target = event.target;
    if (target.tagName !== 'SELECT' || !target.classList.contains('player-assign-select')) return;
    const roleName = target.dataset.roleName;
    const selectedPlayerName = target.value;
    PLAYER_POOL.forEach(p => { if (p.assignedRole === roleName) p.assignedRole = null; });
    if (selectedPlayerName) {
        const player = PLAYER_POOL.get(selectedPlayerName);
        if (!player) return;
        if (player.assignedRole && player.assignedRole !== roleName) {
            const oldSelect = utils.qs(`select[data-role-name="${player.assignedRole}"]`);
            if (oldSelect) oldSelect.value = '';
        }
        player.assignedRole = roleName;
    }
    playerStatusUI.renderPlayerManager(DOMElements.playerPoolDisplay, PLAYER_POOL, MONK_PROTECTED_PLAYER);
    updateAllRoleDropdowns();
}

function updateDrunkState() {
    let previouslyFakedRole = null;
    PLAYER_POOL.forEach(player => {
        if (player.isDrunk && player.fakeRole) { previouslyFakedRole = player.fakeRole; }
        player.isDrunk = false;
        player.fakeRole = null;
    });
    if (previouslyFakedRole) {
        const prevSelect = utils.qs(`select[data-role-name="${previouslyFakedRole}"]`);
        if (prevSelect) prevSelect.disabled = false;
    }
    const drunkRoleCheckbox = utils.qs('input[value="Drunk"]');
    if (!drunkRoleCheckbox || !drunkRoleCheckbox.checked) {
        renderNightLists();
        playerStatusUI.renderPlayerManager(DOMElements.playerPoolDisplay, PLAYER_POOL, MONK_PROTECTED_PLAYER);
        return;
    }
    let drunkPlayer = null;
    for (const player of PLAYER_POOL.values()) { if (player.assignedRole === 'Drunk') { drunkPlayer = player; break; } }
    if (drunkPlayer) {
        const fakeRoleSelect = utils.qs('#drunkFakeRoleSelect');
        const fakeRoleName = fakeRoleSelect ? fakeRoleSelect.value : null;
        if (fakeRoleName) {
            drunkPlayer.isDrunk = true;
            drunkPlayer.fakeRole = fakeRoleName;
            const targetSelect = utils.qs(`select[data-role-name="${fakeRoleName}"]`);
            if (targetSelect) {
                const assignedPlayerName = targetSelect.value;
                if (assignedPlayerName) {
                    const otherPlayer = PLAYER_POOL.get(assignedPlayerName);
                    if (otherPlayer) otherPlayer.assignedRole = null;
                }
                targetSelect.value = '';
                targetSelect.disabled = true;
                updateAllRoleDropdowns();
            }
        }
    }
    renderNightLists();
    playerStatusUI.renderPlayerManager(DOMElements.playerPoolDisplay, PLAYER_POOL, MONK_PROTECTED_PLAYER);
}

function onGenerate() {
    RNG = utils.mulberry32(utils.newSeed());
    STEP_STATE.clear();
    POISONED_ROLE_FOR_NIGHT = null;
    RAVENKEEPER_IS_ACTIVATED = false;
    RAVENKEEPER_ABILITY_USED = false;
    MONK_PROTECTED_PLAYER = null; // NEW
    EXECUTED_PLAYER_ROLE_THIS_DAY = null;
    UNDERTAKER_ABILITY_USED_THIS_NIGHT = false;
    renderNightLists();
}

function openStep(listId, index, step, clickedLi) {
    if (clickedLi.classList.contains('dead-player-step')) return;
    utils.qsa("li.active").forEach(li => li.classList.remove("active"));
    clickedLi.classList.add("active");
    if (step.role === 'Ravenkeeper') { RAVENKEEPER_ABILITY_USED = true; }
    
    // Each night, protection must be re-applied
    if (step.role === 'Monk') { MONK_PROTECTED_PLAYER = null; }
    
    const key = `${listId}:${index}`;
    DOMElements.textCard.dataset.key = key;
    const state = ensureState(key, step);
    const roleIsDrunk = isRoleDrunk(step.role);
    if (roleIsDrunk) { state.isPoisoned = true; }
    else if (step.role && step.role === POISONED_ROLE_FOR_NIGHT) { state.isPoisoned = true; }

    let value = state.isPoisoned ? ensurePoisonedValue(state, step) : ensureTruthfulValue(state, step);
    if (step.role === 'Undertaker') {
        value = state.isPoisoned ? ensurePoisonedValue(state, step) : EXECUTED_PLAYER_ROLE_THIS_DAY;
        UNDERTAKER_ABILITY_USED_THIS_NIGHT = true;
    }

    const poisonToggleLabel = DOMElements.poisonToggle.parentElement;
    if (poisonToggleLabel) poisonToggleLabel.style.display = roleIsDrunk ? 'none' : 'inline-flex';
    DOMElements.poisonToggle.checked = state.isPoisoned;
    DOMElements.textCardText.textContent = step.ask || "";
    const isImpKillStep = step.role === 'Imp' && listId.startsWith('eachNight');
    const isLibrarianStep = step.role === 'Librarian';
    // Let the Monk pick a player
    const showPickButton = step.revealType || step.role === "Poisoner" || step.role === "Monk" || isImpKillStep;
    DOMElements.pickBtn.style.display = showPickButton ? 'inline-block' : 'none';
    DOMElements.selfKillBtn.style.display = isImpKillStep ? 'inline-block' : 'none';
    DOMElements.noOutsiderBtn.style.display = isLibrarianStep ? 'inline-block' : 'none';
    ui.renderValueDisplay(step, value);
    ui.openTextCard(true);
}

function onSelfKill() {
    DOMElements.textCardText.textContent = "The Demon has died. You are now the Imp.";
    const displayInfo = { role: "Scarlet Woman", revealType: "token" };
    ui.renderValueDisplay(displayInfo, "Imp");
    DOMElements.pickBtn.style.display = 'none';
    DOMElements.selfKillBtn.style.display = 'none';
    DOMElements.noOutsiderBtn.style.display = 'none';
}

function onNoOutsider() {
    const key = DOMElements.textCard.dataset.key; if (!key) return;
    const { step } = getStepInfo(key);
    ui.renderValueDisplay(step, "0");
    DOMElements.textCardText.textContent = "There are no outsiders in play";
    DOMElements.pickBtn.style.display = 'none';
    DOMElements.noOutsiderBtn.style.display = 'none';
}

function onPoisonToggle() {
    const key = DOMElements.textCard.dataset.key; if (!key) return;
    const { step, state } = getStepInfo(key);
    state.isPoisoned = DOMElements.poisonToggle.checked;
    const value = state.isPoisoned ? ensurePoisonedValue(state, step) : state.truthfulValue;
    ui.renderValueDisplay(step, value);
}

function onPick() {
    const key = DOMElements.textCard.dataset.key;
    if (!key) return;
    const { step, listId } = getStepInfo(key);
    const playerNames = readPlayerNames();

    if (step.role === 'Imp' && listId.startsWith('eachNight')) {
        const livingPlayers = Array.from(PLAYER_POOL.entries()).filter(([, player]) => player.isAlive).map(([name]) => name);
        handleDemonKill(livingPlayers);
    } else if (step.role === 'Monk') {
        const monkPlayerName = playerNames.get('Monk');
        const livingPlayers = Array.from(PLAYER_POOL.entries())
            .filter(([, player]) => player.isAlive)
            .map(([name]) => name)
            .filter(name => name !== monkPlayerName); // Monk cannot protect themselves

        ui.buildPicker(livingPlayers, new Map(), PLAYER_POOL, POISONED_ROLE_FOR_NIGHT, MONK_PROTECTED_PLAYER);
        utils.qs("#pickerTitle").textContent = "Select protect target";
        ui.openPicker(true);

        utils.qsa(".picker-item").forEach(item => {
            item.addEventListener("click", () => {
                MONK_PROTECTED_PLAYER = item.dataset.value;
                DOMElements.textCardText.textContent = `You are protecting ${MONK_PROTECTED_PLAYER} tonight.`;
                DOMElements.pickBtn.style.display = 'none';
                ui.openPicker(false);
                playerStatusUI.renderPlayerManager(DOMElements.playerPoolDisplay, PLAYER_POOL, MONK_PROTECTED_PLAYER);
                renderNightLists();
            }, { once: true });
        });
    } else if (step.role === "Poisoner") {
        const rolesInPlay = utils.qsa('input[name="role"]:checked').map(cb => cb.value);
        const targets = rolesInPlay.filter(r => DATA.roles.find(d => d.name === r)?.team.match(/Townsfolk|Outsider/));
        ui.buildPicker(targets, playerNames, PLAYER_POOL, POISONED_ROLE_FOR_NIGHT, MONK_PROTECTED_PLAYER);
        utils.qs("#pickerTitle").textContent = "Select poison target";
        utils.qsa(".picker-item").forEach(item => item.addEventListener("click", () => {
            POISONED_ROLE_FOR_NIGHT = item.dataset.value;
            const targetName = playerNames.get(POISONED_ROLE_FOR_NIGHT) || POISONED_ROLE_FOR_NIGHT;
            DOMElements.textCardText.textContent = `You have poisoned the ${targetName}.`;
            DOMElements.pickBtn.style.display = 'none';
            DOMElements.noOutsiderBtn.style.display = 'none';
            ui.openPicker(false);
            renderNightLists();
        }, { once: true }));
        ui.openPicker(true);
    } else {
        const state = ensureState(key, step);
        if (state.revealType === "token") {
            const poolName = step.randomPolicy?.pool || teamForRole(step.role) || "Any";
            let pool = poolFor(poolName).filter(r => r !== step.role);
            ui.buildPicker(pool, playerNames, PLAYER_POOL, POISONED_ROLE_FOR_NIGHT, MONK_PROTECTED_PLAYER);
            utils.qsa(".picker-item").forEach(item => item.addEventListener("click", () => handlePickChoice(item.dataset.value), { once: true }));
        } else if (state.revealType === "numeric" || state.revealType === "boolean") {
            const opts = state.revealType === "numeric" ? (step.randomPolicy?.values ?? [0, 1, 2, "≥3"]) : ["Yes", "No"];
            ui.buildPicker(opts);
            utils.qsa(".picker-item").forEach(item => item.addEventListener("click", () => handlePickChoice(item.dataset.value), { once: true }));
        }
        ui.openPicker(true);
    }
}

function handleDemonKill(potentialTargets) {
    ui.buildPicker(potentialTargets, new Map(), PLAYER_POOL, POISONED_ROLE_FOR_NIGHT, MONK_PROTECTED_PLAYER);
    utils.qs("#pickerTitle").textContent = "Select a Kill Target";
    ui.openPicker(true);
    utils.qsa(".picker-item").forEach(item => {
        item.addEventListener("click", () => {
            const killedPlayerName = item.dataset.value;
            const player = PLAYER_POOL.get(killedPlayerName);
            if (!player) return;
            
            // --- NEW: Monk Protection Check ---
            let isMonkProtected = false;
            if (killedPlayerName === MONK_PROTECTED_PLAYER) {
                let theMonk = null;
                for (const p of PLAYER_POOL.values()) {
                    if (p.assignedRole === 'Monk') { theMonk = p; break; }
                }
                if (theMonk && !theMonk.isDrunk && POISONED_ROLE_FOR_NIGHT !== 'Monk') {
                    isMonkProtected = true;
                }
            }

            if (isMonkProtected) {
                ui.openPicker(false);
                DOMElements.textCardText.textContent = `✝️ Monk: ${killedPlayerName} is protected and does not die.`;
                DOMElements.pickBtn.style.display = 'none';
                return; 
            }
            // --- END of Monk Protection Check ---

            const isSoldier = player.assignedRole === 'Soldier';
            const isMayor = player.assignedRole === 'Mayor';
            const isDrunk = player.isDrunk;
            const isPoisoned = POISONED_ROLE_FOR_NIGHT === player.assignedRole;
            const isProtectedSoldier = isSoldier && !isDrunk && !isPoisoned;
            const isProtectedMayor = isMayor && !isDrunk && !isPoisoned;

            if (isProtectedSoldier) {
                ui.openPicker(false);
                DOMElements.textCardText.textContent = `🛡️ Soldier: ${killedPlayerName} does not die`;
                DOMElements.pickBtn.style.display = 'none';
            } else if (isProtectedMayor) {
                DOMElements.textCardText.textContent = `🏛️ Mayor: ${killedPlayerName} does not die. Choose another player to die.`;
                const newTargets = potentialTargets.filter(p => p !== killedPlayerName);
                handleDemonKill(newTargets);
            } else {
                ui.openPicker(false);
                player.isAlive = false;
                if (player.assignedRole === 'Ravenkeeper') { RAVENKEEPER_IS_ACTIVATED = true; }
                DOMElements.textCardText.textContent = `You have chosen to kill ${killedPlayerName} (${player.assignedRole || 'Role?'}).`;
                DOMElements.pickBtn.style.display = 'none';
                playerStatusUI.renderPlayerManager(DOMElements.playerPoolDisplay, PLAYER_POOL, MONK_PROTECTED_PLAYER);
                renderNightLists();
            }
        }, { once: true });
    });
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
    RAVENKEEPER_IS_ACTIVATED = false;
    RAVENKEEPER_ABILITY_USED = false;
    MONK_PROTECTED_PLAYER = null; // NEW
    EXECUTED_PLAYER_ROLE_THIS_DAY = null;
    UNDERTAKER_ABILITY_USED_THIS_NIGHT = false;
    PLAYER_POOL.forEach(player => {
        player.assignedRole = null;
        player.isDrunk = false;
        player.isAlive = true;
        player.fakeRole = null;
    });
    playerStatusUI.renderPlayerManager(DOMElements.playerPoolDisplay, PLAYER_POOL, MONK_PROTECTED_PLAYER);
    updateAllRoleDropdowns();
    updateCharacterCountDisplay(0);
    ui.updateLegendCounts(0);
}

// --- Helper Functions ---

function renderNightLists() {
    const roles = utils.qsa('input[name="role"]:checked').map(cb => cb.value);
    const names = readPlayerNames();
    const drunkRoles = new Set();
    PLAYER_POOL.forEach(player => { if (player.isDrunk && player.fakeRole) { drunkRoles.add(player.fakeRole); } });
    
    const undertakerCanAct = EXECUTED_PLAYER_ROLE_THIS_DAY !== null && !UNDERTAKER_ABILITY_USED_THIS_NIGHT;
    
    ui.renderList(DOMElements.firstNightList, "firstNightList", DATA.firstNight, roles, names, openStep, drunkRoles, POISONED_ROLE_FOR_NIGHT, PLAYER_POOL, RAVENKEEPER_IS_ACTIVATED, RAVENKEEPER_ABILITY_USED, undertakerCanAct);
    ui.renderList(DOMElements.eachNightList, "eachNightList", DATA.eachNight, roles, names, openStep, drunkRoles, POISONED_ROLE_FOR_NIGHT, PLAYER_POOL, RAVENKEEPER_IS_ACTIVATED, RAVENKEEPER_ABILITY_USED, undertakerCanAct);
}

function isRoleDrunk(roleName) {
    if (!roleName) return false;
    for (const player of PLAYER_POOL.values()) { if (player.isDrunk && player.fakeRole === roleName) { return true; } }
    return false;
}

function updateAllRoleDropdowns() {
    const allSelects = utils.qsa('select.player-assign-select', DOMElements.roleForm);
    allSelects.forEach(select => {
        const currentlySelectedPlayer = select.value;
        let optionsHtml = '<option value="">— Unassigned —</option>';
        PLAYER_POOL.forEach((player, name) => {
            const isAvailable = !player.assignedRole || name === currentlySelectedPlayer;
            if (isAvailable) { optionsHtml += `<option value="${name}">${name}</option>`; }
        });
        select.innerHTML = optionsHtml;
        select.value = currentlySelectedPlayer;
    });
}

function getStepInfo(key) {
    const [listId, idx] = key.split(":");
    const step = (listId === "firstNightList" ? DATA.firstNight : DATA.eachNight)[+idx];
    const state = ensureState(key, step);
    return { step, state, listId, idx };
}

function ensureState(key, step) {
    if (!STEP_STATE.has(key)) {
        STEP_STATE.set(key, { isPoisoned: false, truthfulValue: null, poisonedValue: null, revealType: step.revealType || (DATA.roles.find(r => r.name === step.role)?.revealType) });
    }
    return STEP_STATE.get(key);
}

function ensureTruthfulValue(state, step) {
    if (state.truthfulValue != null) return state.truthfulValue;
    const presets = readPresetValues();
    if (step.id === 'demon_bluffs') { state.truthfulValue = presets.DemonBluffs; }
    else if (state.revealType === "token") {
        if (step.role === "Washerwoman") state.truthfulValue = presets.Washerwoman;
        else if (step.role === "Librarian") state.truthfulValue = presets.Librarian;
        else if (step.role === "Investigator") state.truthfulValue = presets.Investigator;
    } else if (state.revealType === "numeric" && step.role === "Chef") { state.truthfulValue = presets.Chef; }
    else if (state.revealType === "info_list") { state.truthfulValue = buildInfoList(step.id); }
    return state.truthfulValue;
}

function ensurePoisonedValue(state, step) {
    if (state.poisonedValue != null) return state.poisonedValue;
    const pol = step.randomPolicy || DATA.roles.find(r => r.name === step.role)?.randomPolicy || {};
    if (state.revealType === "numeric") { state.poisonedValue = pol.values ? utils.randChoice(pol.values, RNG) : utils.randInt(pol.min ?? 0, pol.max ?? 2, RNG); }
    else if (state.revealType === "boolean") { state.poisonedValue = (RNG() < (pol.pTrue ?? 0.5)) ? "Yes" : "No"; }
    else if (state.revealType === "token") {
        if (pol.allowZero && RNG() < (pol.pZero ?? 0.2)) state.poisonedValue = "0";
        else state.poisonedValue = utils.randChoice(poolFor(pol.pool || teamForRole(step.role)), RNG);
    } else if (state.revealType === "info_list") { state.poisonedValue = buildInfoList(step.id, true); }
    return state.poisonedValue;
}

function readPlayerNames() {
    const names = new Map();
    PLAYER_POOL.forEach((player, name) => {
        if (player.assignedRole) { names.set(player.assignedRole, name); }
        if (player.isDrunk && player.fakeRole) { names.set(player.fakeRole, name); }
    });
    return names;
}

function readPresetValues() {
    return {
        Washerwoman: utils.qs("#presetWasherwomanRole")?.value || null,
        Librarian: utils.qs("#presetLibrarianRole")?.value || null,
        Investigator: utils.qs("#presetInvestigatorRole")?.value || null,
        Chef: utils.qs("#presetChefNumber")?.value || null,
        DemonBluffs: [ utils.qs("#presetDemonBluff1")?.value, utils.qs("#presetDemonBluff2")?.value, utils.qs("#presetDemonBluff3")?.value ]
    };
}

function teamForRole(role) { return DATA.roles.find(r => r.name === role)?.team || "Any"; }
function poolFor(poolName) {
    if (poolName === "Any") return DATA.roles.map(r => r.name);
    return DATA.roles.filter(r => r.team === poolName).map(r => r.name);
}

function buildInfoList(stepId, isPoisoned = false) {
    const rolesInPlay = utils.qsa('input[name="role"]:checked').map(cb => cb.value);
    const playerNames = readPlayerNames();
    const minions = [];
    const demons = [];
    rolesInPlay.forEach(roleName => {
        const team = teamForRole(roleName);
        const name = playerNames.get(roleName) || roleName;
        if (team === 'Minion') minions.push({ name: name, role: roleName });
        if (team === 'Demon') demons.push({ name: name, role: roleName });
    });
    let displayDemons = [...demons];
    if (isPoisoned && minions.length > 0) {
        const fakeDemon = utils.randChoice(minions, RNG);
        displayDemons.push(fakeDemon);
    }
    if (stepId === 'evil_team_info') {
        return { demons: displayDemons, minions: minions };
    }
    return null;
}

// --- Boot ---
document.addEventListener("DOMContentLoaded", initialize);