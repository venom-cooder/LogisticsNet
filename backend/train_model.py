import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
import joblib
import random

# --- 1. Massively Expanded and Detailed Company Database ---
# Now contains 50 companies, EACH with complete, pseudo-realistic details.
# This is the single source of truth to prevent "undefined" errors.
COMPANY_DETAILS = {
    # Top Tier & Real Companies
    'Blue Dart': {'domain': 'bluedart.com', 'hub': 'Nagpur', 'bhopal_address': 'Zone II, MP Nagar', 'care_number': '1860-233-1234'},
    'Delhivery': {'domain': 'delhivery.com', 'hub': 'Indore', 'bhopal_address': 'Arera Colony', 'care_number': '1800-103-6354'},
    'DTDC': {'domain': 'dtdc.in', 'hub': 'Indore', 'bhopal_address': 'New Market', 'care_number': '1860-204-2222'},
    'FedEx': {'domain': 'fedex.com', 'hub': 'Mumbai', 'bhopal_address': 'Hoshangabad Road', 'care_number': '1800-209-6161'},
    'Gati': {'domain': 'gati.com', 'hub': 'Nagpur', 'bhopal_address': 'Transport Nagar', 'care_number': '1860-123-4284'},
    'XpressBees': {'domain': 'xpressbees.com', 'hub': 'Indore', 'bhopal_address': 'MP Nagar', 'care_number': '1800-203-1999'},
    'Safexpress': {'domain': 'safexpress.com', 'hub': 'Nagpur', 'bhopal_address': 'Bairagarh', 'care_number': '1800-113-113'},
    'Mahindra Logistics': {'domain': 'mahindralogistics.com', 'hub': 'Pune', 'bhopal_address': 'Mandideep Industrial Area', 'care_number': '1800-258-6787'},
    'TCI Express': {'domain': 'tciexpress.in', 'hub': 'Nagpur', 'bhopal_address': 'Govindpura Industrial Area', 'care_number': '1800-200-0977'},
    'VRL Logistics': {'domain': 'vrllogistics.in', 'hub': 'Ahmedabad', 'bhopal_address': 'Transport Nagar', 'care_number': '1800-599-8751'},
    'DHL': {'domain': 'dhl.com', 'hub': 'Mumbai', 'bhopal_address': 'Zone I, MP Nagar', 'care_number': '1800-209-1111'},
    'Ekart Logistics': {'domain': 'ekartlogistics.com', 'hub': 'Indore', 'bhopal_address': 'Piplani, BHEL', 'care_number': '1800-420-1111'},
    'Shadowfax': {'domain': 'shadowfax.in', 'hub': 'Indore', 'bhopal_address': 'Kolar Road', 'care_number': '1800-123-3232'},
    'Ecom Express': {'domain': 'ecomexpress.in', 'hub': 'Delhi', 'bhopal_address': 'Habib Ganj', 'care_number': '1800-102-6666'},
    'Rivigo': {'domain': 'rivigo.com', 'hub': 'Delhi', 'bhopal_address': 'ISBT Commercial Complex', 'care_number': '1800-121-8966'},
    'BlackBuck': {'domain': 'blackbuck.com', 'hub': 'Nagpur', 'bhopal_address': 'Transport Nagar', 'care_number': '1800-200-2456'},

    # Our Imaginary Startup
    'LogisticStartup': {'domain': 'example.com', 'hub': 'Pune', 'bhopal_address': '123 Innovation Road, Bhopal', 'care_number': '98765-43210'},

    # Additional Fictional/Generic Companies to reach 50
    'QuickMove': {'domain': 'qmove.com', 'hub': 'Nagpur', 'bhopal_address': 'Jahangirabad', 'care_number': '98765-11111'},
    'Bharat Connect': {'domain': 'bconnect.com', 'hub': 'Indore', 'bhopal_address': 'Berasia Road', 'care_number': '98765-22222'},
    'Reliable Wings': {'domain': 'rwings.com', 'hub': 'Mumbai', 'bhopal_address': 'Hamidia Road', 'care_number': '98765-33333'},
    'ValueShip': {'domain': 'valueship.com', 'hub': 'Ahmedabad', 'bhopal_address': 'Airport Road', 'care_number': '98765-44444'},
    'Apex Cargo': {'domain': 'apexcargo.com', 'hub': 'Delhi', 'bhopal_address': 'Vidisha Road', 'care_number': '98765-55555'},
    'GreenLine': {'domain': 'greenline.com', 'hub': 'Nagpur', 'bhopal_address': 'Raisen Road', 'care_number': '98765-66666'},
    'CityLink': {'domain': 'citylink.com', 'hub': 'Indore', 'bhopal_address': 'Ashoka Garden', 'care_number': '98765-77777'},
    'StarTrack': {'domain': 'startrack.com', 'hub': 'Mumbai', 'bhopal_address': 'Idgah Hills', 'care_number': '98765-88888'},
    'Indus Cargo': {'domain': 'induscargo.com', 'hub': 'Ahmedabad', 'bhopal_address': 'Karond', 'care_number': '98765-99999'},
    'Pioneer Express': {'domain': 'pexpress.com', 'hub': 'Delhi', 'bhopal_address': 'Shakti Nagar', 'care_number': '98765-10101'},
    'SwiftCargo': {'domain': 'scargo.com', 'hub': 'Nagpur', 'bhopal_address': 'Anand Nagar', 'care_number': '98765-12121'},
    'Doorstep Delivers': {'domain': 'ddelivers.com', 'hub': 'Indore', 'bhopal_address': 'Misrod', 'care_number': '98765-13131'},
    'National Freight': {'domain': 'nfreight.com', 'hub': 'Mumbai', 'bhopal_address': 'Ratibad', 'care_number': '98765-14141'},
    'Everest Logistics': {'domain': 'everestlog.com', 'hub': 'Ahmedabad', 'bhopal_address': 'Neelbad', 'care_number': '98765-15151'},
    'Samay Movers': {'domain': 'samaym.com', 'hub': 'Delhi', 'bhopal_address': 'Bhopal Talkies', 'care_number': '98765-16161'},
    'Prime Parcel': {'domain': 'primeparcel.com', 'hub': 'Nagpur', 'bhopal_address': 'Lalghati', 'care_number': '98765-17171'},
    'IndiaFast': {'domain': 'indiafast.com', 'hub': 'Indore', 'bhopal_address': 'TT Nagar', 'care_number': '98765-18181'},
    'SecureShip': {'domain': 'sship.com', 'hub': 'Mumbai', 'bhopal_address': 'Jahangirabad', 'care_number': '98765-19191'},
    'Budget Trans': {'domain': 'btrans.com', 'hub': 'Ahmedabad', 'bhopal_address': 'Berasia Road', 'care_number': '98765-20202'},
    'Air & Road': {'domain': 'aroad.com', 'hub': 'Delhi', 'bhopal_address': 'Hamidia Road', 'care_number': '98765-21212'},
    'Central Carriers': {'domain': 'ccarriers.com', 'hub': 'Nagpur', 'bhopal_address': 'Airport Road', 'care_number': '98765-23232'},
    'WestWind': {'domain': 'wwind.com', 'hub': 'Indore', 'bhopal_address': 'Vidisha Road', 'care_number': '98765-24242'},
    'Capital Connect': {'domain': 'cconnect.com', 'hub': 'Mumbai', 'bhopal_address': 'Raisen Road', 'care_number': '98765-25252'},
    'DirectLink': {'domain': 'dlink.com', 'hub': 'Ahmedabad', 'bhopal_address': 'Ashoka Garden', 'care_number': '98765-26262'},
    'RapidEx': {'domain': 'rapidex.com', 'hub': 'Delhi', 'bhopal_address': 'Idgah Hills', 'care_number': '98765-27272'},
    'TransIndia': {'domain': 'transindia.com', 'hub': 'Nagpur', 'bhopal_address': 'Karond', 'care_number': '98765-28282'},
    'Unity Logistics': {'domain': 'ulogistics.com', 'hub': 'Indore', 'bhopal_address': 'Shakti Nagar', 'care_number': '98765-29292'},
    'Vikas Transport': {'domain': 'vtransport.com', 'hub': 'Mumbai', 'bhopal_address': 'Anand Nagar', 'care_number': '98765-30303'},
    'Zenith Movers': {'domain': 'zmovers.com', 'hub': 'Ahmedabad', 'bhopal_address': 'Misrod', 'care_number': '98765-31313'},
}
COMPANIES = list(COMPANY_DETAILS.keys())

# --- Massively Expanded Location-Specific Review Data ---
LOCATION_REVIEWS = {
    # Indore Route (Known for speed and cost-effectiveness)
    ('Bhopal', 'Indore', 'DTDC'): 4.8, ('Bhopal', 'Indore', 'Delhivery'): 4.6, ('Bhopal', 'Indore', 'XpressBees'): 4.5,
    ('Bhopal', 'Indore', 'Blue Dart'): 4.2, # Good, but overkill for this route
    # Delhi Route (Premium services excel here)
    ('Bhopal', 'Delhi', 'Blue Dart'): 4.9, ('Bhopal', 'Delhi', 'FedEx'): 4.8, ('Bhopal', 'Delhi', 'DHL'): 4.7,
    ('Bhopal', 'Delhi', 'DTDC'): 3.9, # Not their strongest route
    # Pune Route (Startup and specialists are best)
    ('Bhopal', 'Pune', 'LogisticStartup'): 5.0, ('Bhopal', 'Pune', 'Mahindra Logistics'): 4.7,
    ('Bhopal', 'Pune', 'QuickMove'): 4.5, ('Bhopal', 'Pune', 'Delhivery'): 4.0, # Average service here
    # Ahmedabad Route (Regional players are strong)
    ('Bhopal', 'Ahmedabad', 'VRL Logistics'): 4.8, ('Bhopal', 'Ahmedabad', 'Gati'): 4.6,
    ('Bhopal', 'Ahmedabad', 'ValueShip'): 4.5,
    # Kolkata Route (Requires robust network)
    ('Bhopal', 'Kolkata', 'TCI Express'): 4.7, ('Bhopal', 'Kolkata', 'Safexpress'): 4.6,
    ('Bhopal', 'Kolkata', 'Blue Dart'): 4.5, ('Bhopal', 'Kolkata', 'Gati'): 4.1,
}

ROUTES = [("Bhopal", "Indore"), ("Bhopal", "Delhi"), ("Bhopal", "Pune"), ("Bhopal", "Ahmedabad"), ("Bhopal", "Kolkata")]
ROUTE_METRICS = {
    ("Bhopal", "Indore"): {"base_price": 200, "base_time": 4}, ("Bhopal", "Delhi"): {"base_price": 800, "base_time": 14},
    ("Bhopal", "Pune"): {"base_price": 900, "base_time": 16}, ("Bhopal", "Ahmedabad"): {"base_price": 600, "base_time": 12},
    ("Bhopal", "Kolkata"): {"base_price": 1500, "base_time": 28},
}
warehouse_data = [
    {'location': 'Indore', 'company': 'Safexpress', 'warehouse_size_sqft': 150000},
    {'location': 'Indore', 'company': 'Bharat Connect', 'warehouse_size_sqft': 60000},
    {'location': 'Delhi', 'company': 'Delhivery', 'warehouse_size_sqft': 200000},
    {'location': 'Delhi', 'company': 'Ecom Express', 'warehouse_size_sqft': 170000},
    {'location': 'Pune', 'company': 'LogisticStartup', 'warehouse_size_sqft': 250000},
    {'location': 'Pune', 'company': 'Mahindra Logistics', 'warehouse_size_sqft': 180000},
    {'location': 'Ahmedabad', 'company': 'Gati', 'warehouse_size_sqft': 90000},
    {'location': 'Ahmedabad', 'company': 'VRL Logistics', 'warehouse_size_sqft': 110000},
    {'location': 'Kolkata', 'company': 'TCI Express', 'warehouse_size_sqft': 100000},
]
warehouse_df = pd.DataFrame(warehouse_data)

# --- 2. Generate and Augment Data ---
logistics_data = []
for origin, destination in ROUTES:
    metrics = ROUTE_METRICS[(origin, destination)]
    # Use a larger, consistent random sample of 30 companies for each route
    for company in random.sample(COMPANIES, 30): 
        price_multiplier = 1 + (hash(company) % 100) / 200.0 - 0.25
        time_multiplier = 1 + (hash(company) % 50) / 100.0 - 0.15
        safety_base = 3.5 + (hash(company) % 15) / 10.0
        price = round(metrics["base_price"] * price_multiplier, -1)
        delivery_time_hours = round(metrics["base_time"] * time_multiplier, 1)
        safety_rating = round(min(5.0, safety_base), 1)
        if company == 'LogisticStartup':
            price *= 0.85; delivery_time_hours *= 0.95; safety_rating = 5.0
        logistics_data.append([origin, destination, company, price, safety_rating, delivery_time_hours])

df = pd.DataFrame(logistics_data, columns=["origin", "destination", "company", "price", "safety_rating", "delivery_time_hours"])
df = pd.merge(df, warehouse_df, on=['company'], how='left').fillna(0)
df['location_review'] = df.apply(lambda row: LOCATION_REVIEWS.get((row['origin'], row['destination'], row['company']), 3.8), axis=1)

# --- 3. Advanced Feature Engineering and Scoring ---
df['price_score'] = 1 - (df['price'] - df['price'].min()) / (df['price'].max() - df['price'].min())
df['safety_score'] = (df['safety_rating'] - df['safety_rating'].min()) / (df['safety_rating'].max() - df['safety_rating'].min())
df['speed_score'] = 1 - (df['delivery_time_hours'] - df['delivery_time_hours'].min()) / (df['delivery_time_hours'].max() - df['delivery_time_hours'].min())
df['warehouse_score'] = (df['warehouse_size_sqft'] - df['warehouse_size_sqft'].min()) / (df['warehouse_size_sqft'].max() - df['warehouse_size_sqft'].min()) if not df['warehouse_size_sqft'].max() == df['warehouse_size_sqft'].min() else 0
df['review_score'] = (df['location_review'] - df['location_review'].min()) / (df['location_review'].max() - df['location_review'].min())

# --- 4. Define Recommendation Logic and Create Training Data ---
training_data = []
for (origin, destination), group in df.groupby(['origin', 'destination']):
    weights = {
        'cost': {'price': 0.7, 'speed': 0.1, 'safety': 0.1, 'review': 0.1},
        'speed': {'price': 0.1, 'speed': 0.7, 'safety': 0.1, 'review': 0.1},
        'safety': {'price': 0.1, 'speed': 0.1, 'safety': 0.5, 'review': 0.3},
        'warehouse': {'warehouse': 0.8, 'review': 0.2}
    }
    for priority in ['cost', 'speed', 'safety', 'warehouse']:
        for fragility in ['Low', 'Medium', 'High']:
            current_weights = weights[priority].copy()
            if fragility == 'High':
                current_weights['safety'] = min(1.0, current_weights.get('safety', 0) + 0.4) # Increased weight for high fragility
                current_weights['review'] = min(1.0, current_weights.get('review', 0) + 0.2)
            group['combined_score'] = (
                group['price_score'] * current_weights.get('price', 0) +
                group['speed_score'] * current_weights.get('speed', 0) +
                group['safety_score'] * current_weights.get('safety', 0) +
                group['warehouse_score'] * current_weights.get('warehouse', 0) +
                group['review_score'] * current_weights.get('review', 0)
            )
            top_choice_company = group.loc[group['combined_score'].idxmax()]['company']
            training_data.append([origin, destination, priority, fragility, top_choice_company])

train_df = pd.DataFrame(training_data, columns=['origin', 'destination', 'priority', 'fragility', 'top_choice_company'])

# --- 5. Preprocessing ---
le_origin = LabelEncoder().fit(train_df['origin'])
le_destination = LabelEncoder().fit(train_df['destination'])
le_priority = LabelEncoder().fit(train_df['priority'])
le_fragility = LabelEncoder().fit(train_df['fragility'])
le_company = LabelEncoder().fit(train_df['top_choice_company'])
train_df['origin_encoded'] = le_origin.transform(train_df['origin'])
train_df['destination_encoded'] = le_destination.transform(train_df['destination'])
train_df['priority_encoded'] = le_priority.transform(train_df['priority'])
train_df['fragility_encoded'] = le_fragility.transform(train_df['fragility'])
train_df['company_encoded'] = le_company.transform(train_df['top_choice_company'])

# --- 6. Train the Model ---
features = ['origin_encoded', 'destination_encoded', 'priority_encoded', 'fragility_encoded']
target = 'company_encoded'
X_train = train_df[features]
y_train = train_df[target]
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# --- 7. Save the Model and Encoders ---
joblib.dump(model, 'logistics_model.pkl')
joblib.dump(le_origin, 'le_origin.pkl')
joblib.dump(le_destination, 'le_destination.pkl')
joblib.dump(le_priority, 'le_priority.pkl')
joblib.dump(le_fragility, 'le_fragility.pkl')
joblib.dump(le_company, 'le_company.pkl')
print("Definitive model with 50 companies and advanced logic trained and saved successfully!")

# --- 8. Example Prediction ---
print("\n--- Example Predictions ---")
def predict_best_company(origin, destination, priority, fragility):
    test_input_data = [[origin, destination, priority, fragility]]
    test_df = pd.DataFrame(test_input_data, columns=['origin', 'destination', 'priority', 'fragility'])
    test_df['origin_encoded'] = le_origin.transform(test_df['origin'])
    test_df['destination_encoded'] = le_destination.transform(test_df['destination'])
    test_df['priority_encoded'] = le_priority.transform(test_df['priority'])
    test_df['fragility_encoded'] = le_fragility.transform(test_df['fragility'])
    prediction_encoded = model.predict(test_df[features])
    prediction = le_company.inverse_transform(prediction_encoded)
    print(f"Query: Origin='{origin}', Destination='{destination}', Priority='{priority}', Fragility='{fragility}'")
    print(f"==> Model Recommends: {prediction[0]}")

predict_best_company('Bhopal', 'Pune', 'safety', 'High')
predict_best_company('Bhopal', 'Indore', 'cost', 'Low')
predict_best_company('Bhopal', 'Delhi', 'safety', 'High') # Should favor Blue Dart or FedEx due to reviews
