// server/src/models/nutritionEntry.model.js
import mongoose from "mongoose";

/** Food item logged by the user for a date */
const LoggedFoodSchema = new mongoose.Schema(
  {
    foodId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    kcal: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    servings: { type: Number, default: 1, min: 0 },
    category: { type: String, default: "veg" },
  },
  { _id: false }
);

const RecipeSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    ingredients: [
      {
        name: { type: String, trim: true },
        qty: { type: Number, default: 0 },
        unit: { type: String, trim: true },
      },
    ],
    steps: [{ type: String }],
    macros: {
      kcal: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
    },
  },
  { _id: false }
);

const NutritionEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    items: { type: [LoggedFoodSchema], default: [] },
    recipe: { type: RecipeSchema, default: undefined },
  },
  { timestamps: true }
);

NutritionEntrySchema.index({ user: 1, date: 1 }, { unique: true });

const NutritionEntry =
  mongoose.models.NutritionEntry || mongoose.model("NutritionEntry", NutritionEntrySchema);

export default NutritionEntry;
