# 🚚 TrustRoute Escrow: Web3 Logistics & Distributed Trust

![TrustRoute Banner](https://img.shields.io/badge/Status-Hackathon_Ready-success?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Corda-Blockchain-red?style=flat-square) ![Tech Stack](https://img.shields.io/badge/Angular-Frontend-dd0031?style=flat-square) ![Tech Stack](https://img.shields.io/badge/Node.js-Oracle-339933?style=flat-square) ![Tech Stack](https://img.shields.io/badge/Supabase-Database-3ecf8e?style=flat-square)

**TrustRoute** is a decentralized, blockchain-powered logistics platform that replaces traditional trust with cryptographic certainty. By utilizing **Corda DLT (Distributed Ledger Technology)** and a custom **Fiat-to-Crypto Oracle Gateway**, TrustRoute ensures that delivery funds are locked in an immutable smart contract escrow until delivery is verified.

---

## 📖 Product Requirements Document (PRD)

### Problem Statement
In the gig economy and freelance logistics sector, trust is broken. Drivers risk non-payment after delivery, while customers risk paying for goods that never arrive or arrive damaged. Centralized escrow services take massive fee cuts and lack transparency.

### The Solution
A decentralized Web3 escrow service where:
1. Customer funds are securely locked in a blockchain state (`LOCKED`).
2. The Driver physically delivers the package.
3. The Customer verifies receipt, triggering the smart contract to release funds (`RELEASED`).
4. In case of failure, funds are frozen for arbitration (`DISPUTED`).

---

## 🏛️ System Architecture & Design Document

TrustRoute is built on a hybrid Web2/Web3 architecture to maximize user experience while maintaining blockchain security.

### Tech Stack
* **Frontend (Web2 UI):** Angular 18, Tailwind CSS, RxJS.
* **Middleware/Oracle (The Bridge):** Node.js, Express, Axios. Acts as an Oracle to feed off-chain real-world data (fiat payments) to the blockchain.
* **Database (Off-chain State Cache):** Supabase (PostgreSQL) for blazing-fast UI rendering.
* **Blockchain (On-chain Truth):** R3 Corda, Java, Spring Boot RestController. Manages the Escrow State Machine.
* **Payments:** Simulated Fiat Gateway (Mock Razorpay Integration).

### Core Workflow (The Escrow State Machine)
1. **Initiation:** Customer submits order details via Angular.
2. **Oracle Verification:** Node.js intercepts the fiat payment and logs the pending state to Supabase.
3. **Smart Contract Lock:** Node.js triggers the Corda Spring Boot `/create` endpoint. Corda generates an `EscrowState` and locks the funds on the ledger.
4. **Fulfillment:** Driver delivers the item. Customer clicks "Confirm Delivery".
5. **Consensus & Settlement:** The Node.js Oracle calls Corda's `/release` flow. The Corda nodes reach consensus, update the ledger, and the funds are programmatically released to the supplier.

---

## ⚖️ Technical Trade-offs (Pros & Cons)

### Pros
* **Immutability:** Financial states are stored on Corda; they cannot be tampered with by rogue database admins.
* **Privacy:** Unlike public blockchains (Ethereum/Polygon), Corda's point-to-point architecture means transaction details are only shared on a "need-to-know" basis between the customer and driver.
* **UX Focused:** Using Supabase as an off-chain cache allows the UI to load instantly without waiting for blockchain block times.

### Cons
* **Oracle Dependency:** The system relies on the Node.js middleware to act as a truthful Oracle between the fiat gateway and the Corda network. If the Oracle goes down, states cannot update.
* **Setup Complexity:** Running JVM-based Corda nodes alongside a Node.js server and Angular frontend requires significant local resources.

---

## 🚀 How to Run the Project Locally

Follow these precise steps to spin up the entire hybrid ecosystem.

### Prerequisites
* Node.js (v18+)
* Java Development Kit (JDK 8 for Corda 4.x)
* Angular CLI (`npm install -g @angular/cli`)

### Step 1: Start the Corda Blockchain Network
1. Navigate to the Corda project directory.
2. Build and deploy the nodes: `./gradlew deployNodes`
3. Run the network: `build/nodes/runnodes`
4. Start the Spring Boot Webserver Bridge: `./gradlew runWebserver` *(Runs on port 10050)*

### Step 2: Start the Node.js Oracle (Backend)
1. Navigate to the `trustroute-backend` directory.
2. Install dependencies: `npm install`
3. Configure your `.env` file with your Supabase keys:
   ```env
   PORT=5000
   SUPABASE_URL=[https://your-id.supabase.co](https://your-id.supabase.co)
   SUPABASE_KEY=your-anon-key
