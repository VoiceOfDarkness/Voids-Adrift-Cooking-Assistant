const FLAVOR_TRAITS = ["Sweet","Savory","Sour","Bitter","Smoky","Spicy"];

const INGREDIENTS = {
  MantaMeat:        { label: "Manta Meat",        shape: { Savory:4, Smoky:1 } },
  ReefFishFillet:   { label: "Reef Fish Fillet",  shape: { Savory:5, Sour:1 } },
  SundropBerry:     { label: "Sundrop Berry",     shape: { Sweet:4, Sour:1 } },
  WildrootTuber:    { label: "Wildroot Tuber",    shape: { Savory:3, Bitter:1 } },
  HoneycombChunk:   { label: "Honeycomb Chunk",   shape: { Sweet:5, Savory:1 } },
  SaltedJerkyStrip: { label: "Salted Jerky Strip",shape: { Savory:4, Smoky:1 } },
  GlowcapMushroom:  { label: "Glowcap Mushroom",  shape: { Bitter:3, Savory:1 } },
  BitterleafGreen:  { label: "Bitterleaf Green",  shape: { Bitter:5, Sour:1 } },
  CitrusPod:        { label: "Citrus Pod",        shape: { Sour:5, Sweet:1 } },
  EmberPepper:      { label: "Ember Pepper",      shape: { Spicy:5, Savory:1 } },
  CustardFruit:     { label: "Custard Fruit",     shape: { Sweet:3, Savory:1 } },
};

const ARCHETYPES = {
  Sweet:  { label: "Sweet Treat" },
  Savory: { label: "Hearty Meal" },
  Sour:   { label: "Tangy Bite" },
  Bitter: { label: "Bitter Brew" },
  Smoky:  { label: "Smoked Plate" },
  Spicy:  { label: "Spicy Skewer" },
};

const TIER_THRESHOLDS = [0,15,21,25,30,35,40,45,50,55]; // index0 = tier1
const INGREDIENT_QUALITY_CAP = 5;
const HEAL_PER_TIER = 2;

const METHODS = {
  Grill: { label: "Grilled", adjective: "Charred", delivery: "Hybrid", instantFraction: 0.4, hotDuration: 8 },
  Fry:   { label: "Fried",   adjective: "Crispy",  delivery: "Instant" },
  Boil:  { label: "Boiled",  adjective: "Tender",  delivery: "OverTime", hotDuration: 18 },
};

const BUFF_CATEGORY = {
  Savory: "Vitality", Sweet: "Energy", Spicy: "Haste",
  Sour: "Resistance", Bitter: "Focus", Smoky: "Fortitude",
};
const BUFF_LABEL = { Vitality:"Vitality", Energy:"Energy", Haste:"Haste", Resistance:"Resistance", Focus:"Focus", Fortitude:"Fortitude" };
const MAGNITUDE_FORMULAS = {
  Vitality:   t => t*4,
  Energy:     t => 1 + t*0.03,
  Haste:      t => 1 + t*0.015,
  Resistance: t => t*0.03,
  Focus:      t => t*0.03,
  Fortitude:  t => t*0.03,
};
const METHOD_MAG_MULT = { Grill:1.0, Fry:1.2, Boil:0.9 };
const METHOD_DUR_MULT = { Grill:1.0, Fry:0.7, Boil:1.3 };
function baseDurationForTier(t){ return 60 + t*24; }

const BUFF_EFFECT_TEXT = {
  Vitality: "extra max health",
  Energy: "faster stamina regen",
  Haste: "faster movement speed",
  Resistance: "less fall damage",
  Focus: "bonus mining and harvesting damage",
  Fortitude: "less damage taken overall",
};

let state = {
  slots: [
    { ingredient: "EmberPepper", quality: 7 },
    { ingredient: "SaltedJerkyStrip", quality: 6 },
    { ingredient: "none", quality: 5 },
  ],
  method: "Grill",
  modifier: 0,
};

function computeFlavor(baseId, quality){
  const def = INGREDIENTS[baseId];
  if(!def) return null;
  quality = Math.max(1, Math.min(10, quality));
  const total = quality + 2;
  const traitsInOrder = FLAVOR_TRAITS.filter(t => def.shape[t] !== undefined);
  const weightSum = traitsInOrder.reduce((s,t) => s + def.shape[t], 0);
  const flavor = {};
  let assigned = 0;
  traitsInOrder.forEach((trait, i) => {
    if(i === traitsInOrder.length - 1){
      flavor[trait] = total - assigned;
    } else {
      const share = Math.floor(total * (def.shape[trait] / weightSum) + 0.5);
      flavor[trait] = share;
      assigned += share;
    }
  });
  return flavor;
}

function qualityForTotal(sum){
  let best = 1;
  for(let tier = 1; tier <= 10; tier++){
    if(sum >= TIER_THRESHOLDS[tier-1]) best = tier;
  }
  return best;
}

function render(){
  renderSlots();
  renderMethodButtons();
  document.getElementById("modVal").textContent = (state.modifier > 0 ? "+" : "") + state.modifier;
  computeAndRenderResult();
}

function renderSlots(){
  const container = document.getElementById("slots");
  container.innerHTML = "";
  state.slots.forEach((slot, idx) => {
    const row = document.createElement("div");
    row.className = "slot-row";
    const options = ['<option value="none">— empty —</option>']
      .concat(Object.keys(INGREDIENTS).map(id =>
        `<option value="${id}" ${slot.ingredient===id?"selected":""}>${INGREDIENTS[id].label}</option>`));
    row.innerHTML = `
      <div class="slot-num">${idx+1}</div>
      <div class="slot-select"><select data-idx="${idx}" class="ingredient-select">${options.join("")}</select></div>
      <div class="qty-wrap">
        <input type="range" min="1" max="10" step="1" value="${slot.quality}" class="quality-slider" data-idx="${idx}">
        <div class="qty-val">Q${slot.quality}</div>
      </div>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll(".ingredient-select").forEach(el => {
    el.addEventListener("change", e => {
      state.slots[+e.target.dataset.idx].ingredient = e.target.value;
      render();
    });
  });
  container.querySelectorAll(".quality-slider").forEach(el => {
    el.addEventListener("input", e => {
      const idx = +e.target.dataset.idx;
      const val = +e.target.value;
      state.slots[idx].quality = val;
      const row = e.target.closest(".slot-row");
      row.querySelector(".qty-val").textContent = "Q" + val;
      computeAndRenderResult();
    });
  });
}

function renderMethodButtons(){
  const container = document.getElementById("methodBtns");
  container.innerHTML = "";
  Object.keys(METHODS).forEach(m => {
    const btn = document.createElement("div");
    btn.className = "method-btn" + (state.method === m ? " active" : "");
    btn.textContent = m;
    btn.addEventListener("click", () => { state.method = m; render(); });
    container.appendChild(btn);
  });
}

document.getElementById("modSlider").addEventListener("input", e => {
  state.modifier = +e.target.value;
  document.getElementById("modVal").textContent = (state.modifier > 0 ? "+" : "") + state.modifier;
  computeAndRenderResult();
});


function computeAndRenderResult(){
  const panel = document.getElementById("resultPanel");

  const combined = {};
  FLAVOR_TRAITS.forEach(t => combined[t] = 0);
  let total = 0;
  let filledCount = 0;
  state.slots.forEach(slot => {
    if(slot.ingredient === "none") return;
    filledCount++;
    const flavor = computeFlavor(slot.ingredient, slot.quality);
    FLAVOR_TRAITS.forEach(t => {
      combined[t] += (flavor[t] || 0);
      total += (flavor[t] || 0);
    });
  });
  const anyIngredient = filledCount > 0;
  const totalSlots = state.slots.length;

  if(!anyIngredient){
    panel.innerHTML = `<div class="result-tag">Result</div><div class="dish-name">Add an ingredient</div><div class="dish-sub">Pick at least one ingredient to see the finished dish.</div>`;
    return;
  }

  // dominant trait, ties broken by canonical order (first max wins)
  let archetypeTrait = FLAVOR_TRAITS[0];
  let bestValue = -Infinity;
  FLAVOR_TRAITS.forEach(t => {
    if(combined[t] > bestValue){ bestValue = combined[t]; archetypeTrait = t; }
  });

  const rawTier = qualityForTotal(total);
  const baseTier = Math.min(rawTier, INGREDIENT_QUALITY_CAP);

  let effectiveModifier = state.modifier;
  if(state.modifier > 0){
    const scale = baseTier / INGREDIENT_QUALITY_CAP;
    effectiveModifier = Math.floor(state.modifier * scale + 0.5);
  }
  const finalTier = Math.max(1, Math.min(10, baseTier + effectiveModifier));
  const healAmount = HEAL_PER_TIER * finalTier;

  const methodDef = METHODS[state.method];
  const archetypeDef = ARCHETYPES[archetypeTrait];
  const category = BUFF_CATEGORY[archetypeTrait];
  const magnitude = MAGNITUDE_FORMULAS[category](finalTier) * METHOD_MAG_MULT[state.method];
  const duration = baseDurationForTier(finalTier) * METHOD_DUR_MULT[state.method];

  let magnitudeText;
  if(category === "Vitality") magnitudeText = "+" + Math.round(magnitude) + " max health";
  else if(category === "Energy") magnitudeText = "x" + magnitude.toFixed(2) + " stamina regen";
  else if(category === "Haste") magnitudeText = "x" + magnitude.toFixed(2) + " move speed";
  else magnitudeText = Math.round(magnitude*100) + "% " + BUFF_EFFECT_TEXT[category];

  let deliveryText;
  if(methodDef.delivery === "Instant") deliveryText = `Heal ${healAmount} HP instantly.`;
  else if(methodDef.delivery === "Hybrid"){
    const instant = Math.round(healAmount * methodDef.instantFraction);
    const rest = healAmount - instant;
    deliveryText = `Heal ${instant} HP instantly, then ${rest} HP over ${methodDef.hotDuration}s.`;
  } else {
    deliveryText = `Heal ${healAmount} HP over ${methodDef.hotDuration}s.`;
  }

  // tier bar: 10 segments. Gold = what the ingredients themselves earned
  // (up to baseTier, capped at Q5). Rust = whatever technique added on top
  // of that, up to finalTier. Anything above finalTier stays empty.
  let segs = "";
  for(let i=1;i<=10;i++){
    let cls = "tier-seg";
    if(i <= baseTier) cls += " base-fill";
    else if(i <= finalTier) cls += " bonus-fill";
    segs += `<div class="${cls}"></div>`;
  }

  const flavorMax = Math.max(...FLAVOR_TRAITS.map(t => combined[t]), 1);
  let flavorBars = "";
  FLAVOR_TRAITS.forEach(t => {
    const pct = Math.round((combined[t] / flavorMax) * 100);
    const isDom = t === archetypeTrait;
    flavorBars += `
      <div class="flavor-row">
        <div class="flavor-label">${t}</div>
        <div class="flavor-track"><div class="flavor-fill${isDom?' dominant':''}" style="width:${pct}%;"></div></div>
        <div class="flavor-num">${combined[t]}</div>
      </div>`;
  });

  let noticeHtml = "";
  if(filledCount < totalSlots){
    const missing = totalSlots - filledCount;
    const ingredientWord = filledCount === 1 ? "ingredient" : "ingredients";
    const missingWord = missing === 1 ? "ingredient" : "ingredients";
    noticeHtml = `
      <div class="notice-box">
        <div class="notice-icon">!</div>
        <div>You're missing ${missing} ${missingWord}. This result is based on just <b>${filledCount} ${ingredientWord}</b> — add ${missing === 1 ? "one more" : "more"} to see the full dish.</div>
      </div>`;
  }

  panel.innerHTML = `
    ${noticeHtml}
    <div class="result-tag">${methodDef.adjective} · Q${finalTier}</div>
    <div class="dish-name">${archetypeDef.label}</div>
    <div class="dish-sub">${methodDef.label} · total flavor ${total}</div>

    <div class="tier-track">${segs}</div>
    <div class="tier-caption"><span><span style="color:var(--gold);">■</span> ingredients (cap Q${INGREDIENT_QUALITY_CAP})</span><span><span style="color:var(--rust);">■</span> technique</span></div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Base tier (ingredients)</div><div class="stat-value">Q${baseTier}</div></div>
      <div class="stat-card"><div class="stat-label">Final tier</div><div class="stat-value">Q${finalTier}</div></div>
      <div class="stat-card"><div class="stat-label">Technique effect</div><div class="stat-value">${effectiveModifier >= 0 ? "+" : ""}${effectiveModifier}</div></div>
      <div class="stat-card"><div class="stat-label">Heal amount</div><div class="stat-value">${healAmount} HP</div></div>
    </div>

    <div class="heal-box"><b>Delivery:</b> ${deliveryText}</div>

    <div class="buff-box" style="margin-top:14px;">
      <div class="label">Well fed buff</div>
      <div class="value">${BUFF_LABEL[category]}, ${magnitudeText}</div>
      <div class="sub">Lasts ${Math.round(duration)}s</div>
    </div>

    <div class="flavor-bars">${flavorBars}</div>
  `;
}

render();
