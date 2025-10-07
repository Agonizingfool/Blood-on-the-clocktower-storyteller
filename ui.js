// ===== ui.js =====
// Handles all rendering and direct DOM manipulation.

import { qs, qsa, cardUrlFor } from './utils.js';
import { characterCountsData } from './character-counts.js';

/** Renders the initial role selection form. */
export function renderRoleForm(formElement, data) {
    // ... (no changes in this function)
    const byTeam = {
        Townsfolk: data.roles.filter(r => r.team === "Townsfolk"),
        Outsider:  data.roles.filter(r => r.team === "Outsider"),
        Minion:    data.roles.filter(r => r.team === "Minion"),
        Demon:     data.roles.filter(r => r.team === "Demon")
    };
    const towns = data.roles.filter(r => r.team === "Townsfolk").map(r => r.name).sort();
    const outsiders = data.roles.filter(r => r.team === "Outsider").map(r => r.name).sort();
    const minions = data.roles.filter(r => r.team === "Minion").map(r => r.name).sort();
    const bluffableRoles = [...towns, ...outsiders]; 
    const teamOrder = ["Townsfolk", "Outsider", "Minion", "Demon"];
    formElement.innerHTML = teamOrder.map(team => `
      <fieldset data-team-type="${team}">
        <legend>${team} <span class="role-current-count"></span></legend>
        ${byTeam[team].map(r => {
            let presetHtml = '';
            switch(r.name) {
                case "Washerwoman":
                    presetHtml = `<select id="presetWasherwomanRole" class="role-preset-select"><option value="">— select —</option>${towns.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
                    break;
                case "Librarian":
                    presetHtml = `<select id="presetLibrarianRole" class="role-preset-select"><option value="">No Outsider in play</option>${outsiders.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
                    break;
                case "Investigator":
                    presetHtml = `<select id="presetInvestigatorRole" class="role-preset-select"><option value="">— select —</option>${minions.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
                    break;
                case "Chef":
                    presetHtml = `<input type="number" id="presetChefNumber" class="role-preset-select" min="0" placeholder="#">`;
                    break;
                case "Imp":
                    presetHtml = `
                        <select id="presetDemonBluff1" class="role-preset-select"><option value="">— bluff 1 —</option>${bluffableRoles.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>
                        <select id="presetDemonBluff2" class="role-preset-select"><option value="">— bluff 2 —</option>${bluffableRoles.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>
                        <select id="presetDemonBluff3" class="role-preset-select"><option value="">— bluff 3 —</option>${bluffableRoles.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>
                    `;
                    break;
            }
            const playerAssignHtml = `<select class="player-assign-select" data-role-name="${r.name}"><option value="">— Unassigned —</option></select>`;
            const drunkCheckboxHtml = (r.team === 'Townsfolk')
                ? `<label class="drunk-label"><input type="checkbox" class="drunk-checkbox" data-role-name="${r.name}"> Is Drunk</label>`
                : '';
            const controlsHtml = `
                <div class="role-controls" style="display: none;">
                    ${playerAssignHtml}
                    ${drunkCheckboxHtml}
                    ${presetHtml}
                </div>
            `;
            return `
                <div class="role-item">
                    <label>
                        <input type="checkbox" name="role" value="${r.name}"> ${r.name}
                    </label>
                    ${controlsHtml}
                </div>`;
        }).join("")}
      </fieldset>
    `).join("");
    const impCheckbox = formElement.querySelector(`input[value="Imp"]`);
    if (impCheckbox) {
        impCheckbox.checked = true;
        impCheckbox.disabled = true;
        impCheckbox.parentElement.style.cssText = "cursor: not-allowed; opacity: 0.6;";
    }
    qsa('input[name="role"]', formElement).forEach(checkbox => {
        const controls = checkbox.closest('.role-item').querySelector('.role-controls');
        const toggleControls = show => {
            if (controls) controls.style.display = show ? 'flex' : 'none';
        };
        toggleControls(checkbox.checked);
        checkbox.addEventListener('change', e => toggleControls(e.target.checked));
    });
    updateLegendCounts(0); 
}

/** Updates the role selection fieldset legends with the required number of roles. */
export function updateLegendCounts(playerCount) {
    const countsData = characterCountsData[Math.min(playerCount, 15)];
    qsa('fieldset[data-team-type]').forEach(fieldset => {
        const team = fieldset.dataset.teamType;
        const teamKey = team === 'Townsfolk' ? 'Townsfolk' : `${team}s`;
        const countSpan = fieldset.querySelector('.role-current-count');
        if (countSpan) {
            countSpan.dataset.teamType = team;
            if (playerCount < 5) {
                countSpan.textContent = '(Min 5 players)';
                countSpan.style.color = 'var(--muted)';
            } else if (countsData && countsData[teamKey] !== undefined) {
                const count = countsData[teamKey];
                countSpan.textContent = `(${count} required)`;
                countSpan.style.color = ''; 
            } else {
                 countSpan.textContent = '';
                 countSpan.style.color = '';
            }
        }
    });
}


// MODIFIED: Signature updated to accept the poisoned role and both ravenkeeper flags
export function renderList(listElement, listId, steps, rolesInPlay, playerNames, stepClickHandler, drunkRoles = new Set(), poisonedRoleForNight = null, playerPool, ravenkeeperIsActivated, ravenkeeperAbilityUsed) {
    listElement.innerHTML = "";

    const roleToPlayer = new Map();
    playerPool.forEach((player, name) => {
        if (player.assignedRole) {
            roleToPlayer.set(player.assignedRole, player);
        }
    });

    steps.forEach((step, idx) => {
        const roleIsInPlay = !step.role || rolesInPlay.includes(step.role);

        if (roleIsInPlay) {
            if (step.role === 'Ravenkeeper' && !ravenkeeperIsActivated) {
                return; 
            }

            const li = document.createElement("li");
            const isDrunk = step.role && drunkRoles.has(step.role);
            const drunkIndicator = isDrunk ? '🍺 ' : '';

            // ADDED: Logic for the poison indicator
            const isPoisoned = step.role && step.role === poisonedRoleForNight;
            const poisonIndicator = isPoisoned ? '🧪 ' : '';

            const assignedPlayer = roleToPlayer.get(step.role);
            if (assignedPlayer && !assignedPlayer.isAlive) {
                // NEW LOGIC: A dead player's step is disabled, UNLESS
                // it's the Ravenkeeper and their ability hasn't been used yet.
                if (step.role === 'Ravenkeeper' && !ravenkeeperAbilityUsed) {
                    // Is dead, but ability is fresh. Allow one click.
                } else {
                    li.classList.add('dead-player-step');
                }
            }
            
            if (step.role) {
                li.dataset.role = step.role;
            }

            let roleDisplay = step.role;
            if (step.role && playerNames.has(step.role)) {
                roleDisplay = `${step.role} (${playerNames.get(step.role)})`;
            }

            // MODIFIED: Prepend the poison indicator to the output
            li.innerHTML = (step.role && step.ask) 
                ? `${poisonIndicator}${drunkIndicator}<strong>${roleDisplay}:</strong> ${step.ask}` 
                : (step.text || step.role);
                
            li.dataset.stepKey = `${listId}:${idx}`;
            li.addEventListener("click", () => stepClickHandler(listId, idx, step, li));
            listElement.appendChild(li);
        }
    });
}

// ... (Rest of the ui.js file is unchanged)
/** Renders the main display (token, number, etc.) on the fullscreen text card. */
export function renderValueDisplay(step, value) {
    const fig = qs("#textCardFigure");
    const img = qs("#textCardTokenImg");
    const cap = qs("#textCardTokenCaption");
    const oldMultiContainer = fig.querySelector('.multi-image-container');
    if (oldMultiContainer) oldMultiContainer.remove();
    img.style.display = 'block';
    img.removeAttribute("src");
    img.onerror = null;
    cap.innerHTML = "";
    fig.hidden = true;
    if (step.id === 'demon_bluffs' && Array.isArray(value) && value.some(v => v)) {
        fig.hidden = false;
        cap.innerHTML = '';
        img.style.display = 'none';
        const multiImageContainer = document.createElement('div');
        multiImageContainer.className = 'multi-image-container';
        value.forEach(bluff => {
            if (bluff) {
                const bluffFigure = document.createElement('figure');
                const bluffImg = document.createElement('img');
                bluffImg.src = cardUrlFor(bluff);
                bluffImg.alt = `${bluff} token`;
                bluffImg.onerror = () => bluffFigure.remove();
                const bluffCaption = document.createElement('figcaption');
                bluffCaption.textContent = bluff;
                bluffFigure.appendChild(bluffImg);
                bluffFigure.appendChild(bluffCaption);
                multiImageContainer.appendChild(bluffFigure);
            }
        });
        fig.insertBefore(multiImageContainer, cap);
    } else if (step.id === 'evil_team_info' && typeof value === 'object' && value !== null) {
        const allEvil = [...(value.demons || []), ...(value.minions || [])];
        if (allEvil.length > 0) {
            fig.hidden = false;
            cap.innerHTML = '';
            img.style.display = 'none';
            const multiImageContainer = document.createElement('div');
            multiImageContainer.className = 'multi-image-container';
            allEvil.forEach(player => {
                const playerFigure = document.createElement('figure');
                const playerImg = document.createElement('img');
                playerImg.src = cardUrlFor(player.role);
                playerImg.alt = `${player.role} token`;
                playerImg.onerror = () => playerFigure.remove();
                const playerCaption = document.createElement('figcaption');
                playerCaption.innerHTML = `<span class="player-name">${player.name}</span><span class="player-role">(${player.role})</span>`;
                playerFigure.appendChild(playerImg);
                playerFigure.appendChild(playerCaption);
                multiImageContainer.appendChild(playerFigure);
            });
            fig.insertBefore(multiImageContainer, cap);
        }
    } else if (step.role === "Poisoner") {
        fig.hidden = false;
        cap.textContent = step.role;
        img.src = cardUrlFor(step.role);
        img.alt = `${step.role} token`;
        img.onerror = () => img.removeAttribute("src");
    } else if (step.revealType === "token") {
        const tokenToShow = (step.role === "Scarlet Woman") ? "Imp" : value;
        if (!tokenToShow || tokenToShow === "0") {
            fig.hidden = false;
            img.style.display = 'none';
            cap.textContent = "0";
        } else {
            fig.hidden = false;
            cap.textContent = tokenToShow;
            img.src = cardUrlFor(tokenToShow);
            img.alt = `${tokenToShow} token`;
            img.onerror = () => img.removeAttribute("src");
        }
    } else if (step.revealType === "numeric" || step.revealType === "boolean" || step.revealType === "info_list") {
        if (value) {
            fig.hidden = false;
            img.style.display = 'none';
            cap.innerHTML = value;
        }
    }
}


/** Builds and displays the role/option picker modal. */
export function buildPicker(options, playerNames = new Map()) {
    const list = qs("#pickerList");
    qs("#pickerSearch").value = "";
    list.innerHTML = "";
    options.forEach(name => {
        const div = document.createElement("div");
        div.className = "picker-item";
        div.dataset.value = name;
        const playerName = playerNames.get(String(name));
        const displayText = playerName ? `${name} (${playerName})` : name;
        div.innerHTML = `<span>${displayText}</span><small>Select</small>`;
        list.appendChild(div);
    });
}

/** Manages the visibility and state of the fullscreen text card. */
export function openTextCard(show) {
    const card = qs("#textCard");
    card.classList.toggle("show", show);
    card.setAttribute("aria-hidden", String(!show));
}

/** Manages the visibility of the picker modal. */
export function openPicker(show) {
    const picker = qs("#picker");
    picker.classList.toggle("show", show);
    picker.setAttribute("aria-hidden", String(!show));
    if (!show) {
        qs("#pickerList").innerHTML = "";
        qs("#pickerTitle").textContent = "Pick a role";
    }
}

/** Manages the visibility of the main script fullscreen view. */
export async function toggleFullscreen(enable) {
    const sec = qs("#scriptSection");
    sec.classList.toggle("fullscreen", enable);
    if (enable) {
        if (!qs("#exitFullscreenBtn")) {
            const btn = document.createElement("button");
            btn.id = "exitFullscreenBtn";
            btn.textContent = "Exit";
            btn.addEventListener("click", () => toggleFullscreen(false));
            document.body.appendChild(btn);
        }
        try { await document.documentElement.requestFullscreen?.(); } catch {}
    } else {
        qs("#exitFullscreenBtn")?.remove();
        if (document.fullscreenElement) try { await document.exitFullscreen(); } catch {}
    }
}