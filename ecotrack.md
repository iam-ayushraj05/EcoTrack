# EcoTrack — Carbon Footprint Tracker

EcoTrack is a comprehensive, interactive application designed to help individuals measure, monitor, and reduce their personal carbon footprint. By tracking everyday choices, from dietary habits to transport preferences, EcoTrack empowers users to live a more sustainable lifestyle.

---

## 🌟 Application Features & Modules

### 1. 📋 Onboarding Wizard
* **Initial Setup**: Guide to setup user display names, city, and local state.
* **Searchable States**: Quick search and autocomplete selection across all 28 Indian States and 8 Union Territories using a magnifying glass toggle or interactive search input.
* **Baseline Calculation**: Prompts the user with carbon-impacting questions to calculate their starting **EcoScore** and initial footprint metrics.

### 2. 📊 Main Dashboard
* **EcoScore & Streak Trackers**: A main overview card presenting the user's overall EcoScore and active green streaks.
* **Emission Breakdown**: Interactive visualization of carbon metrics grouped by category (Electricity, Diet, Commute, Waste).
* **Dynamic Ranks**: Calculates the user's community standing and displays real-time ranking dynamically.

### 3. 🚗 Track Activity
* **Electricity Log**: Record monthly energy use in kWh to monitor household footprints.
* **Travel Log**: Log transport details specifying vehicle types (Electric, Hybrid, Petrol/Diesel) and distance traveled.
* **Diet Log**: Input meal types (Vegan, Vegetarian, Meat-heavy) to track food-related emissions.
* **Waste Log**: Track recycled volume and waste generated to maintain a circular index score.

### 4. 🧠 AI Insights
* **Smart Analysis**: Scans usage logs and provides personalized insights based on recent activities.
* **Cost & Carbon Savings**: Tells you exactly how much money and CO₂e you can save by implementing simple adjustments (e.g., thermostat shifts).
* **Progress Graphs**: Displays interactive trend charts showing your carbon output improvements over time.

### 5. ✅ Action Plan
* **Action Checklist**: A list of actionable goals (e.g., switching to LED bulbs, using public transit, composting).
* **EcoScore Integration**: Checking off items in your action plan updates your active score and live rank instantly.

### 6. 🌱 Offsets & Credits
* **Green Investments**: Option to offset unavoidable emissions by funding carbon-reduction projects like reforestation or renewable energy.
* **Certificate Tracking**: Log completed offsets to lower your net carbon emissions.

### 7. 🏆 Community Leaderboard
* **Regional & Global Ranks**: Compare your progress with friends and other community members in your state.
* **Interactive List**: Dynamic leaderboard updating ranks immediately as users change settings or log green activities.

### 8. 🗺️ Emission Map
* **Regional Hotspots**: Heatmap markers displaying average emission statistics for various Indian cities.
* **Failure Fallback**: In the absence of an active internet connection or map key, a fallback table loads automatically.

### 9. ⚙️ Profile Settings
* **Information Management**: Modify display name and profile settings.
* **Autocomplete States**: Full support for updating your home state/UT using the interactive, searchable state picker.
* **Visual & Theme Preferences**: Adjust UI density and configure accessibility settings.

---

## 🛠️ Getting Started & Setup

### Requirements
* Node.js (v14 or higher)
* npm (v6 or higher)

### Setup & Run
1. **Clone & Navigate**:
   ```bash
   cd carbon_footprint
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   cd backend
   npm install
   cd ..
   ```
3. **Start Server**:
   ```bash
   npm start
   ```
4. **Open Browser**:
   Visit `http://localhost:3000` to interact with the application.
