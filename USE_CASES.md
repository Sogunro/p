# Product Discovery Tool - Use Cases

## Overview
The Product Discovery Tool is a collaborative workspace designed to help product teams validate ideas, gather evidence, and make data-driven decisions before committing to development.

---

## Primary Use Cases

### 1. Feature Validation Workshop

**Actors:** Product Manager, UX Researcher, Engineering Lead

**Scenario:** A PM wants to validate a new feature idea before adding it to the roadmap.

**Flow:**
1. PM creates a new discovery session with template "Feature Validation"
2. Defines objectives: "Validate user need for dark mode toggle"
3. Creates sections: "User Pain Points", "Evidence", "Risks", "Alternatives"
4. Team adds sticky notes with observations and hypotheses
5. Attaches evidence (user interview links, survey results, analytics screenshots)
6. Uses **Evidence Strength Scoring** to categorize evidence quality:
   - **High:** Direct user interviews, A/B test results
   - **Medium:** Survey responses, support tickets
   - **Low:** Anecdotal feedback, assumptions
7. Reviews **Assumption Heat Map** to see which sections need more validation
8. Runs AI analysis to get objective recommendations
9. Exports findings to PRD for stakeholder review

**Value:** Ensures features are built based on validated needs, not assumptions.

---

### 2. Competitive Analysis Session

**Actors:** Product Manager, Marketing Lead

**Scenario:** Analyzing competitor products to identify differentiation opportunities.

**Flow:**
1. Create session with sections for each competitor
2. Add sticky notes for features, pricing, positioning
3. Use **Smart Linking** to connect related features across competitors
4. Attach evidence (screenshots, pricing pages, reviews)
5. Create a "Opportunities" section for identified gaps
6. AI analysis highlights patterns and suggests focus areas

**Value:** Visual comparison with linked insights reveals market opportunities.

---

### 3. User Research Synthesis

**Actors:** UX Researcher, Product Designer

**Scenario:** Synthesizing findings from 20+ user interviews into actionable insights.

**Flow:**
1. Create session with sections: "Quotes", "Pain Points", "Desires", "Behaviors"
2. Add sticky notes for each key observation
3. Drag related notes together within sections
4. Use **Smart Linking** to connect themes across sections
5. Add interview recordings/transcripts as evidence
6. Score evidence strength (interviews = High)
7. Collapse completed sections to focus on areas needing work
8. Generate AI summary with key themes and recommendations

**Value:** Transforms raw research data into structured, evidence-backed insights.

---

### 4. Sprint Planning Discovery

**Actors:** Product Manager, Scrum Master, Dev Team

**Scenario:** Deciding which features to prioritize for the next sprint.

**Flow:**
1. Create session with candidate features as sections
2. Team adds notes on: user value, technical complexity, risks
3. Attach evidence for each feature (customer requests, metrics)
4. Review **Health Score** badges on each section
5. Features with high evidence scores get prioritized
6. Use constraints (budget, timeline, team capacity) to filter
7. Run AI analysis for final recommendations
8. Export selected features to backlog

**Value:** Data-driven sprint planning with visible evidence trail.

---

### 5. Problem Space Exploration

**Actors:** Product Team, Stakeholders

**Scenario:** Exploring a new problem space before defining solutions.

**Flow:**
1. Create blank canvas session
2. Add initial section: "What we think we know"
3. Team brainstorms on sticky notes
4. Create sections: "Validated", "To Validate", "Assumptions"
5. Move notes between sections as evidence is gathered
6. Links show relationships between problems
7. Color-coded health indicators show validation progress
8. AI identifies gaps and suggests validation approaches

**Value:** Prevents jumping to solutions before understanding the problem.

---

## Differentiating Features in Action

### Assumption Heat Map
- **Visual feedback:** Sections turn red → yellow → green as evidence is added
- **Health score badge:** Shows "65% evidence-backed" at a glance
- **Border colors:** Immediate visual cue for section validation status

### Evidence Strength Scoring
- **High (Green):** Customer interviews, analytics data, A/B test results
- **Medium (Yellow):** Surveys, support tickets, competitor analysis
- **Low (Red):** Anecdotal feedback, internal opinions, assumptions
- **Weighted analysis:** AI considers evidence strength in recommendations

### Smart Linking
- **Cross-section connections:** Link related notes across different sections
- **Visual relationship map:** Purple dashed lines show connections
- **Pattern discovery:** Identify themes that span multiple categories

### Resizable Sections
- **Drag edges:** Expand sections horizontally or vertically
- **Collapse/expand:** Minimize completed sections
- **Flexible layout:** Organize canvas to match your workflow

---

## Sample Workflow: End-to-End

```
Day 1: Setup
├── Create discovery session
├── Define 2-3 clear objectives
├── Add sections based on template
└── Invite team collaborators

Day 2-5: Discovery
├── Team adds observations as sticky notes
├── Attach evidence (links, quotes, data)
├── Score evidence strength
├── Link related concepts
└── Monitor health scores

Day 6: Analysis
├── Review assumption heat map
├── Identify sections needing validation
├── Run AI analysis
└── Review recommendations

Day 7: Decision
├── Export findings
├── Present to stakeholders
└── Make go/no-go decision with evidence
```

---

## Metrics for Success

| Metric | Before Tool | After Tool |
|--------|-------------|------------|
| Feature validation time | 2-3 weeks | 3-5 days |
| Evidence attached to decisions | ~20% | ~80% |
| Stakeholder alignment | Multiple meetings | Single review |
| Assumption vs. evidence ratio | Unknown | Visible & tracked |

---

## Integration Points (Future)

- **Jira/Linear:** Export validated features as tickets
- **Notion/Confluence:** Publish findings as documentation
- **Figma:** Link to design prototypes as evidence
- **Mixpanel/Amplitude:** Attach analytics dashboards
- **Dovetail/UserTesting:** Import research sessions

---

*Built for product teams who believe great products come from validated insights, not assumptions.*
