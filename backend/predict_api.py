import pandas as pd
import joblib
import sys
import json

# --- 1. Load the Pre-Trained Model and Encoders ---
# These files must be in the same directory as this script.
try:
    model = joblib.load('logistics_model.pkl')
    le_origin = joblib.load('le_origin.pkl')
    le_destination = joblib.load('le_destination.pkl')
    le_priority = joblib.load('le_priority.pkl')
    le_fragility = joblib.load('le_fragility.pkl')
    le_company = joblib.load('le_company.pkl')
except FileNotFoundError:
    print(json.dumps({"error": "Model or encoder files not found. Please run train_model.py first."}))
    sys.exit(1)


# --- 2. Re-create the Company Database ---
# This script needs access to the same detailed data the model was trained on to perform scoring and retrieve details.
COMPANY_DETAILS = {
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
    'LogisticStartup': {'domain': 'example.com', 'hub': 'Pune', 'bhopal_address': '123 Innovation Road, Bhopal', 'care_number': '98765-43210'},
    # ... all 50 companies would be listed here in a real scenario
}
COMPANIES = list(COMPANY_DETAILS.keys())
warehouse_data = [
    {'location': 'Indore', 'company': 'Safexpress', 'warehouse_size_sqft': 150000}, {'location': 'Delhi', 'company': 'Delhivery', 'warehouse_size_sqft': 200000},
    {'location': 'Pune', 'company': 'LogisticStartup', 'warehouse_size_sqft': 250000}, {'location': 'Ahmedabad', 'company': 'Gati', 'warehouse_size_sqft': 90000},
    {'location': 'Kolkata', 'company': 'TCI Express', 'warehouse_size_sqft': 100000},
]
warehouse_df = pd.DataFrame(warehouse_data)

# Re-create the base DataFrame with stats
logistics_data = [
    # Data generation logic from train_model.py would be here to create the full dataframe.
    # For this script, we'll just load the final result for speed if available, or a sample.
    {'origin': 'Bhopal', 'destination': 'Indore', 'company': 'DTDC', 'price': 320, 'safety_rating': 4.2, 'delivery_time_hours': 12},
    {'origin': 'Bhopal', 'destination': 'Pune', 'company': 'LogisticStartup', 'price': 780, 'safety_rating': 5.0, 'delivery_time_hours': 58},
    # ... This would be populated with the full 50-company dataset
]
df = pd.read_csv("logistics_data.csv") # Assume the full data is available from the training step
df = pd.merge(df, warehouse_df, on=['company'], how='left').fillna(0)
df['location_review'] = df.apply(lambda row: 3.8, axis=1) # simplified for api

# Calculate scores
df['price_score'] = 1 - (df['price'] - df['price'].min()) / (df['price'].max() - df['price'].min())
df['safety_score'] = (df['safety_rating'] - df['safety_rating'].min()) / (df['safety_rating'].max() - df['safety_rating'].min())
df['speed_score'] = 1 - (df['delivery_time_hours'] - df['delivery_time_hours'].min()) / (df['delivery_time_hours'].max() - df['delivery_time_hours'].min())
df['warehouse_score'] = (df['warehouse_size_sqft'] - df['warehouse_size_sqft'].min()) / (df['warehouse_size_sqft'].max() - df['warehouse_size_sqft'].min()) if not df['warehouse_size_sqft'].max() == df['warehouse_size_sqft'].min() else 0
df['review_score'] = (df['location_review'] - df['location_review'].min()) / (df['location_review'].max() - df['location_review'].min()) if not df['location_review'].max() == df['location_review'].min() else 0


# --- 3. Main Prediction and Ranking Function ---
def get_recommendations(origin, destination, priorities, fragility):
    """
    Calculates scores for all companies and returns a ranked Top 3 list.
    """
    
    # Filter the dataframe for the selected route
    route_df = df[(df['origin'] == origin) & (df['destination'] == destination)].copy()
    if route_df.empty:
        return {"error": f"No data available for the route {origin} to {destination}."}

    # Define weights based on single or multiple priorities
    base_weights = {
        'cost': {'price': 0.7, 'speed': 0.1, 'safety': 0.1, 'review': 0.1},
        'speed': {'price': 0.1, 'speed': 0.7, 'safety': 0.1, 'review': 0.1},
        'safety': {'price': 0.1, 'speed': 0.1, 'safety': 0.5, 'review': 0.3},
        'warehouse': {'warehouse': 0.8, 'review': 0.2}
    }
    
    final_weights = {'price':0,'speed':0,'safety':0,'review':0,'warehouse':0}
    for p in priorities:
        for key, value in base_weights[p].items():
            final_weights[key] += value

    # Adjust for fragility
    if fragility == 'High':
        final_weights['safety'] = min(1.0, final_weights.get('safety', 0) + 0.3)

    # Calculate combined score for each company on the route
    route_df['combined_score'] = (
        route_df['price_score'] * final_weights.get('price', 0) +
        route_df['speed_score'] * final_weights.get('speed', 0) +
        route_df['safety_score'] * final_weights.get('safety', 0) +
        route_df['warehouse_score'] * final_weights.get('warehouse', 0) +
        route_df['review_score'] * final_weights.get('review', 0)
    )

    # Sort by the score to get the ranking
    ranked_companies = route_df.sort_values(by='combined_score', ascending=False)
    
    # Select Top 3
    top_choice = ranked_companies.iloc[0]['company']
    balanced_option = ranked_companies.iloc[1]['company']
    value_pick = ranked_companies[ranked_companies['price_score'] == ranked_companies['price_score'].max()].iloc[0]['company']

    results = {
        'top_choice': {**COMPANY_DETAILS.get(top_choice, {}), 'name': top_choice},
        'balanced_option': {**COMPANY_DETAILS.get(balanced_option, {}), 'name': balanced_option},
        'value_pick': {**COMPANY_DETAILS.get(value_pick, {}), 'name': value_pick},
    }
    return results

# --- 4. Script Execution ---
if __name__ == "__main__":
    # This script will be called from Node.js with command line arguments
    # Example: python3 predict_api.py Bhopal Pune safety,cost High
    if len(sys.argv) != 5:
        print(json.dumps({"error": "Invalid number of arguments. Expected: origin destination priorities fragility"}))
        sys.exit(1)

    origin = sys.argv[1]
    destination = sys.argv[2]
    priorities = sys.argv[3].split(',') # Priorities are comma-separated
    fragility = sys.argv[4]

    recommendations = get_recommendations(origin, destination, priorities, fragility)
    
    # Print the final JSON result to standard output, so Node.js can capture it
    print(json.dumps(recommendations, indent=4))
