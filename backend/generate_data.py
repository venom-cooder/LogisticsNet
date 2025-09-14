import pandas as pd
import numpy as np
import random

# --- Configuration ---
COMPANIES = [f"Company_{chr(65 + i)}" for i in range(15)] + ["Swift Express", "SafeStore", "Gati", "DTDC", "Delhivery"]
LOCATIONS = ["Bhopal", "Indore", "Delhi", "Pune", "Ahmedabad", "Kolkata"]
ROUTES = [
    ("Bhopal", "Indore"),
    ("Bhopal", "Delhi"),
    ("Bhopal", "Pune"),
    ("Bhopal", "Ahmedabad"),
    ("Bhopal", "Kolkata")
]

# Base metrics for routes (distance affects price and time)
ROUTE_METRICS = {
    ("Bhopal", "Indore"): {"base_price": 200, "base_time": 4},
    ("Bhopal", "Delhi"): {"base_price": 800, "base_time": 14},
    ("Bhopal", "Pune"): {"base_price": 900, "base_time": 16},
    ("Bhopal", "Ahmedabad"): {"base_price": 600, "base_time": 12},
    ("Bhopal", "Kolkata"): {"base_price": 1500, "base_time": 28},
}

data = []

# --- Generate Realistic Data ---
for origin, destination in ROUTES:
    metrics = ROUTE_METRICS[(origin, destination)]
    for company in COMPANIES:
        # Each company has its own characteristics
        price_multiplier = random.uniform(0.8, 1.5) # Some are cheaper, some pricier
        time_multiplier = random.uniform(0.7, 1.3)  # Some are faster, some slower
        
        price = round(metrics["base_price"] * price_multiplier, -1) # Round to nearest 10
        delivery_time_hours = round(metrics["base_time"] * time_multiplier, 1)
        safety_rating = round(random.uniform(3.0, 5.0), 1) # Rating out of 5

        data.append([origin, destination, company, price, safety_rating, delivery_time_hours])

# Create a Pandas DataFrame
df = pd.DataFrame(data, columns=["origin", "destination", "company", "price", "safety_rating", "delivery_time_hours"])

# Save the data to a CSV file
df.to_csv("logistics_data.csv", index=False)

print("Successfully generated logistics_data.csv with", len(df), "entries.")