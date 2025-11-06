# 🌿 ZenithMind — Your Mental Health Companion with CBT Support

ZenithMind is a **privacy-focused mental wellness assistant** that blends a supportive AI companion with **Cognitive Behavioral Therapy (CBT)** practices. It helps you understand your thoughts, track your moods, identify patterns, and gently reframe negative thinking — all while keeping your data **private and in your control**.

> ⚠️ **Important:** ZenithMind does **not** diagnose, prevent, or treat mental health conditions.  
> It is **not** a replacement for professional help or therapy.  
> If you are in crisis, please contact emergency services or a suicide prevention helpline immediately.

---

## ✨ Features

### 🧠 Guided CBT Tools
- 📝 Thought Diary *(Situation → Thought → Emotion → Evidence → Reframe)*
- 🔍 Identify cognitive distortions *(e.g., catastrophizing, overgeneralization, all-or-nothing thinking)*
- 💡 Gentle reframe suggestions to encourage healthier thinking patterns

### 😊 Mood Check-Ins
- 🎚️ Mood rating (1–10)
- 🎭 Emotion tagging (custom & preset)
- 🧩 Context logging to understand triggers

### 💬 Supportive AI Chat
- 🤗 Empathetic and non-judgmental conversation
- 🫶 Grounding and breathing exercise guidance
- 📜 Journal summary insights and clarity prompts

### 📊 Progress & Reflection Insights
- 📈 Mood trend tracking over days/weeks
- 🔁 Trigger pattern recognition
- 🔔 Optional supportive reminders (non-intrusive)

### 🔐 Privacy First
- 🏠 All data stored **locally** by default
- ☁️ Cloud sync is **optional**
- 🔑 API keys are never stored in the client bundle

### ⚡ Optional Real-Time Mode (Experimental)
- 🗣️ Real-time streaming assistive chat
- Located inside `/realtime/`

---

## 🧱 Tech Stack

| 🔧 Layer | 🛠️ Technology |
|--------|--------------|
| Frontend | React (Create React App) |
| Styling | Custom CSS utility components |
| Backend *(Optional)* | Node.js + Express (`/server`) |
| Real-Time *(Optional)* | Streaming system (`/realtime`) |

---

## 🚀 Getting Started

### 1️⃣ Clone the Repository
```sh
git clone https://github.com/AdityaBadgujar85/Zenith-Mind.git
cd Zenith-Mind
```

### 2️⃣ Install Client Dependencies
```sh
npm install
```

### 3️⃣ (Optional) Install Server Dependencies
```sh
cd server
npm install
```

### 4️⃣ Add Environment Variables
```sh
cp .env.example .env
```

Fill your `.env`:

```
# Client
REACT_APP_API_BASE=http://localhost:5001

# Server
PORT=5001
OPENAI_API_KEY=your_key_here
ALLOWED_ORIGINS=http://localhost:3000
```

> 🔒 Keep API keys **only on the server**.

### 5️⃣ Start the App
```sh
npm start
```
Visit: http://localhost:3000 

### 6️⃣ (Optional) Start Backend Server
```sh
cd server
npm start
```

### 7️⃣ (Optional) Real-Time Mode
```sh
cd realtime
# Follow instructions in this folder
```

---

## 🗂️ Project Structure

```
Zenith-Mind/
├─ public/           # Static assets
├─ src/              # Frontend UI + State Logic
├─ server/           # Optional backend
├─ realtime/         # Optional real-time streaming
├─ .env.example
└─ README.md
```

---

## 🎯 How to Use

1. 😊 **Log your mood** for the day.
2. 🧠 **Record your thought** in the Thought Diary.
3. 🔍 **Spot distortions** and patterns.
4. ✨ **Reframe** the thought into something healthier.
5. 📊 **Review insights** to improve emotional awareness.

---

## 🔐 Privacy & Safety

- ✅ No sign-in required.
- 📦 Data lives on **your device**, unless cloud sync is enabled.
- 🛡️ API key + model access handled server-side.

---

## 🧪 Testing

```sh
npm test
```

---

## 🛠 Available Scripts

| Command | Description |
|--------|-------------|
| `npm start` | Start development environment |
| `npm run build` | Create production build |
| `npm test` | Run test suite |
| `npm run eject` | Eject CRA config *(irreversible)* |

---

## 🗺 Roadmap

- 🧍 5–4–3–2–1 grounding walkthrough
- ✅ Behavioral activation planning
- 📤 Data export & 📥 Import functionality
- 🔐 Optional encrypted journal storage
- 📱 Full mobile layout enhancement
- 🌍 Language support (starting with *Hindi*)

---

## 🤝 Contributing

Contributions are welcome and appreciated!

1. Open an issue and describe your idea ✨
2. Discuss approach before coding 👥
3. Submit focused, meaningful PRs ✅

This is a **mental health** project — please be **kind, compassionate, and respectful**. 💚

---

## 📄 License
**MIT License** *(Add `LICENSE` file if not already included.)*

---

## 💛 Credits

- CBT structure inspired by publicly available therapeutic worksheets
- Built with **React** + **Node.js**

---

