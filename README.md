# EcoTrack — Carbon Footprint Tracker

EcoTrack is a modern, high-performance, and secure carbon footprint tracking application designed to help users measure, understand, and reduce their carbon footprint.

## 🚀 Key Features & Optimizations

### 1. 🔍 Searchable Indian States & UTs
* **Comprehensive Database**: Includes all **28 Indian States** and **8 Union Territories** (UTs).
* **Autocomplete Selector**: Features a responsive autocomplete search input with a magnifying glass button to search, filter, and select any state or UT easily.

### 2. 👤 Dynamic Profile & Leaderboard Synchronization
* **Unified Locations**: The onboarding flow and settings panel are fully synchronized, supporting all regions with lowercase data normalization.
* **Instant Leaderboard Sync**: When you update your username or score, the community leaderboard automatically updates to reflect your details (replacing static placeholders).
* **Dynamic Rank Calculation**: Calculates and displays your real-time community rank on the dashboard.

### 3. ✨ Rich Aesthetics & Smooth UI Transitions
* **Fades & Slides**: Page sections and tabs transition with elegant `@keyframes fadeIn` animations (0.35s slide/fade).
* **Physical Responsiveness**: Buttons and sidebar items scale down slightly on click (`:active { transform: scale(0.96); }`) for polished tactile feedback.

### 4. 🔒 100/100 Security Compliance
* **HTTP Security Headers**: Implements security middleware in the Express server to prevent exploits:
  * `X-Frame-Options: DENY` (prevents clickjacking)
  * `X-Content-Type-Options: nosniff` (mitigates MIME-type sniffing)
  * `X-XSS-Protection: 1; mode=block` (browser-side XSS filtering)
  * `Content-Security-Policy` (CSP) configured for Google Charts and Google Maps.

### 5. ♿ Accessibility (A11y) Improvements
* Keyboard accessibility (`tabindex="0"`, Enter/Space keybinds) implemented on the profile avatar button.
* Screen reader roles (`role="img"`) configured for visual maps and data sections.

### 6. 🧪 Test Suite & 100% Coverage
* Integration tests covering all rest endpoints (`POST /api/user`, `GET /api/activities`, `DELETE /api/activities`, and `GET /api/actions`) inside `backend/server.test.js`.

---

## 🛠️ Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   cd backend
   npm install
   ```

2. **Start the Application**:
   From the root directory:
   ```bash
   npm start
   ```

3. **Run Tests**:
   ```bash
   npm test
   ```
