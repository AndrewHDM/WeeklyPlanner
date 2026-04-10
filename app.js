const STORAGE_KEYS = {
  commitments: "weeklyPlanner.commitments",
  weeklyInput: "weeklyPlanner.weeklyInput",
  outputs: "weeklyPlanner.outputs"
};

const defaultRules = {
  workoutRules: {
    travelIntensityMultiplier: 0.7,
    overloadedWeekUsesMinimumViable: true,
    lowRecoveryThreshold: 2,
    highStressThreshold: 4,
    prioritizeConsistency: true
  },
  templates: {
    briefTitle: "Weekly Planning Brief",
    monkHeading: "Monk Manual Weekly Setup"
  }
};

let rules = defaultRules;
let commitments = loadJson(STORAGE_KEYS.commitments, []);

init();

async function init() {
  await loadRules();
  renderCommitments();
  hydrateWeeklyForm();
  hydrateOutputs();

  document.getElementById("commitmentForm").addEventListener("submit", onAddCommitment);
  document.getElementById("saveCommitmentsBtn").addEventListener("click", () => {
    persistCommitments();
    alert("Commitments saved locally.");
  });

  document.getElementById("weeklyForm").addEventListener("submit", onGenerateOutputs);

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-copy");
      const content = document.getElementById(targetId).innerText;
      await navigator.clipboard.writeText(content || "");
      btn.innerText = "Copied";
      setTimeout(() => (btn.innerText = "Copy"), 1200);
    });
  });
}

async function loadRules() {
  try {
    const response = await fetch("./rules.config.json");
    if (response.ok) {
      rules = await response.json();
    }
  } catch {
    rules = defaultRules;
  }
}

function onAddCommitment(event) {
  event.preventDefault();
  const name = document.getElementById("commitmentName").value.trim();
  const day = document.getElementById("commitmentDay").value;
  const window = document.getElementById("commitmentWindow").value.trim();
  if (!name || !day || !window) return;

  commitments.push({ id: crypto.randomUUID(), name, day, window });
  persistCommitments();
  renderCommitments();
  event.target.reset();
}

function renderCommitments() {
  const list = document.getElementById("commitmentList");
  list.innerHTML = "";

  commitments.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span><strong>${item.day}</strong> · ${item.name} (${item.window})</span>`;
    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary-btn";
    removeBtn.innerText = "Remove";
    removeBtn.addEventListener("click", () => {
      commitments = commitments.filter((c) => c.id !== item.id);
      persistCommitments();
      renderCommitments();
    });
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function hydrateWeeklyForm() {
  const formData = loadJson(STORAGE_KEYS.weeklyInput, null);
  if (!formData) return;
  const form = document.getElementById("weeklyForm");

  Object.entries(formData).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  });
}

function onGenerateOutputs(event) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));

  const evaluated = evaluateWorkoutPlan(data, rules.workoutRules);
  const outputs = {
    brief: generateBrief(data, evaluated),
    monk: generateMonkBlock(data, evaluated),
    workout: generateWorkoutText(data, evaluated)
  };

  localStorage.setItem(STORAGE_KEYS.weeklyInput, JSON.stringify(data));
  localStorage.setItem(STORAGE_KEYS.outputs, JSON.stringify(outputs));

  document.getElementById("briefOutput").innerText = outputs.brief;
  document.getElementById("monkOutput").innerText = outputs.monk;
  document.getElementById("workoutOutput").innerText = outputs.workout;
}

function evaluateWorkoutPlan(input, workoutRules) {
  const recovery = Number(input.recovery);
  const stress = Number(input.stress);
  const realistic = Number(input.realisticSessions);
  const minimum = Number(input.minimumViableSessions);

  let targetSessions = realistic;
  const reasons = [];

  if (input.weekType === "overloaded" && workoutRules.overloadedWeekUsesMinimumViable) {
    targetSessions = minimum;
    reasons.push("Overloaded week detected → using minimum viable sessions.");
  }

  if (input.travel === "yes") {
    targetSessions = Math.max(minimum, Math.floor(targetSessions * workoutRules.travelIntensityMultiplier));
    reasons.push("Travel week detected → reducing training intensity and total sessions.");
  }

  if (recovery <= workoutRules.lowRecoveryThreshold || stress >= workoutRules.highStressThreshold) {
    targetSessions = Math.max(minimum, Math.min(targetSessions, minimum + 1));
    reasons.push("Low recovery or high stress → avoid forcing volume.");
  }

  if (workoutRules.prioritizeConsistency) {
    reasons.push("Consistency prioritized over perfect volume.");
  }

  const intensity = input.travel === "yes" || recovery <= 2 || stress >= 4 ? "low-to-moderate" : "moderate";

  return { targetSessions, intensity, reasons };
}

function generateBrief(input, evaluated) {
  return `${rules.templates.briefTitle}\n\nWeekly focus: ${input.weeklyFocus || "(not specified)"}\nWeek type: ${input.weekType}\nTravel: ${input.travel}\nRecovery / Sleep / Stress: ${input.recovery} / ${input.sleepConsistency} / ${input.stress}\n\nStanding changes:\n${input.standingChanges || "- none"}\n\nOne-off events:\n${input.oneOffEvents || "- none"}\n\nNon-negotiables:\n${input.nonNegotiables || "- none"}\n\nFitness priorities:\n${input.fitnessPriorities || "- none"}\n\nRecurring commitments:\n${formatCommitments()}\n\nWorkout guidance:\n- Target sessions: ${evaluated.targetSessions}\n- Intensity: ${evaluated.intensity}\n- Rationale:\n${evaluated.reasons.map((x) => `  • ${x}`).join("\n")}`;
}

function generateMonkBlock(input, evaluated) {
  return `${rules.templates.monkHeading}\n\nTop Focus: ${input.weeklyFocus || "TBD"}\nNon-Negotiables:\n${bulletize(input.nonNegotiables)}\n\nWeekly Constraints:\n${bulletize(input.oneOffEvents)}\n\nTraining Commitment:\n- Sessions: ${evaluated.targetSessions}\n- Intensity: ${evaluated.intensity}\n- Minimum floor: ${input.minimumViableSessions}\n\nRecovery anchors:\n- Sleep consistency target: ${input.sleepConsistency}/5\n- Recovery score baseline: ${input.recovery}/5\n- Stress management: ${input.stress}/5`;
}

function generateWorkoutText(input, evaluated) {
  const sessions = [];
  for (let i = 1; i <= evaluated.targetSessions; i += 1) {
    sessions.push(`Session ${i}: ${sessionType(i, input.fitnessPriorities)} (${evaluated.intensity})`);
  }

  return `Suggested Workout Plan\n\nPriority areas: ${input.fitnessPriorities || "general fitness"}\nRealistic sessions: ${input.realisticSessions}\nMinimum viable sessions: ${input.minimumViableSessions}\nFinal target sessions: ${evaluated.targetSessions}\n\n${sessions.join("\n")}\n\nFallback rule: If week gets compressed, complete the first ${input.minimumViableSessions} sessions only.`;
}

function sessionType(index, prioritiesText) {
  const base = (prioritiesText || "strength, cardio, mobility").toLowerCase();
  const options = base.split(",").map((x) => x.trim()).filter(Boolean);
  if (!options.length) return "mixed training";
  return options[(index - 1) % options.length];
}

function formatCommitments() {
  if (!commitments.length) return "- none yet";
  return commitments.map((c) => `- ${c.day}: ${c.name} (${c.window})`).join("\n");
}

function bulletize(text) {
  if (!text || !text.trim()) return "- none";
  return text
    .split(/\n|;/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `- ${x}`)
    .join("\n");
}

function persistCommitments() {
  localStorage.setItem(STORAGE_KEYS.commitments, JSON.stringify(commitments));
}

function hydrateOutputs() {
  const outputs = loadJson(STORAGE_KEYS.outputs, null);
  if (!outputs) return;
  document.getElementById("briefOutput").innerText = outputs.brief || "";
  document.getElementById("monkOutput").innerText = outputs.monk || "";
  document.getElementById("workoutOutput").innerText = outputs.workout || "";
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
