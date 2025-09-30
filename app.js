// ===== BOTC — Trouble Brewing Storyteller (presets + poisoned + reroll + picker) =====
(() => {
  "use strict";

  // --- tiny dom helpers
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  // --- app state
  let DATA = null;
  let RNG  = null;                 // seeded rng
  const STEP_STATE = new Map();    // key -> {isPoisoned, truthfulValue, poisonedValue, revealType}
  let POISONED_ROLE_FOR_NIGHT = null; // Tracks the poisoner's target for the current night

  // --- RNG (deterministic per "Generate")
  function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
  function newSeed(){ return (Date.now()>>>0) ^ (Math.random()*0xFFFFFFFF>>>0); }
  function randChoice(arr){ return arr[Math.floor(RNG()*arr.length)] }
  function randInt(min,max){ return Math.floor(RNG()*(max-min+1))+min }

  // --- assets
  function cardUrlFor(name){ return `assets/cards/${String(name).replace(/\s+/g,"-")}.png`; }

  // --- load JSON
  async function loadJSON(url){
    const res = await fetch(url, {cache: "no-store"}); if(!res.ok) throw new Error(res.statusText);
    return res.json();
  }

  // --- boot
  document.addEventListener("DOMContentLoaded", async () => {
    try { DATA = await loadJSON("tbData.json"); } catch(e){ alert("Failed to load tbData.json"); throw e; }
    renderRoleForm(DATA);

    qs("#generateBtn").addEventListener("click", onGenerate);
    qs("#resetBtn").addEventListener("click", resetAll);
    qs("#toggleMetaBtn").addEventListener("click", toggleMeta);

    // text card controls
    qs("#textCardCloseBtn").addEventListener("click", closeTextCard);
    qs("#poisonToggle").addEventListener("change", onPoisonToggle);
    qs("#pickBtn").addEventListener("click", openPicker);

    // picker
    qs("#pickerCancel").addEventListener("click", closePicker);
    qs("#pickerSearch").addEventListener("input", filterPicker);

    // keys
    document.addEventListener("keydown", (e)=>{
      const k=e.key.toLowerCase();
      if(k==="p" && qs("#textCard").classList.contains("show")){ qs("#poisonToggle").click(); }
      if(k==="escape"){ closeTextCard(); closePicker(); }
    });
  });

  // --- roles form
  function renderRoleForm(data){
    const byTeam = {
      Townsfolk: data.roles.filter(r=>r.team==="Townsfolk"),
      Outsider:  data.roles.filter(r=>r.team==="Outsider"),
      Minion:    data.roles.filter(r=>r.team==="Minion"),
      Demon:     data.roles.filter(r=>r.team==="Demon")
    };

    // Pre-calculate lists for integrated dropdowns
    const towns = data.roles.filter(r=>r.team==="Townsfolk").map(r=>r.name);
    const outsiders = data.roles.filter(r=>r.team==="Outsider").map(r=>r.name);
    const minions = data.roles.filter(r=>r.team==="Minion").map(r=>r.name);
    
    const form = qs("#roleForm");
    form.innerHTML = ["Townsfolk","Outsider","Minion","Demon"].map(team => `
      <fieldset>
        <legend>${team}</legend>
        ${byTeam[team].map(r => {
            let presetHtml = '';
            
            switch(r.name) {
                case "Washerwoman":
                    presetHtml = `
                        <select id="presetWasherwomanRole" name="presetWasherwomanRole" class="role-preset-select" style="display: none;">
                            <option value="">— select Townsfolk —</option>
                            ${towns.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>`;
                    break;
                case "Librarian":
                    presetHtml = `
                        <select id="presetLibrarianRole" name="presetLibrarianRole" class="role-preset-select" style="display: none;">
                            <option value="">— none (show 0) —</option>
                            ${outsiders.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>`;
                    break;
                case "Investigator":
                    presetHtml = `
                        <select id="presetInvestigatorRole" name="presetInvestigatorRole" class="role-preset-select" style="display: none;">
                            <option value="">— select Minion —</option>
                            ${minions.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>`;
                    break;
                case "Chef":
                    presetHtml = `<input type="number" id="presetChefNumber" name="presetChefNumber" class="role-preset-select" style="display: none;" min="0" placeholder="#">`;
                    break;
            }
            
            const nameInputHtml = `<input type="text" class="player-name-input" data-role-name="${r.name}" placeholder="Player Name" style="display: none;">`;

            return `
                <div class="role-item">
                    <label><input type="checkbox" name="role" value="${r.name}"> ${r.name}</label>
                    ${nameInputHtml}
                    ${presetHtml}
                </div>
            `;
        }).join("")}
      </fieldset>
    `).join("");

    // sensible defaults
    ["Imp","Poisoner","Washerwoman","Librarian","Investigator","Chef","Fortune Teller","Empath"].forEach(v=>{
      const cb=form.querySelector(`input[value="${CSS.escape(v)}"]`); if(cb) cb.checked=true;
    });

    // Always include the Imp and make it non-editable
    const impCheckbox = form.querySelector(`input[value="Imp"]`);
    if (impCheckbox) {
      impCheckbox.checked = true;
      impCheckbox.disabled = true;
      impCheckbox.parentElement.style.cursor = "not-allowed";
      impCheckbox.parentElement.style.opacity = "0.6";
      impCheckbox.parentElement.title = "The Imp is always in play.";
    }

    // Add event listeners to show/hide dropdowns and name inputs
    qsa('input[name="role"]').forEach(checkbox => {
      const parent = checkbox.closest('.role-item');
      const childrenToToggle = parent.querySelectorAll('.role-preset-select, .player-name-input');
      
      const toggleChildren = (show) => {
        childrenToToggle.forEach(child => {
            child.style.display = show ? 'inline-block' : 'none';
        });
      };

      // Initial visibility check for sensible defaults
      toggleChildren(checkbox.checked);

      checkbox.addEventListener('change', (e) => {
        toggleChildren(e.target.checked);
      });
    });
  }

  // --- reading player names
  function readPlayerNames() {
    const nameMap = new Map();
    qsa('.player-name-input').forEach(input => {
        if (input.value.trim() !== '') {
            nameMap.set(input.dataset.roleName, input.value.trim());
        }
    });
    return nameMap;
  }

  // --- reading presets
  function readPresets(){
    return {
      Washerwoman: qs("#presetWasherwomanRole")?.value  || "",
      Librarian:   qs("#presetLibrarianRole")?.value   || "",
      Investigator:qs("#presetInvestigatorRole")?.value|| "",
      Chef:        qs("#presetChefNumber")?.value      || "",
      Undertaker:  qs("#presetUndertakerRole")?.value  || "", // Will no longer exist, optional chaining prevents errors
      Ravenkeeper: qs("#presetRavenkeeperPeek")?.value || ""   // Will no longer exist, optional chaining prevents errors
    };
  }

  // --- Generate script
  function onGenerate(){
    RNG = mulberry32(newSeed());
    STEP_STATE.clear(); // new night
    POISONED_ROLE_FOR_NIGHT = null; // Reset poison target each night
    renderList("firstNightList", DATA.firstNight);
    renderList("eachNightList",  DATA.eachNight);
    goFullscreen();
  }

  function renderList(id, arr){
    const ol=qs("#"+id); ol.innerHTML="";
    const rolesInPlay = qsa('#roleForm input[type="checkbox"]:checked').map(cb => cb.value);
    const playerNames = readPlayerNames();

    arr.forEach((step, idx)=>{
      // Only add steps for roles that are in play, or for general text steps
      if (!step.role || rolesInPlay.includes(step.role)) {
        const li=document.createElement("li");
        const mainText = step.ask || step.text || step.role || "(step)";
        
        let roleDisplay = step.role;
        if (step.role && playerNames.has(step.role)) {
            roleDisplay = `${step.role} (${playerNames.get(step.role)})`;
        }

        li.innerHTML = (step.role && step.ask) ? `<strong>${roleDisplay}:</strong> ${mainText}` : mainText;
        li.dataset.stepKey = `${id}:${idx}`;
        li.dataset.role    = step.role || "";
        li.dataset.revealType = step.revealType || "";
        li.addEventListener("click", ()=> openStep(id, idx, step, li));
        ol.appendChild(li);
      }
    });
  }

  // --- open a step (fullscreen Ask + controls)
  function openStep(listId, index, step, clickedLi){
    // Highlight the clicked list item
    qsa("li.active").forEach(li => li.classList.remove("active"));
    if (clickedLi) clickedLi.classList.add("active");

    const key = `${listId}:${index}`;
    const state = ensureState(key, step);

    // Automatically apply poison if this role was targeted by the Poisoner
    if (step.role && step.role === POISONED_ROLE_FOR_NIGHT) {
        state.isPoisoned = true;
    }

    // decide what to display based on poisoned flag
    const value = state.isPoisoned ? ensurePoisonedValue(state, step) : ensureTruthfulValue(state, step);

    // big text
    qs("#textCardText").textContent  = step.ask || "";

    // controls row visibility & pill
    const pickBtn = qs("#pickBtn");
    const supportsValue = !!(step.revealType || step.role === "Poisoner");
    const isInfoList = step.revealType === 'info_list';
    pickBtn.style.display = (supportsValue && !isInfoList) ? 'inline-block' : 'none';

    // show token / number / boolean / OR custom list
    if (isInfoList) {
        renderInfoList(step);
    } else {
        renderValueDisplay(step, value);
    }

    // show overlay
    qs("#textCard").classList.add("show");
    qs("#textCard").setAttribute("aria-hidden", "false");

    // stash current identifiers for control handlers
    qs("#textCard").dataset.key = key;
  }

  function ensureState(key, step){
    if(!STEP_STATE.has(key)){
      STEP_STATE.set(key, {
        isPoisoned: false,
        truthfulValue: null,
        poisonedValue: null,
        revealType: step.revealType || inferRevealType(step.role)
      });
    }
    return STEP_STATE.get(key);
  }

  function inferRevealType(role){
    // fallbacks if JSON omitted it
    if(["Washerwoman","Librarian","Investigator","Undertaker","Ravenkeeper"].includes(role)) return "token";
    if(["Chef","Empath"].includes(role)) return "numeric";
    if(role==="Fortune Teller") return "boolean";
    return ""; // no value
  }

  // create truthful value from presets/runtime picker if needed
  function ensureTruthfulValue(state, step){
    if(state.truthfulValue!=null) return state.truthfulValue;

    const preset = readPresets();
    let v = null;

    if(state.revealType === "token"){
        if(step.role==="Washerwoman")  v = preset.Washerwoman || null;
        if(step.role==="Librarian")    v = preset.Librarian   || null; // blank means “0”
        if(step.role==="Investigator") v = preset.Investigator|| null;
        if(step.role==="Undertaker")   v = preset.Undertaker  || null;
        if(step.role==="Ravenkeeper")  v = preset.Ravenkeeper || null;
        if(step.role==="Scarlet Woman") v = "Imp"; // fixed mapping
    } else if(state.revealType === "numeric") {
        if(step.role === "Chef") v = preset.Chef || null;
        // Other numeric roles like Empath will default to null, requiring runtime picking
    }
    
    state.truthfulValue = v;
    return state.truthfulValue;
  }

  // generate poisoned value using randomPolicy
  function ensurePoisonedValue(state, step){
    if(state.poisonedValue!=null) return state.poisonedValue;
    const pol = step.randomPolicy || findRolePolicy(step.role) || {};
    if(state.revealType==="numeric"){
      if(Array.isArray(pol.values)) state.poisonedValue = randChoice(pol.values);
      else state.poisonedValue = randInt(pol.min ?? 0, pol.max ?? 2);
    }else if(state.revealType==="boolean"){
      const p = typeof pol.pTrue==="number" ? pol.pTrue : 0.5;
      state.poisonedValue = (RNG() < p) ? "Yes" : "No";
    }else if(state.revealType==="token"){
      // Librarian: allow zero?
      if(pol.allowZero && RNG() < (pol.pZero ?? 0.2)){ state.poisonedValue = "0"; }
      else{
        const pool = poolFor(pol.pool || teamForRole(step.role));
        state.poisonedValue = randChoice(pool);
      }
    }else{
      state.poisonedValue = null;
    }
    return state.poisonedValue;
  }

  function findRolePolicy(role){
    const r = DATA.roles.find(x=>x.name===role);
    return r?.randomPolicy || null;
  }

  function teamForRole(role){
    return (DATA.roles.find(r=>r.name===role)?.team) || "Any";
  }

  function poolFor(poolName){
    const names = DATA.roles.map(r=>r.name);
    if(poolName==="Any") return names;
    if(poolName==="Townsfolk") return DATA.roles.filter(r=>r.team==="Townsfolk").map(r=>r.name);
    if(poolName==="Outsider")  return DATA.roles.filter(r=>r.team==="Outsider").map(r=>r.name);
    if(poolName==="Minion")    return DATA.roles.filter(r=>r.team==="Minion").map(r=>r.name);
    if(poolName==="Demon")     return DATA.roles.filter(r=>r.team==="Demon").map(r=>r.name);
    return names;
  }

  // render the big value area (token image or text value)
  function renderValueDisplay(step, value){
    const fig = qs("#textCardFigure");
    const img = qs("#textCardTokenImg");
    const cap = qs("#textCardTokenCaption");

    // reset
    fig.hidden = true; 
    img.onerror=null; 
    img.removeAttribute("src"); 
    img.removeAttribute("alt"); 
    cap.textContent = "";

    if(step.revealType==="token"){
      const token = tokenToShow(step.role, value);
      if(!token || token==="0"){ cap.textContent = token==="0" ? "0" : ""; return; }
      fig.hidden = false;
      cap.textContent = token;
      const url = cardUrlFor(token);
      img.alt = token + " token"; img.src=url;
      img.onerror = () => { img.onerror=null; img.removeAttribute("src"); };
    }else if(step.revealType==="numeric" || step.revealType==="boolean"){
      // show big caption text (no image)
      fig.hidden = false;
      cap.textContent = value ?? "";
    }
  }

  // render special info lists (minion/demon info)
  function renderInfoList(step) {
    const fig = qs("#textCardFigure");
    const cap = qs("#textCardTokenCaption");
    fig.hidden = false;
    qs("#textCardTokenImg").removeAttribute("src"); // ensure no old image shows

    const rolesInPlay = qsa('#roleForm input:checked').map(cb => cb.value);
    const playerNames = readPlayerNames();
    
    const minions = [];
    let demon = null;

    rolesInPlay.forEach(roleName => {
        const roleData = DATA.roles.find(r => r.name === roleName);
        const playerName = playerNames.get(roleName) || roleName;
        if (roleData.team === 'Minion') minions.push(playerName);
        if (roleData.team === 'Demon') demon = playerName;
    });

    let html = '';
    if (step.id === 'minion_info') {
        html = `<h4>Demon</h4><ul><li>${demon || 'Unknown'}</li></ul>`;
    } else if (step.id === 'demon_info') {
        html = `<h4>Minions</h4><ul>${minions.map(m => `<li>${m}</li>`).join('') || '<li>None</li>'}</ul>`;
    }
    cap.innerHTML = html;
  }

  function tokenToShow(role, picked){
    if(role==="Scarlet Woman") return "Imp";
    return picked;
  }

  function updateStatusPill(state, step){
    const pill = qs("#statusPill");
    if(!(step.revealType)) { pill.textContent=""; return; }
    const mode = state.isPoisoned ? "Poisoned" : "Truthful";
    const val  = state.isPoisoned ? state.poisonedValue : state.truthfulValue;
    pill.textContent = `${mode}${val!=null ? ` · ${val}` : ""}`;
  }

  // --- controls handlers
  function onPoisonToggle(){
    const key = qs("#textCard").dataset.key; if(!key) return;
    const liInfo = parseKey(key);
    const step = (liInfo.listId==="firstNightList" ? DATA.firstNight : DATA.eachNight)[liInfo.index];
    const state = ensureState(key, step);
    state.isPoisoned = !!qs("#poisonToggle").checked;
    const val = state.isPoisoned ? ensurePoisonedValue(state, step) : ensureTruthfulValue(state, step);
    renderValueDisplay(step, val);
    updateStatusPill(state, step);
  }

  function openPicker(){
    const key = qs("#textCard").dataset.key; if(!key) return;
    const liInfo = parseKey(key);
    const step = (liInfo.listId==="firstNightList" ? DATA.firstNight : DATA.eachNight)[liInfo.index];
    const playerNames = readPlayerNames();
    
    // Special handler for the Poisoner to select their target for the night
    if (step.role === "Poisoner") {
      const rolesInPlay = qsa('#roleForm input[type="checkbox"]:checked').map(cb => cb.value);
      // Filter for only Townsfolk and Outsiders in play
      const potentialTargets = rolesInPlay.filter(roleName => {
        const roleInfo = DATA.roles.find(r => r.name === roleName);
        return roleInfo && (roleInfo.team === "Townsfolk" || roleInfo.team === "Outsider");
      });

      buildPicker(potentialTargets, playerNames);
      qs("#picker").classList.add("show");
      qs("#picker").setAttribute("aria-hidden","false");
      qs("#pickerTitle").textContent = "Select poison target";

      qsa(".picker-item").forEach(item=>{
        item.addEventListener("click", ()=>{
          const choice = item.dataset.value;
          const targetName = playerNames.get(choice) || choice;
          POISONED_ROLE_FOR_NIGHT = choice; // Set the global poison target
          closePicker();
          // Give feedback to the storyteller on the main card
          qs("#textCardText").textContent = `You have poisoned the ${targetName}.`;
          qs("#controlRow").style.display = 'none'; // Hide controls after picking
        });
      });
      return; // Exit here to prevent normal picker logic from running
    }

    // Default picker logic for all other roles
    const state = ensureState(key, step);
    const type = step.revealType || state.revealType;
    if(type==="token"){
      const poolName = (step.randomPolicy?.pool) || teamForRole(step.role) || "Any";
      let pool = poolFor(poolName);

      // Exclude info roles from their own picker lists
      if (["Washerwoman", "Librarian", "Investigator"].includes(step.role)) {
        pool = pool.filter(roleName => roleName !== step.role);
      }

      buildPicker(pool, playerNames);
      qs("#picker").classList.add("show");
      qs("#picker").setAttribute("aria-hidden","false");

      // when you click an item…
      qsa(".picker-item").forEach(item=>{
        item.addEventListener("click", ()=>{
          const choice = item.dataset.value;
          if(state.isPoisoned){ state.poisonedValue = choice; }
          else { state.truthfulValue = choice; }
          closePicker();
          const value = state.isPoisoned ? state.poisonedValue : state.truthfulValue;
          renderValueDisplay(step, value);
          updateStatusPill(state, step);
        });
      });
    } else if (type==="numeric" || type==="boolean"){
      // chips for numeric/boolean
      const opts = type==="numeric"
        ? (step.randomPolicy?.values ?? [0,1,2,"≥3"])
        : ["Yes","No"];
      buildPicker(opts); // No player names needed for numeric/boolean choices
      qs("#picker").classList.add("show");
      qs("#picker").setAttribute("aria-hidden","false");
      qsa(".picker-item").forEach(item=>{
        item.addEventListener("click", ()=>{
          const choice = item.dataset.value;
          if(state.isPoisoned){ state.poisonedValue = choice; }
          else { state.truthfulValue = choice; }
          closePicker();
          const value = state.isPoisoned ? state.poisonedValue : state.truthfulValue;
          renderValueDisplay(step, value);
          updateStatusPill(state, step);
        });
      });
    }
  }

  function buildPicker(options, playerNames = new Map()){
    const list = qs("#pickerList"); const search = qs("#pickerSearch");
    search.value=""; list.innerHTML = "";
    options.forEach(name=>{
      const div=document.createElement("div");
      div.className="picker-item";
      div.dataset.value = name;
      const playerName = playerNames.get(String(name));
      const displayText = playerName ? `${name} (${playerName})` : name;
      div.innerHTML = `<span>${displayText}</span><small>Select</small>`;
      list.appendChild(div);
    });
  }

  function filterPicker(){
    const q = qs("#pickerSearch").value.trim().toLowerCase();
    qsa(".picker-item").forEach(el=>{
      const hit = el.textContent.toLowerCase().includes(q);
      el.style.display = hit ? "" : "none";
    });
  }

  function closePicker(){
    qs("#picker").classList.remove("show");
    qs("#picker").setAttribute("aria-hidden","true");
    qs("#pickerList").innerHTML="";
    qs("#pickerTitle").textContent = "Pick a role"; // Reset title
  }

  // --- fullscreen helpers
  async function goFullscreen(){
    const sec = qs("#scriptSection"); sec.classList.add("fullscreen");
    if (!document.fullscreenElement){ try{ await document.documentElement.requestFullscreen?.(); }catch{} }
    if (!qs("#exitFullscreenBtn")){
      const b=document.createElement("button"); b.id="exitFullscreenBtn"; b.textContent="Exit";
      b.addEventListener("click", exitFullscreen); document.body.appendChild(b);
    }
  }
  async function exitFullscreen(){
    qs("#scriptSection")?.classList.remove("fullscreen");
    qs("#exitFullscreenBtn")?.remove();
    if(document.fullscreenElement){ try{ await document.exitFullscreen(); }catch{} }
  }

  function closeTextCard(){
    qs("#textCard").classList.remove("show");
    qs("#textCard").setAttribute("aria-hidden","true");
  }

  // --- meta + reset
  function toggleMeta(){
    const btn=qs("#toggleMetaBtn");
    const showing = btn.getAttribute("aria-pressed")==="true";
    btn.setAttribute("aria-pressed", String(!showing));
    btn.textContent = showing ? "Show Ask/Reveal" : "Hide Ask/Reveal";
    qsa(".meta").forEach(el=> el.style.display = showing ? "none" : "");
  }

  function resetAll(){
    qs("#roleForm").reset();
    qs("#firstNightList").innerHTML="";
    qs("#eachNightList").innerHTML="";
    STEP_STATE.clear();
    // Re-enable the Imp checkbox on full reset
    const impCheckbox = qs('#roleForm input[value="Imp"]');
    if (impCheckbox) {
      impCheckbox.disabled = false;
    }
  }

  function parseKey(key){
    const [listId, idx] = key.split(":");
    return { listId, index: +idx };
  }
})();