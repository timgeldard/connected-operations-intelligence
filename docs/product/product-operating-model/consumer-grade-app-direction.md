# Consumer-Grade App Direction

This repository is dedicated to building **consumer-grade manufacturing applications** that are powered by a **governed, app-facing data-product layer**. 

Under this operating model, consumer applications, app-facing data products, and readiness evidence are equal delivery concerns. The data governance layer is not the final product; it is the trusted foundation underneath polished, workflow-led, design-system-aligned applications.

---

## Operating Principles

1. **Consumer Applications are the Primary Delivery Focus**:
   The end goal of our development cycles is the delivery of premium, high-quality, and intuitive applications for manufacturing, quality, traceability, warehouse, process order, SPC, and operations users. 
   
2. **Strict Data Governance as a Trusted Foundation**:
   Our focus on user experience does not weaken our commitment to rigorous data governance. The data product layer must remain strictly governed:
   - **No fabricated fields** or speculative models.
   - **No silent mock fallback** in non-mock adapter modes.
   - **No invented Units of Measure (UOMs)**.
   - **No production-readiness claims** without browser UAT evidence.
   - **No recall/release/safety/decision labels** without governed source semantics.

3. **Surface Governance as User-Facing Caveats**:
   Data limitations and governance states must be communicated clearly using clean, non-technical, user-facing confidence and caveat language (such as status banners or info cards). Avoid exposing raw technical log details, schema field classifications, or database metadata.

4. **Prototypes vs. Production Products**:
   Existing workspaces and adapters should be treated as inspiration and reference material. They are not automatically production-ready applications until they satisfy the required gates in both the Application Maturity Model and the Data-Product Maturity Model.

---

## Repo Architecture Layers

| Layer | Purpose | Primary Owner Concern | Success Measure |
|---|---|---|---|
| **Consumer Application Layer** | Delivers workflow-led, design-system-aligned, and polished interfaces for plant operators and supervisors. | UX/UI alignment, guided work steps, error boundary presentation, task completion. | Operational adoption, high usability scores, and successful execution of business workflows without user confusion. |
| **App-Facing Data-Product Layer** | Exposes verified schemas, type definitions, row mappers, and source adapters mapping raw systems of record to app contracts. | Schema contracts, type-safety, contract drift detection, and adapter fallback integrity. | Zero contract compilation errors, verified end-to-end integration, and strict field classifications. |
| **Governance/Evidence Layer** | Provides verifiable proof of data authenticity, schema classifications, and UAT verification evidence. | Audit trails, safety-decision validation, mock prevention, and regulatory compliance. | 100% test coverage of row mappers, captured browser UAT logs, and zero unauthorized data claims. |

---

## Related Documents

- [Application Experience Maturity Model](application-experience-maturity-model.md)
- [Consumer App Principles](consumer-app-principles.md)
- [Agent Contribution Rules](../app-data-layer/agent-contribution-rules.md)
