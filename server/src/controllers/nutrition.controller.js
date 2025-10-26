import path from "path";
import fs from "fs";
import NutritionEntry from "../models/nutritionEntry.model.js";

const getUserId = (req) => req.user?._id || req.user?.id || req.user;

/* ---------- Catalog loader (normalized, with fallback) ---------- */
const FALLBACK_FOODS = [
  { id: "roti_30g", name: "Roti (30 g atta)", kcal: 76, protein: 2.9, carbs: 16.2, fat: 0.5, category: "veg" },
  { id: "dal_tadka_150g", name: "Dal Tadka (150 g)", kcal: 175, protein: 9.7, carbs: 21.3, fat: 4.8, category: "veg" },
  { id: "paneer_100g", name: "Paneer (100 g)", kcal: 256, protein: 17.7, carbs: 5.9, fat: 19.7, category: "veg" },
  { id: "chicken_breast_100g", name: "Chicken Breast, grilled (100 g)", kcal: 171, protein: 32.1, carbs: 0, fat: 3.7, category: "nonveg" },
  { id: "banana_1_medium", name: "Banana (1 medium)", kcal: 106, protein: 1.3, carbs: 27.3, fat: 0.3, category: "veg" },
];

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

let cachedCatalog = null;
export const getCatalog = async (_req, res) => {
  try {
    if (!cachedCatalog) {
      // Adjust path if you keep the JSON elsewhere
      const filePath = path.join(process.cwd(), "server", "src", "data", "indian_foods_608.json");
      let json = [];
      if (fs.existsSync(filePath)) {
        const txt = fs.readFileSync(filePath, "utf8");
        json = JSON.parse(txt);
      }
      cachedCatalog = normalizeCatalog(json);
    }
    res.json({ ok: true, data: cachedCatalog });
  } catch (e) {
    res.status(200).json({ ok: true, data: normalizeCatalog([]) });
  }
};

/* ---------- CRUD: per-day log ---------- */
// Upsert day (replace items entirely)
export const upsertDay = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { date, items, recipe } = req.body || {};
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "Invalid 'date' (YYYY-MM-DD)" });
    }

    const safeItems = Array.isArray(items)
      ? items.map((it) => ({
          foodId: String(it.foodId || it.id || "").slice(0, 120),
          name: String(it.name || "").slice(0, 160),
          kcal: Number(it.kcal) || 0,
          protein: Number(it.protein) || 0,
          carbs: Number(it.carbs) || 0,
          fat: Number(it.fat) || 0,
          servings: Math.max(0, Number(it.servings) || 0),
          category: String(it.category || "veg"),
        }))
      : undefined;

    const safeRecipe = recipe && typeof recipe === "object"
      ? {
          title: String(recipe.title || "").slice(0, 180),
          ingredients: Array.isArray(recipe.ingredients)
            ? recipe.ingredients
                .slice(0, 25)
                .map((x) => ({
                  name: String(x?.name || x?.item || "").slice(0, 160),
                  qty: Number(x?.qty ?? x?.quantity ?? 0) || 0,
                  unit: String(x?.unit || "").slice(0, 24),
                }))
            : [],
          steps: Array.isArray(recipe.steps)
            ? recipe.steps.slice(0, 30).map((s) => String(s).slice(0, 400))
            : [],
          macros: {
            kcal: Number(recipe?.macros?.kcal) || undefined,
            protein: Number(recipe?.macros?.protein) || undefined,
            carbs: Number(recipe?.macros?.carbs) || undefined,
            fat: Number(recipe?.macros?.fat) || undefined,
          },
        }
      : undefined;

    const $set = {};
    if (safeItems) $set.items = safeItems;
    if (safeRecipe) $set.recipe = safeRecipe;

    const doc = await NutritionEntry.findOneAndUpdate(
      { user: userId, date },
      Object.keys($set).length ? { $set } : { $setOnInsert: { user: userId, date } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ ok: true, data: doc });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

// Get a single day
export const getDay = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { date } = req.params || {};
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });
    if (!date) return res.status(400).json({ ok: false, error: "date param required" });

    const doc = await NutritionEntry.findOne({ user: userId, date }).lean();
    return res.json({ ok: true, data: doc || null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

// Get range
export const listRange = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { start, end } = req.query || {};
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });
    if (!start || !end) {
      return res.status(400).json({ ok: false, error: "start & end (YYYY-MM-DD) required" });
    }

    const items = await NutritionEntry.find({
      user: userId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .lean();

    return res.json({ ok: true, data: items });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

// Delete a single day
export const removeDay = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { date } = req.params || {};
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });
    if (!date) return res.status(400).json({ ok: false, error: "date param required" });

    await NutritionEntry.deleteOne({ user: userId, date });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
