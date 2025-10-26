// src/components/HomePage/Special_Nutrients/SpecialistNutrition.js
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Container, Row, Col, Card, Badge, Button,
  Form, InputGroup, Spinner, Table
} from "react-bootstrap";
import { GoogleFitContext } from "../../../context/GoogleFitProvider";
import { api } from "../../../lib/api";
import classes from "./SpeicalistNutrition.module.css";

// ✅ Use your regular-only JSON (adjust path if needed)
import foodsJson from "./indian_foods_608.json";

/* ---------------- Constants & helpers ---------------- */
const gramsPerMacro = { carb: 4, protein: 4, fat: 9 };
const TZ = "Asia/Kolkata";
const LS_RECIPE_KEY = "specialist_recipe_v1";

const startOfDay = (ms) => {
  const d = new Date(ms);
  const s = d.toLocaleDateString("en-CA", { timeZone: TZ });
  return new Date(`${s}T00:00:00.000`).getTime();
};
const endOfDay = (ms) => startOfDay(ms) + (24 * 60 * 60 * 1000 - 1);

// Fallback list (only used if foodsJson is empty/not an array)
const FALLBACK_FOODS = [
  { id: "roti_30g", name: "Roti (30 g atta)", kcal: 76, protein: 2.9, carbs: 16.2, fat: 0.5, category: "veg" },
  { id: "dal_tadka_150g", name: "Dal Tadka (150 g)", kcal: 175, protein: 9.7, carbs: 21.3, fat: 4.8, category: "veg" },
  { id: "paneer_100g", name: "Paneer (100 g)", kcal: 256, protein: 17.7, carbs: 5.9, fat: 19.7, category: "veg" },
  { id: "chicken_breast_100g", name: "Chicken Breast, grilled (100 g)", kcal: 171, protein: 32.1, carbs: 0, fat: 3.7, category: "nonveg" },
  { id: "banana_1_medium", name: "Banana (1 medium)", kcal: 106, protein: 1.3, carbs: 27.3, fat: 0.3, category: "veg" },
];

/** Minimal normalization (slim JSON is already regular-only & simple) */
function normalizeCatalog(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return FALLBACK_FOODS;
  return raw
    .map((r, idx) => ({
      id: String(r.id || r.name || `food_${idx}`).toLowerCase().replace(/\s+/g, "_"),
      name: String(r.name || `Food ${idx + 1}`),
      kcal: Math.round(Number(r.kcal ?? 0)),
      protein: Math.round(Number(r.protein ?? 0) * 10) / 10,
      carbs: Math.round(Number(r.carbs ?? 0) * 10) / 10,
      fat: Math.round(Number(r.fat ?? 0) * 10) / 10,
      category: r.category || "veg",
    }))
    .filter((f) => f.name && (f.kcal || f.protein || f.carbs || f.fat));
}

function estimateActivityFromSteps(steps) {
  if (steps == null) return "light";
  if (steps > 12000) return "active";
  if (steps > 8000) return "moderate";
  if (steps < 3000) return "sedentary";
  return "light";
}
function estimateTDEE({ caloriesOut24h, weightKg = 70, heightCm = 170, age = 25, sex = "male", steps24h }) {
  if (caloriesOut24h && caloriesOut24h > 800) return Math.round(caloriesOut24h);
  const s = sex === "female" ? -161 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s;
  const act = estimateActivityFromSteps(steps24h);
  const activityMap = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  return Math.round(bmr * (activityMap[act] || 1.375));
}
function pickGoalFromBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm) return "recomp";
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  if (bmi >= 27) return "cut";
  if (bmi <= 20) return "bulk";
  return "recomp";
}
function computeTargets(metrics) {
  const { weightKg = 70, heightCm = 170, age = 25, sex = "male", steps24h, caloriesOut24h } = metrics || {};
  const tdee = estimateTDEE({ caloriesOut24h, weightKg, heightCm, age, sex, steps24h });
  const goal = pickGoalFromBMI(weightKg, heightCm);
  const adj = goal === "cut" ? 0.85 : goal === "bulk" ? 1.12 : 1.0;
  const targetCal = Math.max(1200, Math.round(tdee * adj));
  const proteinPerKg = goal === "cut" ? 1.8 : 1.6;
  const protein = Math.round(weightKg * proteinPerKg);
  const fatKcal = Math.round(targetCal * 0.25);
  const fat = Math.round(fatKcal / gramsPerMacro.fat);
  const proteinKcal = protein * gramsPerMacro.protein;
  const carbKcal = Math.max(0, targetCal - fatKcal - proteinKcal);
  const carbs = Math.round(carbKcal / gramsPerMacro.carb);
  const waterMl = Math.round(weightKg * 35);
  return { tdee, targetCal, protein, fat, carbs, waterMl, goal };
}

/* ---------- Donut ---------- */
function Donut({ consumed = 0, target = 1, label = "kcal" }) {
  const pct = Math.max(0, Math.min(1, consumed / Math.max(1, target)));
  const R = 52;
  const C = 2 * Math.PI * R;
  const stroke = 10;
  const dash = `${pct * C} ${C}`;
  return (
    <svg viewBox="0 0 140 140" className={classes.donut} aria-label={`${label} donut`}>
      <circle cx="70" cy="70" r={R} strokeWidth={stroke} className={classes.donutTrack} />
      <circle
        cx="70" cy="70" r={R} strokeWidth={stroke}
        className={classes.donutFill}
        style={{ strokeDasharray: dash, strokeDashoffset: 0 }}
      />
      <g textAnchor="middle">
        <text x="70" y="66" className={classes.donutValue}>{Math.round(consumed)}</text>
        <text x="70" y="86" className={classes.donutLabel}>/ {Math.round(target)} {label}</text>
      </g>
    </svg>
  );
}

/* ---------------- Recipe view (clean, no stars) ---------------- */
function RecipeView({ recipe }) {
  if (!recipe) return null;
  const { title, ingredients = [], steps = [], macros = {} } = recipe || {};

  return (
    <div className={classes.recipeWrap} aria-live="polite">
      <div className={classes.recipeHeader}>
        <h5 className={classes.recipeTitle}>{title || "Meal"}</h5>
        <div className={classes.recipeMacros}>
          <span>Kcal: <strong>{macros.kcal ?? "—"}</strong></span>
          <span>Protein: <strong>{macros.protein ?? "—"} g</strong></span>
          <span>Carbs: <strong>{macros.carbs ?? "—"} g</strong></span>
          <span>Fat: <strong>{macros.fat ?? "—"} g</strong></span>
        </div>
      </div>

      <div className={classes.recipeGrid}>
        <div>
          <div className={classes.recipeSectionTitle}>Ingredients</div>
          <ul className={classes.ingredientList}>
            {ingredients.map((ing, i) => {
              const name = ing?.name ?? ing?.item ?? ing ?? "";
              const qty = ing?.qty ?? ing?.quantity ?? "";
              const unit = ing?.unit ?? "";
              return (
                <li key={i} className={classes.ingredientRow}>
                  <span className={classes.ingredientDot} aria-hidden="true" />
                  <span className={classes.ingredientText}>
                    {name}
                    {(qty || unit) && (
                      <span className={classes.ingredientQty}>
                        {" "}({qty}{unit ? ` ${unit}` : ""})
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className={classes.recipeSectionTitle}>Steps</div>
          <ol className={classes.stepList}>
            {steps.map((s, i) => (
              <li key={i} className={classes.stepItem}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main component ---------------- */
export default function SpecialistNutrition() {
  const {
    account, statusLoading, healthLoading, lastError,
    metrics,
    linkGoogleFit,
    refreshAllHealthData, refreshMetrics, refreshNutrition
  } = useContext(GoogleFitContext);

  /* Dates */
  const [end, setEnd] = useState(() => new Date());
  const [start, setStart] = useState(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const startMs = useMemo(() => startOfDay(start.getTime()), [start]);
  const endMs = useMemo(() => endOfDay(end.getTime()), [end]);
  const formattedStart = useMemo(() => new Date(startMs).toISOString().slice(0, 10), [startMs]);
  const formattedEnd = useMemo(() => new Date(endMs).toISOString().slice(0, 10), [endMs]);

  /* Load health data when linked/date changes */
  useEffect(() => {
    if (!account?.linked) return;
    (async () => { await refreshAllHealthData(startMs, endMs, TZ); })();
  }, [account?.linked, startMs, endMs, refreshAllHealthData]);

  /* Targets + UI state */
  const targets = useMemo(() => computeTargets(metrics || {}), [metrics]);
  const [veg, setVeg] = useState(true);
  const [search, setSearch] = useState("");

  // Food catalog (already regular-only + simple; normalize just for safety)
  const [catalog] = useState(() => normalizeCatalog(foodsJson));

  // track what's been added today
  const [dayItems, setDayItems] = useState([]);
  const [recipeObj, setRecipeObj] = useState(null);
  const [recipeError, setRecipeError] = useState("");
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Load saved recipe on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_RECIPE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setRecipeObj(parsed);
        }
      }
    } catch {}
  }, []);

  const saveRecipeToLocal = (obj) => {
    try { localStorage.setItem(LS_RECIPE_KEY, JSON.stringify(obj)); } catch {}
  };

  const totals = useMemo(
    () =>
      dayItems.reduce(
        (a, it) => ({
          kcal: a.kcal + (Number(it.kcal) || 0) * it.servings,
          protein: a.protein + (Number(it.protein) || 0) * it.servings,
          carbs: a.carbs + (Number(it.carbs) || 0) * it.servings,
          fat: a.fat + (Number(it.fat) || 0) * it.servings,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [dayItems]
  );

  const remaining = {
    kcal: Math.max(0, Math.round((targets.targetCal || 0) - totals.kcal)),
    protein: Math.max(0, Math.round((targets.protein || 0) - totals.protein)),
    carbs: Math.max(0, Math.round((targets.carbs || 0) - totals.carbs)),
    fat: Math.max(0, Math.round((targets.fat || 0) - totals.fat)),
  };

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = catalog.filter((f) => (f.name || "").toLowerCase().includes(q));
    if (veg) return base.filter((f) => (f.category || "veg") === "veg");
    return base;
  }, [search, veg, catalog]);

  /* ---------- Actions ---------- */
  const updateDateFromInput = (setter) => (e) => {
    const dt = new Date(e.target.value);
    if (!isNaN(dt.getTime())) setter(dt);
  };

  const addFoodItem = (food) => {
    setDayItems((prev) => {
      const existing = prev.find((item) => item.id === food.id);
      if (existing) return prev.map((i) => (i.id === food.id ? { ...i, servings: i.servings + 1 } : i));
      return [...prev, { ...food, servings: 1 }];
    });
  };
  const decFoodItem = (id) => {
    setDayItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, servings: i.servings - 1 } : i))
        .filter((i) => i.servings > 0)
    );
  };
  const removeFoodItem = (id) => setDayItems((prev) => prev.filter((i) => i.id !== id));
  const clearFoodItems = () => setDayItems([]);

  // Generate a meal suggestion JSON from the server
  async function generateMealSuggestion() {
    setSuggestionLoading(true);
    setRecipeError("");
    try {
      const pref = veg ? "Vegetarian" : "Non-veg";

      const prompt = [
        `Role: You are a professional Indian sports nutrition chef.`,
        `Task: Build exactly ONE ${pref} Indian-style meal to help user hit remaining macros.`,
        `User remaining today: ~${remaining.kcal} kcal; Protein ${remaining.protein} g; Carbs ${remaining.carbs} g; Fat ${remaining.fat} g.`,
        `Daily targets: ${targets.targetCal} kcal (P ${targets.protein} g, C ${targets.carbs} g, F ${targets.fat} g).`,
        `Constraints: Use common Indian ingredients. Keep steps short & numbered logically.`,
        `STRICT OUTPUT: Return JSON ONLY. No markdown. No asterisks. No emojis.`,
        `Schema keys: title (string), ingredients (array of objects: {name, qty (number), unit}), steps (array of strings), macros (object: {kcal, protein, carbs, fat}).`,
        `Example minimal JSON: {"title":"Paneer Bhurji Bowl","ingredients":[{"name":"Paneer","qty":150,"unit":"g"}],"steps":["Crumble paneer"],"macros":{"kcal":520,"protein":35,"carbs":40,"fat":22}}`
      ].join("\n");

      // Keep the existing endpoint; only the UI language changed
      const { data } = await api.post("/api/ai/gemini", { prompt });

      // Parse strict JSON; strip possible fences
      let text = data?.text ?? "";
      text = String(text).replace(/^```json\s*|\s*```$/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        const cleaned = text
          .replace(/[\u2600-\u27BF]/g, "")
          .replace(/[★☆⭐•●◦▪︎▫︎]+/g, "")
          .trim();
        parsed = JSON.parse(cleaned);
      }

      const safe = {
        title: String(parsed?.title || "Meal"),
        ingredients: Array.isArray(parsed?.ingredients) ? parsed.ingredients.map((x) => ({
          name: String(x?.name || x?.item || "").trim(),
          qty: Number(x?.qty ?? x?.quantity ?? 0) || 0,
          unit: String(x?.unit || "").trim()
        })).filter(x => x.name) : [],
        steps: Array.isArray(parsed?.steps) ? parsed.steps.map((s) => String(s).replace(/^\d+\.\s*/, "").trim()).filter(Boolean) : [],
        macros: {
          kcal: Math.round(Number(parsed?.macros?.kcal ?? 0)) || undefined,
          protein: Math.round(Number(parsed?.macros?.protein ?? 0)) || undefined,
          carbs: Math.round(Number(parsed?.macros?.carbs ?? 0)) || undefined,
          fat: Math.round(Number(parsed?.macros?.fat ?? 0)) || undefined,
        }
      };

      setRecipeObj(safe);
      saveRecipeToLocal(safe);
    } catch (e) {
      console.error("Meal suggestion failed:", e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Could not create a meal suggestion.";
      setRecipeError(String(msg));
    } finally { setSuggestionLoading(false); }
  }

  const fetchAllInRange = async () => {
    if (!account?.linked) return;
    await refreshAllHealthData(startMs, endMs, TZ);
  };
  const fetchOnly = async (kind) => {
    if (!account?.linked) return;
    if (kind === "metrics") await refreshMetrics(startMs, endMs, TZ);
    if (kind === "nutrition") await refreshNutrition(startMs, endMs);
  };

  const consumed = { kcal: totals.kcal };
  const target = { kcal: targets.targetCal || 0 };

  /* ---------- Render ---------- */
  return (
    <div className={classes.nutrition}>
      <Container>
        {/* Header */}
        <Row className="mb-3">
          <Col className="d-flex align-items-center justify-content-between">
            <div>
              <h3 className={`fw-bold mb-1 ${classes.pageTitle}`}>Specialist Nutrition</h3>
              <div className={`text-muted ${classes.pageSub}`}>User panel (left) • Scrollable food catalog (right)</div>
            </div>
            <div className="d-flex align-items-center gap-2">
              {statusLoading ? (<Spinner size="sm" />) : account?.linked ? (
                <>
                  <Badge bg="success">Google Fit Connected</Badge>
                  <Button size="sm" className={`${classes.btnOutline}`} onClick={fetchAllInRange}>Refresh</Button>
                </>
              ) : (
                <Button className={classes.btnPrimary} onClick={linkGoogleFit}>Connect Google Fit</Button>
              )}
            </div>
          </Col>
        </Row>

        {/* Date Range */}
        <Row className="mb-3">
          <Col>
            <Card className={classes.card}>
              <Card.Body className={`d-flex flex-wrap align-items-end gap-3 ${classes.rangeCard}`}>
                <div>
                  <div className="small text-muted mb-1">Start date</div>
                  <Form.Control
                    type="date"
                    aria-label="Start date"
                    value={formattedStart}
                    onChange={updateDateFromInput(setStart)}
                    style={{ minWidth: 160 }}
                  />
                </div>
                <div>
                  <div className="small text-muted mb-1">End date</div>
                  <Form.Control
                    type="date"
                    aria-label="End date"
                    value={formattedEnd}
                    onChange={updateDateFromInput(setEnd)}
                    style={{ minWidth: 160 }}
                  />
                </div>
                <div className={classes.rangeActions}>
                  <Button size="sm" className={classes.btnPrimary} onClick={fetchAllInRange}>Fetch All</Button>
                  <Button size="sm" className={classes.btnOutline} onClick={() => fetchOnly("metrics")}>Metrics</Button>
                  <Button size="sm" className={classes.btnOutline} onClick={() => fetchOnly("nutrition")}>Nutrition</Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Dashboard Row */}
        <Row>
          {/* LEFT: User panel / ring / remaining / totals table */}
          <Col lg={4} className="mb-4">
            <Card className={classes.card}>
              <Card.Body className={classes.dashboard}>
                <div className="d-flex align-items-center gap-3">
                  <div className={classes.avatar}>
                    {String(account?.profileName || "U").trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="fw-bold">{account?.profileName || "User"}</div>
                    <div className="small text-muted">{account?.email || "—"}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="d-flex justify-content-between small text-muted"><span>Goal</span><span className="fw-semibold">{(targets.goal || "").toUpperCase()}</span></div>
                  <div className="d-flex justify-content-between small text-muted"><span>TDEE</span><span className="fw-semibold">{targets.tdee} kcal</span></div>
                  <div className="d-flex justify-content-between small text-muted"><span>Water target</span><span className="fw-semibold">{targets.waterMl} ml</span></div>
                </div>

                <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-3">
                  <Donut consumed={consumed.kcal} target={target.kcal} label="kcal" />
                  <div className="text-end">
                    <div className="small text-muted mb-1">Remaining today</div>
                    <div className="d-flex flex-wrap gap-2 justify-content-end">
                      <span className={classes.pill}>Kcal {remaining.kcal}</span>
                      <span className={classes.pill}>Protein {remaining.protein}g</span>
                      <span className={classes.pill}>Carbs {remaining.carbs}g</span>
                      <span className={classes.pill}>Fat {remaining.fat}g</span>
                    </div>
                  </div>
                </div>

                <Row className="g-2 mt-3">
                  <Col xs={6}><Card className={`${classes.metricCard} ${classes.statCard}`}><div className={classes.metricLabel}>Steps (24h)</div><div className={`${classes.metricValue} ${classes.statValue}`}>{metrics?.steps24h ?? "0"}</div></Card></Col>
                  <Col xs={6}><Card className={`${classes.metricCard} ${classes.statCard}`}><div className={classes.metricLabel}>Energy out</div><div className={`${classes.metricValue} ${classes.statValue}`}>{metrics?.caloriesOut24h ?? "0"}<span className="fs-6"> kcal</span></div></Card></Col>
                  <Col xs={6}><Card className={`${classes.metricCard} ${classes.statCard}`}><div className={classes.metricLabel}>Sleep</div>
                    <div className={`${classes.metricValue} ${classes.statValue}`}>
                      {metrics?.sleepMinutes24h != null
                        ? `${Math.floor(metrics.sleepMinutes24h / 60)}h ${metrics.sleepMinutes24h % 60}m` : "—"}
                    </div>
                  </Card></Col>
                  <Col xs={6}><Card className={`${classes.metricCard} ${classes.statCard}`}><div className={classes.metricLabel}>Resting HR</div><div className={`${classes.metricValue} ${classes.statValue}`}>{metrics?.restingHeartRate ?? "—"} bpm</div></Card></Col>
                </Row>

                {/* Added items summary */}
                <div className="mt-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className={classes.blockTitle}>Today’s items</div>
                    <Button variant="link" className="p-0 text-danger" onClick={clearFoodItems} disabled={!dayItems.length}>Clear all</Button>
                  </div>
                  {dayItems.length === 0 ? (
                    <div className="small text-muted">No items added yet.</div>
                  ) : (
                    <div className={classes.tableWrap}>
                      <Table size="sm" bordered responsive className={`${classes.table} mb-2`}>
                        <thead className="table-light">
                          <tr>
                            <th>Item</th>
                            <th className="text-center">Servings</th>
                            <th className="text-end">kcal</th>
                            <th className="text-end">Protein</th>
                            <th className="text-end">Carbs</th>
                            <th className="text-end">Fat</th>
                            <th className="text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayItems.map((it) => (
                            <tr key={it.id}>
                              <td>{it.name}</td>
                              <td className="text-center">{it.servings}</td>
                              <td className="text-end">{Math.round((Number(it.kcal)||0) * it.servings)}</td>
                              <td className="text-end">{Math.round((Number(it.protein)||0) * it.servings)}</td>
                              <td className="text-end">{Math.round((Number(it.carbs)||0) * it.servings)}</td>
                              <td className="text-end">{Math.round((Number(it.fat)||0) * it.servings)}</td>
                              <td className="text-end">
                                <div className="d-inline-flex gap-1">
                                  <Button size="sm" variant="outline-secondary" onClick={() => decFoodItem(it.id)}>-</Button>
                                  <Button size="sm" variant="outline-secondary" onClick={() => addFoodItem(it)}>+</Button>
                                  <Button size="sm" variant="outline-danger" onClick={() => removeFoodItem(it.id)}>x</Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th>Total</th>
                            <th className="text-center">—</th>
                            <th className="text-end">{Math.round(totals.kcal)}</th>
                            <th className="text-end">{Math.round(totals.protein)}</th>
                            <th className="text-end">{Math.round(totals.carbs)}</th>
                            <th className="text-end">{Math.round(totals.fat)}</th>
                            <th />
                          </tr>
                        </tfoot>
                      </Table>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* RIGHT: Food catalog */}
          <Col lg={8} className="mb-4">
            <Card className={classes.card}>
              <Card.Header className={`${classes.cardHeader} ${classes.stickyHeader}`}>
                <div className="d-flex flex-wrap w-100 align-items-center gap-2">
                  <div className="fw-semibold me-auto">Food Catalog (Regular size)</div>
                  <InputGroup size="sm" className={classes.catalogSearch}>
                    <Form.Control
                      placeholder="Search food item…"
                      aria-label="Search food"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Button className={veg ? classes.btnPrimary : classes.btnOutline} onClick={() => setVeg(true)} aria-pressed={veg}>Veg</Button>
                    <Button className={!veg ? classes.btnPrimary : classes.btnOutline} onClick={() => setVeg(false)} aria-pressed={!veg}>Non-veg</Button>
                  </InputGroup>
                </div>
              </Card.Header>

              <Card.Body className={classes.foodScrollBody}>
                <div className={classes.foodGrid}>
                  {filteredFoods.map((food) => (
                    <FoodCard key={food.id} food={food} onAdd={addFoodItem} />
                  ))}
                </div>
              </Card.Body>

              <Card.Footer className={classes.cardFooterNote}>
                Showing one standardized entry per dish. Macros/kcal are normalized to regular serving sizes.
              </Card.Footer>
            </Card>
          </Col>
        </Row>

        {/* Meal Recommendation */}
        <Row>
          <Col lg={12} className="mb-4">
            <Card className={classes.card}>
              <Card.Header className={classes.cardHeader}>Meal Recommendation</Card.Header>
              <Card.Body>
                <div className="d-flex gap-1 mb-2">
                  <Button size="sm" className={veg ? classes.btnPrimary : classes.btnOutline} onClick={() => setVeg(true)}>Veg</Button>
                  <Button size="sm" className={!veg ? classes.btnPrimary : classes.btnOutline} onClick={() => setVeg(false)}>Non-veg</Button>
                </div>

                <div className={classes.recipeActions}>
                  <Button onClick={generateMealSuggestion} disabled={suggestionLoading} size="sm" className={classes.btnPrimary}>
                    {suggestionLoading ? (<><Spinner size="sm" className="me-1" /> Creating…</>) : (recipeObj ? "Create another" : "Create suggestion")}
                  </Button>

                  {recipeObj && !suggestionLoading && (
                    <Button onClick={generateMealSuggestion} size="sm" className={classes.btnOutline}>
                      Not feeling this? Try a different one
                    </Button>
                  )}
                </div>

                {!suggestionLoading && !recipeObj && !recipeError && (
                  <div className={`${classes.recipeHint} mt-2`}>
                    Click to create a regular-size Indian meal tailored to your remaining macros.
                  </div>
                )}
                {recipeError && <div className="mt-2 text-danger small">{recipeError}</div>}
                {recipeObj && <div className="mt-3"><RecipeView recipe={recipeObj} /></div>}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {(statusLoading || healthLoading) && (
          <div className="text-center text-muted small my-2"><Spinner size="sm" className="me-1" /> syncing…</div>
        )}
        {!account?.linked && !statusLoading && (
          <div className="text-center text-muted small my-2">Connect Google Fit to see live metrics and nutrition history.</div>
        )}
        {lastError && (
          <div className="text-center my-2"><span className="text-danger small">{lastError}</span></div>
        )}
      </Container>
    </div>
  );
}

/* ---------------- Small card for food items ---------------- */
function FoodCard({ food, onAdd }) {
  const img =
    "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=800&auto=format&fit=crop";
  return (
    <Card className={classes.foodCard}>
      <div className={classes.foodImgWrap}>
        <img src={img} alt={food.name} className={classes.foodImg} />
        <Badge bg="light" text="dark" className={classes.kcalBadge}>
          {Math.round(food.kcal)} kcal
        </Badge>
      </div>
      <Card.Body className={classes.foodBody}>
        <div className={classes.foodTitle}>{food.name}</div>
        <div className={classes.foodMacros}>
          Protein {Number(food.protein).toFixed(1)}g • Carbs {Number(food.carbs).toFixed(1)}g • Fat {Number(food.fat).toFixed(1)}g
        </div>
        <div className="d-flex justify-content-end">
          <Button
            size="sm"
            className={classes.btnPrimary}
            onClick={() => onAdd(food)}
            aria-label={`Add ${food.name}`}
          >
            Add +
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
