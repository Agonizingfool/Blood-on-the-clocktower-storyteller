// ===== ui.js =====
// Handles all rendering and direct DOM manipulation.

import { qs, qsa, cardUrlFor } from './utils.js';

/** Renders the initial role selection form. */
export function renderRoleForm(formElement, data) {
    const byTeam = {
        Townsfolk: data.roles.filter(r => r.team === "Townsfolk"),
        Outsider:  data.roles.filter(r => r.team === "Outsider"),
        Minion:    data.roles.filter(r => r.team === "Minion"),
        Demon:     data.roles.filter(r => r.team === "Demon")
    };

    const towns = data.roles.filter(r => r.team === "Townsfolk").map(r => r.name);
    const outsiders = data.roles.filter(r => r.team === "Outsider").map(r => r.name);
    const minions = data.roles.filter(r => r.team === "Minion").map(r => r.name);
    
    formElement.innerHTML = ["Townsfolk", "Outsider", "Minion", "Demon"].map(team => `
      <fieldset>
        <legend>${team}</legend>
        ${byTeam[team].map(r => {
            let presetHtml = '';
            switch(r.name) {
                case "Washerwoman":
                    presetHtml = `<select id="presetWasherwomanRole" class="role-preset-select"><option value="">— select —</option>${towns.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
                    break;
                case "Librarian":
                    presetHtml = `<select id="presetLibrarianRole" class="role-preset-select"><option value="">— none (0) —</option>${outsiders.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
                    break;
                case "Investigator":
                    presetHtml = `<select id="presetInvestigatorRole" class="role-preset-select"><option value="">— select —</option>${minions.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
                    break;
                case "Chef":
                    presetHtml = `<input type="number" id="presetChefNumber" class="role-preset-select" min="0" placeholder="#">`;
                    break;
                case "Imp":
                    presetHtml = `
                        <select id="presetDemonBluff1" class="role-preset-select"><option value="">— bluff 1 —</option>${towns.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>
                        <select id="presetDemonBluff2" class="role-preset-select"><option value="">— bluff 2 —</option>${towns.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>
                        <select id="presetDemonBluff3" class="role-preset-select"><option value="">— bluff 3 —</option>${towns.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>
                    `;
                    break;
            }
            const nameInputHtml = `<input type="text" class="player-name-input" data-role-name="${r.name}" placeholder="Player Name">`;
            
            const controlsHtml = `
                <div class="role-controls" style="display: none;">
                    ${nameInputHtml}
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
}


/** Renders the night script steps into a list element. */
export function renderList(listElement, listId, steps, rolesInPlay, playerNames, stepClickHandler) {
    listElement.innerHTML = "";
    steps.forEach((step, idx) => {
        if (!step.role || rolesInPlay.includes(step.role)) {
            const li = document.createElement("li");
            let roleDisplay = step.role;
            if (step.role && playerNames.has(step.role)) {
                roleDisplay = `${step.role} (${playerNames.get(step.role)})`;
            }
            li.innerHTML = (step.role && step.ask) ? `<strong>${roleDisplay}:</strong> ${step.ask}` : (step.text || step.role);
            li.dataset.stepKey = `${listId}:${idx}`;
            li.addEventListener("click", () => stepClickHandler(listId, idx, step, li));
            listElement.appendChild(li);
        }
    });
}

/** Renders the main display (token, number, etc.) on the fullscreen text card. */
export function renderValueDisplay(step, value) {
    const fig = qs("#textCardFigure");
    const img = qs("#textCardTokenImg");
    const cap = qs("#textCardTokenCaption");

    // --- 1. Reset to default state ---
    const oldMultiContainer = fig.querySelector('.multi-image-container');
    if (oldMultiContainer) {
        oldMultiContainer.remove();
    }
    img.style.display = 'block';
    img.removeAttribute("src");
    img.onerror = null;
    cap.innerHTML = "";
    fig.hidden = true;

    // --- 2. Render based on step type ---
    if (step.id === 'demon_bluffs' && Array.isArray(value) && value.some(v => v)) {
        fig.hidden = false;
        cap.textContent = "Your 3 bluffs";
        
        const multiImageContainer = document.createElement('div');
        multiImageContainer.className = 'multi-image-container';
        multiImageContainer.style.display = 'flex';
        multiImageContainer.style.gap = '10px';
        multiImageContainer.style.justifyContent = 'center';
        multiImageContainer.style.marginTop = '10px';

        value.forEach(bluff => {
            if (bluff) {
                const bluffImg = document.createElement('img');
                bluffImg.src = cardUrlFor(bluff);
                bluffImg.alt = `${bluff} token`;
                bluffImg.style.maxWidth = 'min(25vw, 150px)';
                bluffImg.style.maxHeight = '30vh';
                bluffImg.style.borderRadius = '50%';
                bluffImg.style.background = '#111';
                bluffImg.style.boxShadow = 'var(--shadow)';
                bluffImg.onerror = () => bluffImg.remove();
                multiImageContainer.appendChild(bluffImg);
            }
        });
        
        img.style.display = 'none';
        fig.insertBefore(multiImageContainer, cap);
    
    // START OF CHANGE: Display Poisoner token for the Poisoner step
    } else if (step.role === "Poisoner") { 
        const tokenToShow = "Poisoner";
        fig.hidden = false;
        // Optionally update the caption to provide more context for the storyteller
        cap.textContent = "Poisoner: Choose Target"; 
        img.src = cardUrlFor(tokenToShow);
        img.alt = `${tokenToShow} token`;
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
