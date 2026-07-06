# import requests
# import re

# # TODO: Add feature for it to auto generate 3 meal plans for the day when the clock turns 12:00 AM
# # TODO: Save the recommended meal plans to the database
# # TODO: Use recommended and chosen meal plans to get more customized results
# # TODO: User can request a new set of meals if they don't like the current ones
# # TODO: the prompt should include the cgm data of the user for recommendations to fit condition

# API_URL = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta"
# headers = {
#     "Authorization": "Bearer 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"
# }

# prompt = (
#     "<|system|>\n"
#     "You are a helpful medical assistant.\n"
#     "<|user|>\n"
#     "Create a detailed one-day vegetarian meal plan for a patient with Type 2 diabetes and hypertension. "
#     "The meal plan should be low in carbohydrates and high in fiber. Ensure each meal is balanced and contains:\n"
#     "- Breakfast: Include specific foods with portion sizes.\n"
#     "- Morning Snack\n"
#     "- Lunch\n"
#     "- Afternoon Snack\n"
#     "- Dinner\n"
#     "Avoid processed foods and added sugars. Include beverage suggestions. "
#     "Provide approximate calories and cooking instructions where possible.\n"
#     "<|assistant|>\n"
# )

# def query(payload):
#     response = requests.post(API_URL, headers=headers, json=payload)
#     return response.json()

# response = query({
#     "inputs": prompt,
#     "parameters": {
#         "max_new_tokens": 1000,
#         "temperature": 0.7,
#         "top_p": 0.9
#     }
# })

# # Print generated text if present
# if isinstance(response, list) and "generated_text" in response[0]:
#     print("\nGenerated Output:\n")
#     print(response[0]["generated_text"][len(prompt):])  # Strip the original prompt
# else:
#     print("No generated text found.")



# # Function to parse the meal plan from the generated text
# def parse_meal_plan(output_text):
#     sections = ["Breakfast", "Morning Snack", "Lunch", "Afternoon Snack", "Dinner"]
#     result = {}

#     for i, section in enumerate(sections):
#         if i < len(sections) - 1:
#             next_section = sections[i + 1]
#             pattern = rf"{section}:\n(.*?)(?=\n\nInstructions:|\n\n{next_section}:|Beverage suggestions:|\nApproximate calories:|Note:)"
#             instructions_pattern = rf"{section}:\n.*?\n\nInstructions:\n(.*?)(?=\n\n{next_section}:|Beverage suggestions:|\nApproximate calories:|Note:)"
#         else:
#             # Last section: Dinner
#             pattern = rf"{section}:\n(.*?)(?=\n\nInstructions:|\n\nBeverage suggestions:|\nApproximate calories:|Note:)"
#             instructions_pattern = rf"{section}:\n.*?\n\nInstructions:\n(.*?)(?=\n\nBeverage suggestions:|\nApproximate calories:|Note:)"

#         match = re.search(pattern, output_text, re.DOTALL)
#         foods = match.group(1).strip() if match else ""

#         instructions_match = re.search(instructions_pattern, output_text, re.DOTALL)
#         instructions = instructions_match.group(1).strip().split('\n') if instructions_match else []

#         # Extract calories from the summary section
#         calorie_pattern = rf"{section}: (\d+) calories"
#         calorie_match = re.search(calorie_pattern, output_text)
#         calories = int(calorie_match.group(1)) if calorie_match else None

#         result[section] = {
#             "foods": foods.split('\n'),
#             "instructions": instructions,
#             "calories": calories
#         }

#     # Extract beverage suggestions
#     beverage_match = re.search(r"Beverage suggestions:\n(.*?)\n\nApproximate calories:", output_text, re.DOTALL)
#     beverages = beverage_match.group(1).strip().split('\n') if beverage_match else []

#     # Extract total daily calories
#     total_calories_match = re.search(r"Total: (\d+) calories", output_text)
#     total_calories = int(total_calories_match.group(1)) if total_calories_match else None

#     return {
#         "meals": result,
#         "beverages": beverages,
#         "total_calories": total_calories
#     }

# print(parse_meal_plan(response[0]["generated_text"][len(prompt):]))

import requests
import re
import datetime
import sys
import json
import random

API_URL = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta"
headers = {
    "Authorization": "Bearer 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"
}

# Read JSON input from stdin
try:
    input_data = json.load(sys.stdin)
except Exception as e:
    print(json.dumps({"status": "error", "message": f"Invalid input: {str(e)}"}))
    sys.exit(1)

# Extract data
# average blood glucose level over the past 24 hours
cgm_data = input_data.get("cgm_data")
trend = input_data.get("trend", "stable")  # e.g., "stable", "rising", "falling"
age = input_data.get("age", 30)  
gender = input_data.get("gender")
medications = input_data.get("medications", [])
liked_meals = input_data.get("liked_meals", [])
disliked_meals = input_data.get("disliked_meals", [])
dietary_restrictions = input_data.get("dietary_restrictions", [])
daily_calories = input_data.get("daily_calories", 2000)
additional_conditions = input_data.get("additional_conditions", [])


# TODO: add meal name to be added to likes and dislikes
# TODO: add cooking time for each meal
# TODO: parse it in the parsing function
# TODO; Add tags and one shot prompting
# Build the LLM prompt
def build_prompt(cgm_data, age, medications, liked_meals, disliked_meals, dietary_restrictions, daily_calories, additional_conditions):
    # Convert medications to string if they are dicts
    def med_to_str(m):
        if isinstance(m, dict):
            return m.get('name') or str(m)
        return str(m)
    medications_str = ', '.join([med_to_str(m) for m in medications]) if medications else 'None'

    prompt = (
    "<|system|>\n"
    "You are a helpful, medically accurate assistant specializing in diabetic nutrition. You generate structured, clinically aligned meal plans for individuals managing diabetes. Ensure your responses are nutritionally sound and diverse across meals.\n"
    
    "<|user|>\n"
    f"Create a structured, personalized one-day diabetic meal plan for the following user profile:\n\n"
    f"- Age: {age}\n"
    f"- Gender: {gender}\n"
    f"- Dietary Restrictions: {', '.join(dietary_restrictions) if dietary_restrictions else 'None'}\n"
    f"- Additional Medical Conditions: {', '.join(additional_conditions) if additional_conditions else 'None'}\n"
    f"- Medications (including insulin type and dosage if applicable): {medications_str}\n"
    f"- Average CGM Reading (past 24h): {cgm_data} mg/dL\n"
    f"- Glucose Trend: {trend}\n"
    f"- Caloric Goal: {daily_calories} kcal/day\n"
    f"- Liked Foods: {', '.join(liked_meals) if liked_meals else 'None'}\n"
    f"- Disliked/Avoid Foods: {', '.join(disliked_meals) if disliked_meals else 'None'}\n\n"

    "Please create varied meals across the day. **Avoid repeating ingredients, preparation styles, or beverages** between meals. Prioritize diversity in protein sources, grains, vegetables, and cooking methods (e.g., baking, steaming, raw, sautéing). You may include culturally diverse dishes suitable for diabetic diets.\n\n"

    "Use the following strict format for every meal section. Each meal must include:\n"
    "1. Meal Title\n"
    "2. Estimated Cooking Time (e.g., '25 minutes')\n"
    "3. Items (each with portion size and calorie count)\n"
    "4. Simple, step-by-step Instructions\n"
    "5. Total Estimated Calories\n"
    "6. Calorie Percentage (out of daily goal)\n"
    "7. Suggested Beverages (unique per meal)\n"
    "8. Glucose Impact (e.g., 'Low impact', 'Moderate glycemic load')\n"
    "9. Nutritional Facts (brief: Protein, Carbs, Fiber, Fat)\n\n"

    "**REPEAT these tags for every meal: Breakfast, Morning Snack, Lunch, Afternoon Snack, Dinner**\n"
    "Each section must start with the meal name and follow the format strictly. No freeform descriptions. Focus on consistency and parseability.\n\n"

    "<|example|>\n"
    "Afternoon Snack:\n"
    "Title: Nutty Greek Yogurt Parfait\n"
    "Estimated Cooking Time: 5 minutes\n"
    "Items:\n"
    "- Plain Greek yogurt (150g) (100 calories)\n"
    "- Chopped walnuts (15g) (90 calories)\n"
    "Instructions:\n"
    "1. Spoon Greek yogurt into a bowl.\n"
    "2. Sprinkle chopped walnuts on top.\n"
    "3. Chill for 2 minutes and serve.\n"
    "Total Estimated Calories: 190\n"
    "Calorie Percentage: 9.5%\n"
    "Beverages: Herbal tea, water\n"
    "Glucose Impact: Low impact, suitable for CGM trend downward\n"
    "Nutritional Facts: Protein: 12g, Carbs: 6g, Fiber: 1g, Fat: 11g\n"
    "<|end_example|>\n\n"

    "<|assistant|>\n"
)

    return prompt

def query_hf(prompt):
    response = requests.post(API_URL, headers=headers, json={
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 2500,  # Increased from 1000 to 2000 for longer responses
            "temperature": 0.7,
            "top_p": 0.9
        }
    })
    return response.json()

# Main meal generation
def generate_meal_plan():
    prompt = build_prompt(cgm_data, age, medications, liked_meals, disliked_meals, dietary_restrictions, daily_calories, additional_conditions)
    response = query_hf(prompt)
    print("[DEBUG] Raw HuggingFace response:", response, file=sys.stderr)
    if isinstance(response, list) and "generated_text" in response[0]:
        output = response[0]["generated_text"][len(prompt):]
        return {
            "status": "ok",
            "meal_plan": output,
            "response": response
        }
    else:
        return {
            "status": "error",
            "message": "Failed to generate meal plan",
            "raw_response": response
        }
    


def parse_meal_plan(text, daily_calories=2000):
    import re

    sections = ["Breakfast", "Morning Snack", "Lunch", "Afternoon Snack", "Dinner"]
    meal_plan = {}

    for i, section in enumerate(sections):
        next_section = sections[i + 1] if i + 1 < len(sections) else None
        pattern = rf"{section}:\n(.*?)(?=\n{next_section}:|\Z)"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)

        block_data = {
            "title": "",
            "estimated_cooking_time": "",
            "items": [],
            "instructions": "",
            "total_calories": 0,
            "estimated_total_calories": 0,
            "calorie_percentage": 0.0,
            "beverages": [],
            "glucose_impact": "",
            "nutritional_facts": ""
        }

        if not match:
            meal_plan[section.lower().replace(" ", "_")] = block_data
            continue

        block = match.group(1).strip()
        lines = block.split("\n")
        full_block = "\n".join(lines)

        # === Title ===
        title_match = re.search(r"Title:\s*(.*)", full_block, re.IGNORECASE)
        if title_match:
            block_data["title"] = title_match.group(1).strip()

        # === Estimated Cooking Time ===
        time_match = re.search(r"Estimated Cooking Time:\s*(.*)", full_block, re.IGNORECASE)
        if time_match:
            block_data["estimated_cooking_time"] = time_match.group(1).strip()

        # === Items ===
        total_calories = 0
        items = []
        for line in lines:
            food_match = re.match(r"-\s*(.+?)\s*\((\d+)\s*calories\)", line, re.IGNORECASE)
            if food_match:
                item = food_match.group(1).strip()
                calories = int(food_match.group(2))
                items.append({"item": item, "calories": calories})
                total_calories += calories
        block_data["items"] = items

        if total_calories == 0:
            cal_match = re.search(r"Total Estimated Calories:\s*(\d+)", full_block, re.IGNORECASE)
            if cal_match:
                total_calories = int(cal_match.group(1))
        block_data["total_calories"] = total_calories
        block_data["estimated_total_calories"] = total_calories
        block_data["calorie_percentage"] = round((total_calories / daily_calories) * 100, 2) if daily_calories else 0.0

        # === Instructions ===
        instr_match = re.search(
            r"(Instructions?:|Simple cooking instructions:)\s*(.*?)(?=\n[A-Z][a-z]+:|Total Estimated Calories:|Glucose impact:|Beverages:|$)",
            full_block, re.DOTALL | re.IGNORECASE)
        if instr_match:
            block_data["instructions"] = instr_match.group(2).strip()

        # === Beverages ===
        bev_match = re.search(r"Beverages?:\s*(.*)", full_block, re.IGNORECASE)
        if bev_match:
            beverage_line = bev_match.group(1)
            block_data["beverages"] = [b.strip() for b in re.split(r",| or | and ", beverage_line) if b.strip()]

        # === Glucose Impact ===
        glucose_match = re.search(r"Glucose Impact:\s*(.*?)(?=\n|Calories:|Beverage|$)", full_block, re.IGNORECASE | re.DOTALL)
        if glucose_match:
            block_data["glucose_impact"] = glucose_match.group(1).strip()

        # === Nutritional Facts ===
        nutrition_match = re.search(r"Nutritional Facts:\s*(.*)", full_block, re.IGNORECASE)
        if nutrition_match:
            block_data["nutritional_facts"] = nutrition_match.group(1).strip()

        meal_plan[section.lower().replace(" ", "_")] = block_data

    return {
        "day_plan": meal_plan,
        "summary": {
            "total_day_calories": sum(m["total_calories"] for m in meal_plan.values()),
            "calorie_goal": daily_calories
        }
    }




# Return JSON for Node.js to consume
if __name__ == "__main__":
    result = generate_meal_plan()
    
    if result["status"] == "ok":
        raw_text = result["meal_plan"]  # this is the actual string
        parsed_data = parse_meal_plan(raw_text)

        # Write to JSON
        with open("meal_plan.json", "w") as f:
            json.dump(parsed_data, f, indent=2)

        # Final output to Node.js
        output = {
            "status": "ok",
            "parsed_plan": parsed_data,
            "raw_text": raw_text
        }

        # You can also print for debugging if needed
        print(json.dumps(output))
    else:
        print(json.dumps(result))
   


# Function to parse the meal plan from the generated text
# def parse_meal_plan(output_text):
#     sections = ["Breakfast", "Morning Snack", "Lunch", "Afternoon Snack", "Dinner"]
#     result = {}

#     for i, section in enumerate(sections):
#         if i < len(sections) - 1:
#             next_section = sections[i + 1]
#             pattern = rf"{section}:\n(.*?)(?=\n\nInstructions:|\n\n{next_section}:|Beverage suggestions:|\nApproximate calories:|Note:)"
#             instructions_pattern = rf"{section}:\n.*?\n\nInstructions:\n(.*?)(?=\n\n{next_section}:|Beverage suggestions:|\nApproximate calories:|Note:)"
#         else:
#             # Last section: Dinner
#             pattern = rf"{section}:\n(.*?)(?=\n\nInstructions:|\n\nBeverage suggestions:|\nApproximate calories:|Note:)"
#             instructions_pattern = rf"{section}:\n.*?\n\nInstructions:\n(.*?)(?=\n\nBeverage suggestions:|\nApproximate calories:|Note:)"

#         match = re.search(pattern, output_text, re.DOTALL)
#         foods = match.group(1).strip() if match else ""

#         instructions_match = re.search(instructions_pattern, output_text, re.DOTALL)
#         instructions = instructions_match.group(1).strip().split('\n') if instructions_match else []

#         # Extract calories from the summary section
#         calorie_pattern = rf"{section}: (\d+) calories"
#         calorie_match = re.search(calorie_pattern, output_text)
#         calories = int(calorie_match.group(1)) if calorie_match else None

#         result[section] = {
#             "foods": foods.split('\n'),
#             "instructions": instructions,
#             "calories": calories
#         }

#     # Extract beverage suggestions
#     beverage_match = re.search(r"Beverage suggestions:\n(.*?)\n\nApproximate calories:", output_text, re.DOTALL)
#     beverages = beverage_match.group(1).strip().split('\n') if beverage_match else []

#     # Extract total daily calories
#     total_calories_match = re.search(r"Total: (\d+) calories", output_text)
#     total_calories = int(total_calories_match.group(1)) if total_calories_match else None

#     return {
#         "meals": result,
#         "beverages": beverages,
#         "total_calories": total_calories
#     }