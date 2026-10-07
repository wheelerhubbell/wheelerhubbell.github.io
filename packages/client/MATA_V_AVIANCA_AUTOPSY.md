# Epistemic Autopsy: Mata v. Avianca — A Supported Answer to the Wrong Question

**Source Object:** *Mata v. Avianca, Inc.*, No. 22-cv-1461 (PKC), ECF No. 54 (S.D.N.Y. June 22, 2023).  
**Core Finding:** A fully sourced answer can remain non-responsive and catastrophically misleading because an AI silently substitutes the assigned question ( 	o Q_1$). Every material proposition can be true in the source record, yet the answer still fails.

---

## The Controlled Demonstration

### 1. The Governing Assignment ($)
> *"Using only ECF No. 54, explain why the March 15 challenge to the cited authorities and the April 11 and 12 production orders failed to cause respondents to withdraw, correct, or cease advocating the disputed authorities."*

### 2. The Reconstructed Operative Question ($)
When asked $, frontier LLMs silently substitute the task to an easier, neighboring historical narrative:
> *"Explain why the Court sanctioned respondents under Rule 11 and inherent powers."*

### 3. The Epistemic Breach
- Every cited quote in the model's response is genuine.
- Every reference to ECF No. 54 is verified.
- **Yet the system committed an epistemic boundary violation:** it answered $ while claiming to answer $. It laundered authority by presenting a correct analysis of sanctions as an answer to the operational failure of notice.

---

## Why Prompt Engineering Fails Here

Traditional prompt constraints ("Only answer using source X") cannot catch task substitution because the model *did* use source X. 

Under the **Authority Conservation Principle**:
4802A(c) \le P(c)4802

No downstream reasoning step can manufacture authority to alter the jurisdictional bounds of the initial assignment. If the assignment is $, an answer addressing $ has **zero epistemic standing**, regardless of factual accuracy.

---

## The Code Remedy: WHP Standing Guard

Developers cannot rely on the model to monitor its own task fidelity. You must guard execution boundaries before tools or answers are committed:



If the agent drifts into $ task substitution, the call fails closed with .

---

- **NPM Package:** [@wheelerhubbell/whp-standing-client](https://www.npmjs.com/package/@wheelerhubbell/whp-standing-client)
- **Engine & x402 Gateway:** [https://standing-guard-service.lovable.app](https://standing-guard-service.lovable.app)
- **Protocol & Invariant:** Wheeler Hubbell Publishing / Authority Conservation Principle
