"""
ollama-interface.py
Location: services/recommender-service/src/ml/ollama-interface.py

Contract with app.js:
  - Reads one JSON object from stdin (user profile + CGM data)
  - Prints exactly one JSON object to stdout:
      {"status": "ok", "parsed_plan": {"day_plan": {...}, "summary": {...}}}
    or
      {"status": "error", "message": "..."}
  - Diagnostics go to stderr only (stdout must stay clean JSON)

Environment variables:
  OLLAMA_URL           e.g. http://ollama:11434
  OLLAMA_MODEL         e.g. llama3.2-3b-local
  OLLAMA_TIMEOUT       seconds per request (default 180)
  OLLAMA_MAX_ATTEMPTS  generation attempts incl. retries (default 3)
"""

import json
import os
import re
import sys

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
OLLAMA_BASE_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
REQUEST_TIMEOUT_SECONDS = int(os.environ.get("OLLAMA_TIMEOUT", "180"))
MAX_ATTEMPTS = max(1, int(os.environ.get("OLLAMA_MAX_ATTEMPTS", "3")))

MEAL_KEYS = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"]

# Share of the daily calories assigned to each meal (sums to 1.0)
MEAL_SHARES = {
    "breakfast": 0.25,
    "morning_snack": 0.10,
    "lunch": 0.30,
    "afternoon_snack": 0.10,
    "dinner": 0.25,
}

# Target share of daily calories coming from carbohydrates (whole-day constant;
# NOT adjusted by any single CGM reading).
CARB_FRACTION = 0.40
CARB_SHARE_MIN = 0.30
CARB_SHARE_MAX = 0.50


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def as_list(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [v for v in value if v not in (None, "")]
    return [value] if value != "" else []


def to_int(value, default=0):
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def med_to_str(m):
    if isinstance(m, dict):
        return m.get("name") or str(m)
    return str(m)


def join_or_none(values):
    return ", ".join(str(v) for v in values) if values else "None"


# ---------------------------------------------------------------------------
# Input (from Node via stdin)
# ---------------------------------------------------------------------------
try:
    input_data = json.load(sys.stdin)
except Exception as e:
    print(json.dumps({"status": "error", "message": f"Invalid input: {str(e)}"}))
    sys.exit(1)

# NOTE: cgm_data and trend are read for contract compatibility only. The plan
# covers a whole day, so a single average/trend must not shape its glycemic profile.
cgm_data = input_data.get("cgm_data")
trend = input_data.get("trend", "stable")

age = input_data.get("age", 30)
gender = input_data.get("gender")
medications = as_list(input_data.get("medications"))
liked_meals = as_list(input_data.get("liked_meals"))
disliked_meals = as_list(input_data.get("disliked_meals"))
dietary_restrictions = as_list(input_data.get("dietary_restrictions"))
additional_conditions = as_list(input_data.get("additional_conditions"))

daily_calories = to_int(input_data.get("daily_calories"), 2000)
if daily_calories <= 0:
    daily_calories = 2000

# Day total must NEVER exceed the goal and may be at most 100 kcal below it.
CAL_MAX = daily_calories
CAL_MIN = max(daily_calories - 100, 0)
CAL_TARGET = daily_calories - 50


def meal_targets():
    kcal = {k: round(CAL_TARGET * s) for k, s in MEAL_SHARES.items()}
    kcal["lunch"] += CAL_TARGET - sum(kcal.values())  # absorb rounding drift
    return {
        k: {"kcal": v, "carbs_g": round(v * CARB_FRACTION / 4)} for k, v in kcal.items()
    }


# ---------------------------------------------------------------------------
# JSON schema (Ollama constrains output to this shape)
# ---------------------------------------------------------------------------
MEAL_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "estimated_cooking_time": {"type": "string"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "item": {
                        "type": "string",
                        "description": "Food name including portion size, e.g. 'Cooked quinoa (120g)'",
                    },
                    "calories": {"type": "integer"},
                },
                "required": ["item", "calories"],
            },
        },
        "instructions": {
            "type": "string",
            "description": "Short numbered preparation steps in one string",
        },
        "total_calories": {"type": "integer"},
        "beverages": {"type": "array", "items": {"type": "string"}},
        "glucose_impact": {
            "type": "string",
            "enum": ["Low glycemic impact", "Moderate glycemic impact"],
        },
        "carbs_g": {"type": "integer"},
        "protein_g": {"type": "integer"},
        "fiber_g": {"type": "integer"},
        "fat_g": {"type": "integer"},
    },
    "required": [
        "title",
        "estimated_cooking_time",
        "items",
        "instructions",
        "total_calories",
        "beverages",
        "glucose_impact",
        "carbs_g",
        "protein_g",
        "fiber_g",
        "fat_g",
    ],
}

MEAL_PLAN_SCHEMA = {
    "type": "object",
    "properties": {key: MEAL_SCHEMA for key in MEAL_KEYS},
    "required": MEAL_KEYS,
}


# ---------------------------------------------------------------------------
# Code-side restriction / dislike checking (does not rely on the model)
# ---------------------------------------------------------------------------
def rx(terms):
    ordered = sorted(terms, key=len, reverse=True)
    return re.compile(r"\b(?:" + "|".join(re.escape(t) for t in ordered) + r")(?:s|es)?\b", re.I)


MEAT = ["chicken", "beef", "pork", "lamb", "turkey", "duck", "goose", "veal", "venison",
        "bacon", "ham", "sausage", "salami", "pepperoni", "prosciutto", "pancetta",
        "steak", "mince", "meatball", "gelatin", "lard"]
FISH = ["fish", "tuna", "salmon", "cod", "tilapia", "trout", "sardine", "anchovy",
        "anchovies", "mackerel", "haddock", "herring"]
SHELLFISH = ["shellfish", "shrimp", "prawn", "crab", "lobster", "crayfish", "clam",
             "mussel", "oyster", "scallop", "squid", "calamari", "octopus"]
DAIRY = ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "whey", "casein",
         "ghee", "kefir", "ice cream", "paneer", "labneh", "custard", "buttermilk",
         "curd", "ricotta", "mozzarella", "parmesan", "feta", "skyr", "halloumi"]
EGG = ["egg", "mayonnaise", "mayo", "meringue", "omelet", "omelette", "frittata",
       "quiche", "hollandaise", "aioli"]
NUTS = ["nut", "peanut", "almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut",
        "macadamia", "pine nut", "brazil nut", "nutella", "marzipan", "praline"]
SOY = ["soy", "soya", "soybean", "tofu", "tempeh", "edamame", "miso", "tamari", "soy sauce"]
GLUTEN = ["wheat", "barley", "rye", "bread", "pasta", "spaghetti", "macaroni", "noodle",
          "couscous", "bulgur", "semolina", "farro", "spelt", "seitan", "flour", "oat",
          "oatmeal", "cereal", "cracker", "biscuit", "pita", "bagel", "croissant",
          "pancake", "waffle", "cake", "cookie", "pizza", "soy sauce", "beer", "malt",
          "freekeh", "orzo", "udon", "tortilla", "muffin", "granola", "breadcrumb", "bran"]
PORK = ["pork", "bacon", "ham", "lard", "prosciutto", "pancetta", "salami", "pepperoni"]
ALCOHOL = ["alcohol", "wine", "beer", "rum", "brandy", "whiskey", "vodka", "liqueur"]

DAIRY_SAFE = re.compile(
    r"\b(?:almond|oat|soy|soya|coconut|rice|cashew|hemp|pea|plant[- ]based|dairy[- ]free)\s+"
    r"(?:milk|yogh?urt|butter|cheese|cream|creamer)\b"
    r"|\b(?:peanut|almond|cashew|sunflower seed|cocoa|shea)\s+butter\b"
    r"|\bcream of tartar\b|\bcoconut cream\b",
    re.I,
)
GLUTEN_SAFE = re.compile(
    r"\bgluten[- ]free\s+\w+"
    r"|\b(?:almond|coconut|rice|chickpea|buckwheat|quinoa|corn|tapioca|potato)\s+"
    r"(?:flour|pasta|noodle)s?\b|\bcorn tortilla\b",
    re.I,
)

# (trigger words matched against the normalized restriction, forbidden terms, safe-phrase regex)
RESTRICTION_RULES = [
    (("gluten", "celiac", "coeliac", "wheat"), GLUTEN, GLUTEN_SAFE),
    (("dairy", "lactose", "milk"), DAIRY, DAIRY_SAFE),
    (("nut", "peanut", "tree-nut", "almond", "walnut", "cashew"), NUTS, None),
    (("egg",), EGG, None),
    (("shellfish", "crustacean"), SHELLFISH, None),
    (("seafood",), FISH + SHELLFISH, None),
    (("fish",), FISH, None),
    (("soy",), SOY, None),
    (("vegetarian",), MEAT + FISH + SHELLFISH, None),
    (("vegan",), MEAT + FISH + SHELLFISH + DAIRY + EGG + ["honey"], DAIRY_SAFE),
    (("pescatarian",), MEAT, None),
    (("halal",), PORK + ALCOHOL + ["gelatin"], None),
    (("kosher",), PORK + SHELLFISH, None),
    (("pork",), PORK, None),
]
DISLIKE_CATEGORIES = {
    "fish": FISH, "seafood": FISH + SHELLFISH, "shellfish": SHELLFISH, "meat": MEAT,
    "pork": PORK, "dairy": DAIRY, "egg": EGG, "nut": NUTS, "soy": SOY,
}
DIET_NAMES = {"vegan", "vegetarian", "pescatarian", "halal", "kosher"}


def compile_checks():
    """Return list of (label, kind, regex, safe_regex) for every restriction and dislike."""
    checks = []
    for raw in dietary_restrictions:
        label = str(raw).strip()
        norm = re.sub(r"[_\s]+", "-", label.lower())
        matched = False
        for triggers, terms, safe in RESTRICTION_RULES:
            if any(re.search(r"(?<![a-z])" + re.escape(t), norm) for t in triggers):
                checks.append((label, "restriction", rx(terms), safe))
                matched = True
        if not matched and norm not in DIET_NAMES:
            term = re.sub(r"^(no|without)-", "", norm)
            term = re.sub(r"-free$", "", term).replace("-", " ").strip()
            if len(term) >= 3:
                checks.append((label, "restriction", rx([term]), None))
    for raw in disliked_meals:
        label = str(raw).strip().lower()
        if len(label) >= 2:
            terms = DISLIKE_CATEGORIES.get(label.rstrip("s"), []) + [label]
            checks.append((label, "dislike", rx(terms), None))
    return checks


CHECKS = compile_checks()


def meal_text(meal):
    parts = [str(meal.get("title", ""))]
    parts += [i["item"] for i in meal.get("items", [])]
    parts.append(str(meal.get("instructions", "")))
    parts += [str(b) for b in meal.get("beverages", [])]
    return " ".join(parts).lower()


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = (
    "You are an expert clinical nutritionist specializing in diabetes. "
    "You create one-day meal plans as structured JSON. "
    "You never give medication, insulin or dosing advice. "
    "You follow every constraint exactly and reply with JSON only."
)


def build_prompt(feedback):
    medications_str = ", ".join(med_to_str(m) for m in medications) if medications else "None"
    targets = meal_targets()
    target_lines = "\n".join(
        f"- {k}: about {v['kcal']} kcal, about {v['carbs_g']} g carbohydrates"
        for k, v in targets.items()
    )

    feedback_block = ""
    if feedback:
        feedback_block = (
            "CORRECTIONS REQUIRED (your previous answer was rejected; fix every point below):\n"
            + "\n".join(f"- {f}" for f in feedback)
            + "\n\n"
        )

    return (
        "PATIENT PROFILE\n"
        f"- Age: {age}\n"
        f"- Gender: {gender}\n"
        f"- Medical conditions besides diabetes: {join_or_none(additional_conditions)}\n"
        f"- Medications: {medications_str}\n"
        f"- Liked foods (use where they suit the plan, not in every meal): {join_or_none(liked_meals)}\n\n"
        "PLAN TYPE\n"
        "This is a plan for the ENTIRE DAY, not for one moment. Do not adapt it to any single "
        "glucose reading. Build the whole day on low-to-moderate glycemic index foods: whole "
        "grains, legumes, vegetables, lean protein, healthy fats and fiber, with no added sugars "
        "and carbohydrates spread evenly across the five meals. Respect the patient's other medical "
        "conditions and avoid known food-medication interactions for the listed medications.\n\n"
        "CALORIES\n"
        f"- The day's total calories must be between {CAL_MIN} and {CAL_MAX} kcal and must NEVER "
        f"exceed {CAL_MAX} kcal. Aim for {CAL_TARGET} kcal.\n"
        f"- Per-meal targets:\n{target_lines}\n"
        "- Write each item's calories first, then make total_calories equal their sum.\n\n"
        "STYLE RULES\n"
        "- Create exactly five meals: breakfast, morning_snack, lunch, afternoon_snack, dinner.\n"
        "- Vary protein sources, grains, vegetables, cooking methods and beverages across meals.\n"
        "- Every item name includes its portion size and every item has a calorie count.\n"
        "- Fill carbs_g, protein_g, fiber_g and fat_g with realistic whole-number grams for each meal.\n\n"
        f"{feedback_block}"
        "HARD CONSTRAINTS (check every meal against these before answering)\n"
        f"1. Dietary restrictions: {join_or_none(dietary_restrictions)}. No food, ingredient, sauce or "
        "seasoning that violates these may appear anywhere, including as a minor ingredient.\n"
        f"2. Foods to avoid: {join_or_none(disliked_meals)}. Do not include these foods, or any dish "
        "where they are a main ingredient.\n"
        "Respond with JSON only, matching the schema."
    )


# ---------------------------------------------------------------------------
# Plan normalization and validation
# ---------------------------------------------------------------------------
def normalize_plan(raw):
    if not isinstance(raw, dict):
        return None, ["The output was not a JSON object."]
    plan, errors = {}, []
    for key in MEAL_KEYS:
        meal = raw.get(key)
        if not isinstance(meal, dict):
            errors.append(f"Meal '{key}' is missing.")
            continue
        items = []
        for it in as_list(meal.get("items")):
            if not isinstance(it, dict):
                continue
            name = str(it.get("item", "")).strip()
            cal = to_int(it.get("calories"))
            if name and cal > 0:
                items.append({"item": name, "calories": cal})
        if not items:
            errors.append(f"Meal '{key}' has no valid items with calories.")
        meal["items"] = items
        total = sum(i["calories"] for i in items)
        meal["total_calories"] = total
        meal["estimated_total_calories"] = total
        meal["calorie_percentage"] = round(total / daily_calories * 100, 2)
        meal["beverages"] = [str(b) for b in as_list(meal.get("beverages"))]
        for f in ("carbs_g", "protein_g", "fiber_g", "fat_g"):
            meal[f] = to_int(meal.get(f))
        meal["nutritional_facts"] = (
            f"Protein {meal['protein_g']}g, Carbs {meal['carbs_g']}g, "
            f"Fiber {meal['fiber_g']}g, Fat {meal['fat_g']}g"
        )
        plan[key] = meal
    return plan, errors


def validate(plan):
    hard, soft = [], []
    total = sum(m["total_calories"] for m in plan.values())

    if total > CAL_MAX:
        hard.append(
            f"The day total was {total} kcal, which is {total - CAL_MAX} kcal OVER the limit. "
            f"It must be between {CAL_MIN} and {CAL_MAX} kcal. Reduce portions or swap in lower-calorie foods."
        )
    elif total < CAL_MIN:
        hard.append(
            f"The day total was {total} kcal, which is {CAL_MIN - total} kcal too low. "
            f"It must be between {CAL_MIN} and {CAL_MAX} kcal. Increase portions or add a healthy item."
        )

    for key, meal in plan.items():
        text = meal_text(meal)
        for label, kind, regex, safe in CHECKS:
            scan = safe.sub(" ", text) if safe else text
            hit = regex.search(scan)
            if hit:
                if kind == "restriction":
                    hard.append(
                        f"Meal '{key}' contains '{hit.group(0)}', which violates the restriction "
                        f"'{label}'. Remove it and every dish that uses it."
                    )
                else:
                    hard.append(
                        f"Meal '{key}' contains '{hit.group(0)}', a disliked food ('{label}'). Remove it."
                    )

    if total > 0:
        share = sum(m["carbs_g"] for m in plan.values()) * 4 / total
        if not (CARB_SHARE_MIN <= share <= CARB_SHARE_MAX):
            soft.append(
                f"Carbohydrates were {share:.0%} of calories; they should be about "
                f"{CARB_FRACTION:.0%}, spread evenly across the day."
            )
    return hard, soft, total


# ---------------------------------------------------------------------------
# Ollama call
# ---------------------------------------------------------------------------
def call_ollama(prompt, attempt):
    """Returns (raw_plan, fatal_error, retry_reason)."""
    payload = {
        "model": MODEL,
        "system": SYSTEM_PROMPT,
        "prompt": prompt,
        "format": MEAL_PLAN_SCHEMA,
        "stream": False,
        "keep_alive": "30m",
        "options": {
            "temperature": min(0.4 + 0.1 * (attempt - 1), 0.8),
            "top_p": 0.9,
            "num_ctx": 8192,
            "num_predict": 4096,
        },
    }
    try:
        resp = requests.post(OLLAMA_GENERATE_URL, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
    except requests.RequestException as e:
        return None, f"Ollama request failed ({OLLAMA_GENERATE_URL}, model={MODEL}): {e}", None
    if not resp.ok:
        return None, f"Ollama returned {resp.status_code} for model={MODEL}: {resp.text[:300]}", None

    body = resp.json()
    print(
        f"[DEBUG] attempt={attempt} model={MODEL} eval_count={body.get('eval_count')} "
        f"total_duration_ms={(body.get('total_duration') or 0) // 1_000_000}",
        file=sys.stderr,
    )
    try:
        return json.loads(body["response"]), None, None
    except (KeyError, json.JSONDecodeError) as e:
        return None, None, f"The previous output was not valid complete JSON ({e}). Return the full JSON object."


# ---------------------------------------------------------------------------
# Generation loop
# ---------------------------------------------------------------------------
def generate_meal_plan():
    feedback = []
    best = None  # (soft_count, plan, total, attempt)
    last_hard = []

    for attempt in range(1, MAX_ATTEMPTS + 1):
        raw, fatal, retry_reason = call_ollama(build_prompt(feedback), attempt)

        if fatal:
            if best:
                break
            return {"status": "error", "message": fatal}
        if retry_reason:
            feedback = [retry_reason]
            last_hard = [retry_reason]
            continue

        plan, structure_errors = normalize_plan(raw)
        if structure_errors:
            feedback = structure_errors
            last_hard = structure_errors
            print(f"[DEBUG] attempt={attempt} structure errors: {structure_errors}", file=sys.stderr)
            continue

        hard, soft, total = validate(plan)
        print(
            f"[DEBUG] attempt={attempt} total_kcal={total} hard={len(hard)} soft={len(soft)}",
            file=sys.stderr,
        )
        if not hard:
            if best is None or len(soft) < best[0]:
                best = (len(soft), plan, total, attempt)
            if not soft:
                break
        else:
            last_hard = hard
        feedback = hard + soft

    if best is None:
        return {
            "status": "error",
            "message": f"No valid plan after {MAX_ATTEMPTS} attempts.",
            "violations": last_hard,
        }

    _, day_plan, total_day, used_attempt = best
    return {
        "status": "ok",
        "parsed_plan": {
            "day_plan": day_plan,
            "summary": {
                "total_day_calories": total_day,
                "calorie_goal": daily_calories,
                "calorie_min": CAL_MIN,
                "attempts": used_attempt,
            },
        },
    }


if __name__ == "__main__":
    print(json.dumps(generate_meal_plan()))