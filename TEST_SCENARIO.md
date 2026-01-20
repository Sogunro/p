# Product Discovery Tool - Test Scenario Document

> **Purpose:** Complete test data for validating all features of the Product Discovery Tool

---

## Table of Contents
1. [Test Session: Mobile App Onboarding Redesign](#test-session-mobile-app-onboarding-redesign)
2. [Sample Evidence Sources](#sample-evidence-sources)
3. [Sticky Note Content](#sticky-note-content)
4. [Evidence Bank Items](#evidence-bank-items)
5. [Insights Feed Data](#insights-feed-data)
6. [Expected Analysis Results](#expected-analysis-results)

---

## Test Session: Mobile App Onboarding Redesign

### Session Metadata
- **Template:** Target Users
- **Session Name:** "Mobile App Onboarding Redesign - Q1 2026"
- **Created:** 2026-01-20

---

### Session Objectives

| # | Objective | Measurable Target |
|---|-----------|-------------------|
| 1 | Identify the top 3 pain points in current onboarding flow | Document at least 3 validated pain points with evidence |
| 2 | Validate target user personas for mobile app | Confirm 2-3 distinct user segments with behavioral evidence |
| 3 | Determine which onboarding steps have highest drop-off | Quantify drop-off rates with analytics data |
| 4 | Generate hypothesis for improved onboarding experience | Create 3+ testable hypotheses based on evidence |

---

### Session Checklist

- [ ] Review existing onboarding analytics
- [ ] Analyze user feedback from support tickets
- [ ] Map current user journey (first 7 days)
- [ ] Identify competitor onboarding approaches
- [ ] Validate assumptions with user interview quotes
- [ ] Prioritize pain points by impact
- [ ] Document recommended next steps

---

### Session Constraints

| Constraint | Value | Reason |
|------------|-------|--------|
| Timeline | 4 weeks | Q1 deadline |
| Budget | $15,000 | Limited UX research budget |
| Technical | Must work with existing auth system | No backend changes this quarter |
| Team | 2 designers, 1 PM, 1 engineer | Resource constraints |

---

## Sample Evidence Sources

### Configure These in `/settings/insights-schedule`

#### Slack Configuration
**Enable Slack: ✓**

| Channel Name | Channel ID | Description |
|--------------|------------|-------------|
| #product-feedback | C0123FEEDBACK | Customer feedback channel |
| #support-escalations | C0456SUPPORT | Escalated support issues |
| #user-research | C0789RESEARCH | UX research findings |

**Sample Slack Channel Links to Paste:**
```
https://productteam.slack.com/archives/C0123FEEDBACK
https://productteam.slack.com/archives/C0456SUPPORT
https://productteam.slack.com/archives/C0789RESEARCH
```

#### Notion Configuration
**Enable Notion: ✓**

| Database Name | Database ID | Description |
|---------------|-------------|-------------|
| User Interview Notes | abc123def456abc123def456abc12345 | Interview transcripts |
| Competitor Analysis | def456abc123def456abc123def45678 | Competitor research |
| Feature Requests | 789abc123def456abc123def456abc12 | User-submitted requests |

**Sample Notion Links to Paste:**
```
https://www.notion.so/productteam/abc123def456abc123def456abc12345
https://notion.so/productteam/def456abc123def456abc123def45678?v=123
https://www.notion.so/789abc123def456abc123def456abc12-Feature-Requests
```

#### Airtable Configuration
**Enable Airtable: ✓**

| Base Name | Base ID | Table ID | Description |
|-----------|---------|----------|-------------|
| User Research | appABC123XYZ | tblUSERDATA | User survey responses |
| NPS Tracker | appDEF456QRS | tblNPSDATA | NPS scores and comments |
| Support Tickets | appGHI789TUV | tblSUPPORT | Categorized support tickets |

**Sample Airtable Links to Paste:**
```
https://airtable.com/appABC123XYZ/tblUSERDATA/viwSURVEY
https://airtable.com/appDEF456QRS/tblNPSDATA
https://airtable.com/appGHI789TUV/tblSUPPORT/viwONBOARDING
```

#### Mixpanel Configuration
**Enable Mixpanel: ✓**

Mixpanel is workspace-wide (no per-source config). Credentials configured in n8n.

---

## Sticky Note Content

### Section: Target Users

#### User Persona 1: "Busy Professional"
| Note | Type | Has Evidence |
|------|------|--------------|
| "Users aged 25-40 who use app during commute" | Assumption | No (Yellow) |
| "63% of users access app between 7-9 AM" | Evidence | Yes (Green) |
| "Professionals want quick task completion" | Assumption | No (Yellow) |
| "Average session length is 2.3 minutes" | Evidence | Yes (Green) |

#### User Persona 2: "Weekend Explorer"
| Note | Type | Has Evidence |
|------|------|--------------|
| "Users who primarily use app on weekends" | Assumption | No (Yellow) |
| "28% of signups occur Saturday-Sunday" | Evidence | Yes (Green) |
| "Weekend users have 40% higher retention" | Evidence | Yes (Green) |
| "They prefer visual content over text" | Assumption | No (Yellow) |

#### User Persona 3: "Power User"
| Note | Type | Has Evidence |
|------|------|--------------|
| "Daily active users who complete 5+ tasks" | Evidence | Yes (Green) |
| "Power users represent 12% of user base" | Evidence | Yes (Green) |
| "They want advanced customization options" | Assumption | No (Yellow) |
| "Most likely to recommend to others (NPS 72)" | Evidence | Yes (Green) |

---

### Section: Pain Points

| Note | Type | Has Evidence | Evidence Source |
|------|------|--------------|-----------------|
| "Users don't understand value proposition in first 30 seconds" | Evidence | Yes | User interview quote |
| "Too many permission requests on first launch" | Evidence | Yes | App store reviews |
| "Onboarding tutorial feels too long" | Evidence | Yes | Analytics - 45% skip rate |
| "Users confused by navigation layout" | Assumption | No | - |
| "Sign-up form has too many required fields" | Evidence | Yes | Form abandonment data |
| "No clear progress indicator during setup" | Assumption | No | - |
| "Users don't know what to do after signup" | Evidence | Yes | Support ticket analysis |

---

### Section: Opportunities

| Note | Type | Has Evidence |
|------|------|--------------|
| "Progressive disclosure of features" | Assumption | No |
| "Personalized onboarding based on user goals" | Assumption | No |
| "Reduce signup fields from 8 to 3" | Evidence | Yes |
| "Add interactive tutorial with gamification" | Assumption | No |
| "Implement social login (Google, Apple)" | Evidence | Yes |
| "Show value before asking for account" | Assumption | No |

---

### Section: Risks & Constraints

| Note | Type | Has Evidence |
|------|------|--------------|
| "Existing users may be confused by UI changes" | Assumption | No |
| "Need to maintain backward compatibility with v2.x" | Evidence | Yes |
| "Limited engineering resources until Q2" | Evidence | Yes |
| "Legal review required for new data collection" | Evidence | Yes |
| "A/B test infrastructure not ready" | Assumption | No |

---

## Evidence Bank Items

### High Strength Evidence (Validatable)

| Title | Source | URL | Content Summary |
|-------|--------|-----|-----------------|
| "Onboarding Analytics Report - Q4 2025" | mixpanel | https://mixpanel.com/report/onboarding-q4 | 67% of users drop off before completing onboarding. Step 3 (profile setup) has 45% abandonment rate. |
| "User Interview - Sarah M. (Power User)" | notion | https://notion.so/interviews/sarah-m | "I almost gave up during signup. There were too many screens before I could actually do anything useful." |
| "NPS Survey Results - December 2025" | airtable | https://airtable.com/nps-dec-2025 | Onboarding-related comments mentioned by 34% of detractors. Average NPS for users who completed tutorial: 52. Average for skip: 28. |
| "Support Ticket Analysis - Onboarding Issues" | slack | https://slack.com/archives/support/p123456 | 156 tickets in past 30 days related to onboarding confusion. Top issues: password requirements (42), profile photo upload (38), permission requests (31). |
| "Competitor Onboarding Benchmark" | notion | https://notion.so/research/competitor-benchmark | Competitor A: 3-step onboarding, 85% completion. Competitor B: 7-step, 54% completion. Our current: 6-step, 33% completion. |
| "A/B Test: Simplified Signup Form" | mixpanel | https://mixpanel.com/report/ab-signup-v2 | Variant B (3 fields) had 28% higher completion rate than control (8 fields). Statistical significance: 99.2%. |

### Medium Strength Evidence (Partially Validatable)

| Title | Source | URL | Content Summary |
|-------|--------|-----|-----------------|
| "App Store Review Analysis" | manual | https://docs.google.com/sheets/appstore | 127 reviews mention "confusing" or "complicated" setup. 89 reviews specifically mention onboarding. |
| "Customer Success Team Feedback" | slack | https://slack.com/archives/cs-team/p789 | CS team reports spending 30% of calls helping with onboarding issues. Most common question: "Where do I start?" |
| "Heatmap Analysis - First Session" | manual | https://hotjar.com/recordings/first-session | Users click "Skip" button 3.2x more than "Next" on tutorial step 2. Rage clicks detected on profile photo upload. |
| "User Research - Jobs to Be Done" | notion | https://notion.so/jtbd-research | Primary JTBD: "Help me accomplish my goal quickly." Secondary: "Make me feel confident I'm doing it right." |

### Low Strength Evidence (Anecdotal - Not Directly Validatable)

| Title | Source | URL | Content Summary |
|-------|--------|-----|-----------------|
| "Twitter Feedback Thread" | manual | https://twitter.com/user/status/123 | User thread about onboarding frustration - 45 likes, 12 replies agreeing. |
| "Team Brainstorm Notes" | manual | N/A | Internal team ideas for onboarding improvements. Not validated with users. |
| "Competitor Press Release" | manual | https://competitor.com/press/new-onboarding | Competitor announced "revolutionary" onboarding - no data available yet. |
| "Industry Report Quote" | manual | https://forrester.com/reports/mobile-ux | "Best-in-class mobile apps have <4 step onboarding" - general industry trend. |

---

## Insights Feed Data

### Sample AI-Analyzed Insights (from n8n)

These would be received via webhook after running "Fetch Analysis":

```json
{
  "workspace_id": "your-workspace-uuid",
  "analyzed_at": "2026-01-20T18:00:00Z",
  "summary": "32 items analyzed from 4 sources. Key themes: onboarding friction (12 mentions), permission fatigue (8 mentions), value clarity (6 mentions). High-urgency action items identified.",
  "insights": [
    {
      "id": "insight-001",
      "title": "Users abandoning onboarding at profile setup step",
      "description": "Multiple data points show Step 3 (profile setup) is the highest friction point. 45% abandonment rate with primary complaints about required photo upload and bio fields.",
      "source": "mixpanel",
      "source_url": "https://mixpanel.com/report/funnel-analysis",
      "pain_points": ["Mandatory photo upload", "Required bio field", "No skip option"],
      "feature_requests": ["Optional profile fields", "Default avatar option", "Skip for later"],
      "sentiment": "negative",
      "strength": "high",
      "key_quotes": [],
      "tags": ["onboarding", "profile", "abandonment", "friction"]
    },
    {
      "id": "insight-002",
      "title": "Permission requests overwhelming new users",
      "description": "Users report feeling 'attacked' by permission requests immediately after signup. Location, notifications, camera, and contacts all requested in sequence.",
      "source": "slack",
      "source_url": "https://slack.com/archives/feedback/p456",
      "pain_points": ["Too many permissions at once", "No explanation why needed", "Can't proceed without accepting"],
      "feature_requests": ["Just-in-time permissions", "Clear explanation of benefits", "Allow skip"],
      "sentiment": "negative",
      "strength": "high",
      "key_quotes": ["I felt like the app was demanding access to my entire life before I even knew what it did"],
      "tags": ["permissions", "onboarding", "UX", "trust"]
    },
    {
      "id": "insight-003",
      "title": "Value proposition unclear during first interaction",
      "description": "User interviews reveal that 7 out of 10 users couldn't articulate what the app does after completing onboarding. They completed steps mechanically without understanding benefits.",
      "source": "notion",
      "source_url": "https://notion.so/interviews/q1-synthesis",
      "pain_points": ["No clear value shown", "Features explained but not benefits", "Generic welcome messages"],
      "feature_requests": ["Show value before signup", "Personalized benefits", "Quick win in first minute"],
      "sentiment": "neutral",
      "strength": "high",
      "key_quotes": ["I finished the setup but I still don't know why I should use this app", "It told me what buttons do, not what problems it solves"],
      "tags": ["value-proposition", "onboarding", "messaging", "clarity"]
    },
    {
      "id": "insight-004",
      "title": "Power users discovered app through word-of-mouth",
      "description": "Analysis of power user segment shows 73% discovered app through personal recommendation. These users have 4x higher retention than ad-acquired users.",
      "source": "airtable",
      "source_url": "https://airtable.com/user-survey-q4",
      "pain_points": [],
      "feature_requests": ["Referral program", "Share progress feature", "Social proof in onboarding"],
      "sentiment": "positive",
      "strength": "medium",
      "key_quotes": ["My friend showed me how to use it, that's the only reason I stuck around"],
      "tags": ["acquisition", "retention", "word-of-mouth", "power-users"]
    },
    {
      "id": "insight-005",
      "title": "Weekend signups have higher intent",
      "description": "Users who sign up on weekends complete onboarding at 52% rate vs 33% weekday rate. Weekend users also have 40% higher 30-day retention.",
      "source": "mixpanel",
      "source_url": "https://mixpanel.com/report/cohort-weekend",
      "pain_points": [],
      "feature_requests": [],
      "sentiment": "positive",
      "strength": "high",
      "key_quotes": [],
      "tags": ["timing", "retention", "acquisition", "cohorts"]
    }
  ],
  "themes": [
    { "theme": "Onboarding Friction", "count": 12, "sources": ["mixpanel", "slack", "notion"] },
    { "theme": "Permission Fatigue", "count": 8, "sources": ["slack", "airtable"] },
    { "theme": "Value Clarity", "count": 6, "sources": ["notion", "slack"] },
    { "theme": "User Segmentation", "count": 4, "sources": ["mixpanel", "airtable"] }
  ],
  "action_items": [
    { "action": "Audit all permission requests and implement just-in-time pattern", "urgency": "high" },
    { "action": "A/B test removing mandatory profile photo requirement", "urgency": "high" },
    { "action": "Create value demonstration before account creation", "urgency": "medium" },
    { "action": "Implement weekend-specific onboarding variant", "urgency": "low" }
  ]
}
```

---

## Expected Analysis Results

### When Running AI Analysis on This Session

#### Expected Objective Score: 72/100

**Reasoning:**
- Objective 1 (Pain points): STRONG - Multiple validated pain points with high-strength evidence
- Objective 2 (User personas): MEDIUM - Good data but some assumptions not validated
- Objective 3 (Drop-off rates): STRONG - Clear analytics data with specific metrics
- Objective 4 (Hypotheses): MEDIUM - Hypotheses exist but some lack evidence backing

#### Expected Assumption Mapping

| Assumption | Status | Confidence | Recommendation |
|------------|--------|------------|----------------|
| "Users don't understand value proposition" | Validated | 95% | Linked to interview quotes |
| "Onboarding tutorial feels too long" | Validated | 88% | Analytics shows 45% skip rate |
| "Users confused by navigation layout" | Unvalidated | N/A | Needs usability testing |
| "Power users want advanced customization" | Unvalidated | N/A | Survey power user segment |
| "They prefer visual content over text" | Unvalidated | N/A | A/B test content formats |

#### Expected Recommendations

1. **High Priority:** Reduce mandatory fields in profile setup (validated with A/B test data)
2. **High Priority:** Implement just-in-time permission requests (validated with user feedback)
3. **Medium Priority:** Create value demonstration before signup (validated with interviews)
4. **Needs Validation:** Test navigation changes with usability study
5. **Needs Validation:** Survey power users about customization preferences

#### Expected Constraint Analysis

| Constraint | Status | Impact |
|------------|--------|--------|
| 4-week timeline | At Risk | Multiple high-priority items may not fit |
| $15K budget | OK | Proposed changes within budget |
| Existing auth system | OK | No auth changes proposed |
| Team size | At Risk | May need to prioritize ruthlessly |

---

## Test Execution Checklist

### Setup
- [ ] Create new user account
- [ ] Workspace auto-created successfully
- [ ] Configure evidence sources in `/settings/insights-schedule`
- [ ] Add sample Slack channels, Notion databases, Airtable tables

### Evidence Bank
- [ ] Add manual evidence items from "Evidence Bank Items" section
- [ ] Verify source filter tabs work correctly
- [ ] Test source picker when adding new evidence
- [ ] Verify strength badges display correctly

### Session Creation
- [ ] Create session using "Target Users" template
- [ ] Add objectives from this document
- [ ] Add checklist items
- [ ] Configure constraints

### Sticky Notes
- [ ] Add sticky notes to each section
- [ ] Verify yellow styling for assumptions (no evidence)
- [ ] Link evidence to some notes
- [ ] Verify green styling for evidence-backed notes
- [ ] Verify label badges show "ASSUMPTION" or "EVIDENCE"

### Evidence Linking
- [ ] Link evidence via URL paste
- [ ] Link evidence via text input
- [ ] Link evidence from Evidence Bank
- [ ] Verify note turns green after linking
- [ ] Verify evidence count shows correctly

### Insights Feed
- [ ] Trigger "Run Analysis Now" from settings
- [ ] Verify pending insights appear in Evidence Bank
- [ ] Add insight to bank with strength level
- [ ] Dismiss unwanted insight
- [ ] Verify dismissed insights don't reappear

### AI Analysis
- [ ] Run analysis on completed session
- [ ] Verify objective scoring
- [ ] Verify assumption mapping
- [ ] Verify recommendations generated
- [ ] Export as Markdown
- [ ] Export as JSON

### Team Features
- [ ] Create invite link
- [ ] Join workspace with second account
- [ ] Verify shared evidence visible
- [ ] Verify shared sessions visible
- [ ] Test member role changes

---

## API Payload Samples

### Trigger Fetch (POST /api/workspace/fetch-now)
```json
{
  "lookback_hours": 24
}
```

### Manual Evidence (POST /api/evidence-bank)
```json
{
  "title": "User Interview - Sarah M.",
  "type": "url",
  "url": "https://notion.so/interviews/sarah-m",
  "strength": "high",
  "source_system": "notion"
}
```

### Link Evidence to Note (POST /api/evidence-bank/link)
```json
{
  "stickyNoteId": "note-uuid-here",
  "evidenceBankId": "evidence-uuid-here"
}
```

### Schedule Fetch (POST /api/workspace/schedule-fetch)
```json
{
  "scheduled_at": "2026-01-21T09:00:00Z",
  "lookback_hours": 48
}
```

---

*Last updated: 2026-01-20*
