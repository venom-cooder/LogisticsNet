import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
import joblib
import random
import itertools
import os # NEW: Imported the 'os' module for handling file paths

print("--- Starting LogAi Intra-City Model Training ---")
print("[Checkpoint 1]: Libraries imported successfully.")

# --- 1. Expanded City & Route Data ---
# The virtual city now has more locations and defined route conditions.

CITY_LOCATIONS = {
    "MP Nagar": (0, 0), "Arera Colony": (2, 3), "New Market": (-2, 1),
    "Kolar Road": (4, 8), "ISBT": (5, 1), "Mandideep": (10, -5),
    "Habib Ganj": (3, 0), "Piplani": (7, 2), "Bairagarh": (-8, 4),
    "Shahpura": (1, 6), "Ayodhya Bypass": (8, 4), "Lalghati": (-5, 3)
}

# NEW: Define locations with special facilities
COLD_STORAGE_LOCATIONS = ["Mandideep", "Piplani"]

# Define route conditions: (distance, road_quality, traffic_profile)
# road_quality: 1.0 = smooth, 0.5 = bumpy
# traffic_profile: 1.0 = clear, 2.0 = heavy traffic at peak times
ROUTE_CONDITIONS = {
    ("MP Nagar", "Arera Colony"): (5, 1.0, 1.8),
    ("MP Nagar", "New Market"): (3, 0.8, 2.0),
    ("Arera Colony", "Kolar Road"): (6, 0.9, 1.2),
    ("New Market", "Bairagarh"): (10, 0.6, 1.5),
    ("ISBT", "Mandideep"): (15, 0.7, 1.8),
    ("Habib Ganj", "Piplani"): (5, 1.0, 1.6),
    ("Shahpura", "Kolar Road"): (3, 1.0, 1.4),
    ("Ayodhya Bypass", "Piplani"): (4, 0.9, 1.9),
}

def get_route_stats(loc1, loc2):
    """Calculates distance and gets route conditions, with defaults."""
    key = tuple(sorted((loc1, loc2)))
    if key in ROUTE_CONDITIONS:
        return ROUTE_CONDITIONS[key]
    
    # Default calculation for routes not explicitly defined
    dist = ((CITY_LOCATIONS[loc1][0] - CITY_LOCATIONS[loc2][0])**2 + 
            (CITY_LOCATIONS[loc1][1] - CITY_LOCATIONS[loc2][1])**2)**0.5
    return (dist, 0.8, 1.5) # Default road quality and traffic

# --- 2. Generate More & Smarter Training Data ---
# We now generate 20,000 scenarios and include "cold storage" logic.

training_data = []
LOCATIONS = list(CITY_LOCATIONS.keys())

for _ in range(20000): # Generate 20,000 scenarios
    num_stops = random.randint(3, 5)
    stops = tuple(sorted(random.sample(LOCATIONS, num_stops)))
    
    product_type = random.choice(["Documents", "Food", "Electronics"])
    is_fragile = random.choice([True, False])
    needs_cold_storage = True if product_type == "Food" and random.random() > 0.5 else False
    
    best_route = None
    min_cost = float('inf')

    for p in itertools.permutations(stops):
        current_cost = 0
        
        route_has_cold_storage = any(stop in COLD_STORAGE_LOCATIONS for stop in p)
        if needs_cold_storage and not route_has_cold_storage:
            current_cost = float('inf')
        else:
            for i in range(len(p) - 1):
                dist, quality, traffic = get_route_stats(p[i], p[i+1])
                cost = dist * traffic
                if is_fragile and quality < 0.9:
                    cost *= 1.5
                current_cost += cost

        if current_cost < min_cost:
            min_cost = current_cost
            best_route = p

    if best_route:
        training_data.append(list(stops) + [is_fragile, needs_cold_storage, product_type, best_route[0]])

print(f"[Checkpoint 2]: Generated {len(training_data)} training scenarios.")

# --- 3. Preprocess the Data ---
num_stops_for_df = 5
train_df = pd.DataFrame(training_data)
train_df.columns = [f'stop_{i+1}' for i in range(len(train_df.columns)-4)] + ['is_fragile', 'needs_cold_storage', 'product_type', 'best_first_stop']
for i in range(num_stops_for_df - (len(train_df.columns)-4)):
    train_df[f'stop_{len(train_df.columns)-4+i}'] = 'None'

stop_cols = [f'stop_{i+1}' for i in range(5)]
train_df = train_df[stop_cols + ['is_fragile', 'needs_cold_storage', 'product_type', 'best_first_stop']]

encoders = {}
for col in train_df.columns:
    if train_df[col].dtype == 'object' or train_df[col].dtype == 'bool':
        le = LabelEncoder()
        train_df[col] = le.fit_transform(train_df[col].astype(str))
        encoders[col] = le

print("[Checkpoint 3]: Data preprocessing complete.")

# --- 4. Train the AI Model ---
features = [col for col in train_df.columns if col != 'best_first_stop']
target = 'best_first_stop'

X_train = train_df[features]
y_train = train_df[target]

model = RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced')
model.fit(X_train, y_train)

print("[Checkpoint 4]: AI model training complete.")

# --- 5. Save the Model and Encoders ---
# NEW: Using absolute paths to ensure files save in the same directory as the script.
script_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(script_dir, 'intracity_model.pkl')
encoders_path = os.path.join(script_dir, 'intracity_encoders.pkl')

joblib.dump(model, model_path)
joblib.dump(encoders, encoders_path)

print("[Checkpoint 5]: Model and encoders saved successfully!")
print(f"\nFiles were saved to: {script_dir}")
print("--- Training Complete ---")
