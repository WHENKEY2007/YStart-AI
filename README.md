# 🚀 YStart-AI

> **Don't pitch assumptions. Prove them.**

**YStart-AI** is a friendly, AI-powered platform that helps founders discover how feasible their startup idea is. 

Instead of guessing or writing long business plans, YStart-AI interviews you, challenges your assumptions with an AI advisory board, suggests quick real-world tests, and scores your investor readiness.

---

## 🌟 How It Works

```
  💡 Your Idea 
       ↓
  🎤 Founder Interview     (AI asks 8-10 simple questions)
       ↓
  👥 AI Advisory Board     (Market, Product, Business, Growth & Critic)
       ↓
  ⚡ Feasibility Lab       (Quick, lightweight real-world tests)
       ↓
  📊 Investor Readiness    (0-100 score + Printable 1-Pager)
```

---

## ✨ Key Features

- **🎤 Interactive Founder Interview**: A smart conversational agent that asks clear, short questions one at a time to build your startup profile.
- **👥 6-Perspective AI Board**:
  - **Market Agent**: Analyzes target users, pain points, and competitors.
  - **Product Agent**: Evaluates MVP scope and core features.
  - **Business & Finance Agent**: Checks pricing and revenue models.
  - **Growth Agent**: Suggests channels to reach your first 100 users.
  - **Critic Agent**: Spots unproven assumptions and asks tough questions.
  - **Chairman**: Synthesizes the overall feasibility verdict.
- **⚡ Feasibility Lab**: Practical, low-effort tests (like talking to 5 users or running a quick poll) with instant feasibility signal feedback and screenshot/photo proof support.
- **📊 Explainable Investor Readiness Score**: An evidence-backed 0–100 score across 7 dimensions with clear next steps and one-click PDF export.
- **🔄 Smart Change Detection**: Update any part of your startup idea anytime, and YStart-AI intelligently re-evaluates only the affected areas.

---

## 🛠️ Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/) (React, TailwindCSS, Radix UI, Lucide Icons)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **AI Engine**: [OpenAI](https://openai.com/) (`gpt-5-nano` / `gpt-4o`)

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- An OpenAI API Key
- A Supabase project (or use the pre-configured database)

---

### Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/Hasini2706/YStart-AI.git
cd YStart-AI

# Install dependencies
npm install --legacy-peer-deps
```

---

### Step 2: Configure Environment Variables

Create a file named `.env.local` in the project root:

```env
# Supabase Configuration
SUPABASE_URL=https://zbqvfubmlauotxcaemit.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-nano
```

*(See `.env.example` for a template).*

---

### Step 3: Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to start validating your startup idea!

---

## 🧪 Testing & Verification

Run the built-in end-to-end test suite:

```bash
node verify_proofloop_e2e.js
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
