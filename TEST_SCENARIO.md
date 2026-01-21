# Product Discovery Tool - Test Scenario Document

> **Purpose:** Easy copy-paste test data for validating all features
> **Evidence Sources:** Slack (complaints channel), Notion (research docs), Airtable (survey responses)

---

## Session Setup

**Template:** Target Users
**Session Name:** Mobile App Onboarding Redesign - Q1 2026

---

## Objectives (Copy each line)

```
Identify the top 3 pain points in current onboarding flow
```
```
Validate target user personas for mobile app
```
```
Determine which onboarding steps have highest drop-off
```

---

## Checklist Items (Copy each line)

```
Review existing onboarding analytics
```
```
Analyze user feedback from support tickets
```
```
Map current user journey (first 7 days)
```

---

## Constraints (Copy each)

**Name:** `Timeline` **Value:** `4 weeks`
**Name:** `Budget` **Value:** `$15,000`
**Name:** `Technical` **Value:** `Must work with existing auth system`

---

## Evidence Sources Configuration

### Slack Links
```
https://productteam.slack.com/archives/C0123FEEDBACK
```
```
https://productteam.slack.com/archives/C0456SUPPORT
```

### Notion Links
```
https://www.notion.so/productteam/abc123def456abc123def456abc12345
```

### Airtable Links
```
https://airtable.com/appABC123XYZ/tblUSERDATA/viwSURVEY
```

---

## STICKY NOTES + EVIDENCE

### Section: TARGET USERS

---

#### Item 1 - NO EVIDENCE (Yellow/Assumption)
**Sticky Note:**
```
Users aged 25-40 use app during commute
```

---

#### Item 2 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Users check app first thing in the morning
```

**Evidence Title:**
```
Slack Feedback - Morning Usage Pattern
```

**Evidence Source:** `slack`
**Evidence Strength:** `medium`

**Evidence Text:**
```
#product-feedback | Sarah K. | 9:15 AM
Hey team, just wanted to share some feedback. I noticed I always open the app right when I wake up around 7am to check my tasks for the day. It would be nice if the app loaded faster in the morning - sometimes it takes forever!

    Lisa M. replied in thread:
    Same here! I check it before my coffee even. Morning loading is definitely slow.

    Tom R. replied in thread:
    +1, I'm usually checking between 7-8am and the sync takes ages
```

---

#### Item 3 - NO EVIDENCE (Yellow/Assumption)
**Sticky Note:**
```
Professionals want quick task completion
```

---

#### Item 4 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Power users prefer keyboard shortcuts
```

**Evidence Title:**
```
Notion Research - Power User Interview Notes
```

**Evidence Source:** `notion`
**Evidence Strength:** `high`

**Evidence Text:**
```
## User Interview: Marcus T. (Power User Segment)
**Date:** January 15, 2026
**Interviewer:** Product Team

### Key Findings:
- Uses app 4-5 hours daily for project management
- "I hate reaching for my mouse. Every second counts when I'm in flow."
- Has memorized all existing shortcuts, wants more
- Suggested: Cmd+K command palette like Slack/Notion
- Would pay extra for "pro" features with advanced shortcuts

### Direct Quotes:
> "The moment I have to click through 3 menus to do something I do 50 times a day, I start looking for alternatives."

> "I've been using your app for 2 years. If you added vim-style navigation, I'd never leave."
```

---

#### Item 5 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Weekend users have higher engagement
```

**Evidence Title:**
```
Airtable Survey - Usage Patterns Q4
```

**Evidence Source:** `airtable`
**Evidence Strength:** `high`

**Evidence Text:**
```
Survey Response ID: #4521
Respondent: Anonymous
Date: 2026-01-10

Q: When do you typically use the app?
A: Mostly weekends when I have more time to properly organize things

Q: How would you rate your satisfaction (1-10)?
A: 9

Q: What keeps you coming back?
A: On weekends I can actually explore features without rushing. Weekday use feels stressful because I'm always in a hurry.

---

Survey Response ID: #4522
Respondent: Anonymous
Date: 2026-01-10

Q: When do you typically use the app?
A: Saturday mornings are my "planning time"

Q: How would you rate your satisfaction (1-10)?
A: 8

Q: Additional comments?
A: Love the app but wish the weekday experience was as calm as weekends. Maybe a "quick mode" for busy days?
```

---

### Section: PAIN POINTS

---

#### Item 1 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Users don't understand value proposition in first 30 seconds
```

**Evidence Title:**
```
Slack Complaints - Onboarding Confusion
```

**Evidence Source:** `slack`
**Evidence Strength:** `high`

**Evidence Text:**
```
#customer-complaints | Jennifer M. | 2:34 PM
I just signed up for your app and I'm completely lost. What is this even supposed to do? I clicked around for 5 minutes and still have no idea what problem this solves. Your landing page said "transform your workflow" but transform it into WHAT?

    Support Bot: Thanks for your feedback! A team member will respond shortly.

    Mike (Support) replied in thread:
    Hi Jennifer, sorry for the confusion! Our app helps you... [continues]

    Jennifer M. replied in thread:
    I already uninstalled. Maybe make it clearer upfront what the app does before asking me to create an account.

---

#customer-complaints | David L. | 4:12 PM
New user here. Spent the whole onboarding clicking "Next" without understanding anything. Too many features thrown at me at once. I just wanted to try the basic feature your ad mentioned.

    3 people reacted with :disappointed:
```

---

#### Item 2 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Too many permission requests on first launch
```

**Evidence Title:**
```
Slack Complaints - Permission Overload
```

**Evidence Source:** `slack`
**Evidence Strength:** `high`

**Evidence Text:**
```
#customer-complaints | Amanda R. | 11:23 AM
Why does your app need access to my contacts, camera, location, AND microphone just to use it? I just want to make a simple to-do list. This feels super invasive. I denied everything and now half the app doesn't work??

    12 people reacted with :+1:
    5 people reacted with :100:

    Chris (Support) replied in thread:
    Hi Amanda, I understand your concern. We request these permissions for...

    Amanda R. replied in thread:
    I don't care WHY you need them. I shouldn't need to give you my whole life to use a productivity app. Fix this please.

---

#customer-complaints | Robert K. | 3:45 PM
Just downloaded the app. Got hit with FOUR permission popups before I could even see the main screen. Immediately uninstalled. This is 2026, people care about privacy!

    Kevin P. replied in thread:
    Same experience. Asked for camera access during onboarding - I'm not even going to use any camera features!
```

---

#### Item 3 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Onboarding tutorial is too long
```

**Evidence Title:**
```
Notion Research - Tutorial Completion Analysis
```

**Evidence Source:** `notion`
**Evidence Strength:** `high`

**Evidence Text:**
```
## Onboarding Tutorial Analysis
**Analysis Date:** January 2026
**Data Source:** Product Analytics Team

### Current Tutorial Flow:
1. Welcome screen (avg. 3 sec)
2. Feature intro #1 - Tasks (avg. 8 sec)
3. Feature intro #2 - Calendar (avg. 6 sec)
4. Feature intro #3 - Collaboration (avg. 5 sec)
5. Feature intro #4 - Integrations (avg. 4 sec)
6. Feature intro #5 - Analytics (avg. 3 sec)
7. Profile setup (avg. 45 sec)
8. Team invite (avg. 30 sec)
9. First task creation (avg. 60 sec)
10. Completion celebration (avg. 2 sec)

### Drop-off Analysis:
- Step 1→2: 95% continue
- Step 2→3: 87% continue
- Step 3→4: 71% continue ⚠️ MAJOR DROP
- Step 4→5: 52% continue ⚠️ MAJOR DROP
- Step 5→6: 45% continue
- Step 6→7: 41% continue
- Step 7→8: 38% continue
- Step 8→9: 35% continue
- Step 9→10: 33% continue

### Key Insight:
Only 33% of users complete the full tutorial. 45% drop off between steps 3-5 (feature intros). Users are experiencing "feature fatigue" before reaching the actual product.

### Recommendation:
Reduce to 3 steps maximum. Show value immediately. Let users discover features organically.
```

---

#### Item 4 - NO EVIDENCE (Yellow/Assumption)
**Sticky Note:**
```
Users confused by navigation layout
```

---

#### Item 5 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Sign-up form has too many required fields
```

**Evidence Title:**
```
Airtable Survey - Signup Friction
```

**Evidence Source:** `airtable`
**Evidence Strength:** `high`

**Evidence Text:**
```
Survey Response ID: #4601
Respondent: Anonymous
Date: 2026-01-12

Q: Did you complete the signup process?
A: No

Q: Why did you stop?
A: You asked for my company name, job title, team size, industry, AND phone number just to try the app. I just wanted to see if it works for me first.

---

Survey Response ID: #4602
Respondent: Anonymous
Date: 2026-01-12

Q: Did you complete the signup process?
A: Yes, reluctantly

Q: What almost made you quit?
A: The phone number field. It said "required" but I don't want sales calls. I put a fake number.

---

Survey Response ID: #4603
Respondent: Anonymous
Date: 2026-01-13

Q: Did you complete the signup process?
A: No

Q: Why did you stop?
A: 8 fields to fill out? For a to-do app? I went to Todoist instead, they just asked for email.
```

---

#### Item 6 - NO EVIDENCE (Yellow/Assumption)
**Sticky Note:**
```
No clear progress indicator during setup
```

---

### Section: OPPORTUNITIES

---

#### Item 1 - NO EVIDENCE (Yellow/Assumption)
**Sticky Note:**
```
Progressive disclosure could reduce overwhelm
```

---

#### Item 2 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Users want to skip optional steps
```

**Evidence Title:**
```
Slack Feedback - Skip Button Requests
```

**Evidence Source:** `slack`
**Evidence Strength:** `medium`

**Evidence Text:**
```
#feature-requests | Paula T. | 10:15 AM
Can you PLEASE add a skip button to the onboarding? I've been using productivity apps for 10 years. I don't need a tutorial on what a "task" is. Just let me in!

    24 people reacted with :+1:

    James K. replied in thread:
    YES. I've onboarded to this app 3 times (work account, personal, client account) and had to sit through the same tutorial every single time.

    Paula T. replied in thread:
    @James K. exactly! Even a "I've done this before" option would be amazing

---

#feature-requests | Nina S. | 2:30 PM
Just signed up my team. Had to watch 5 people go through the same onboarding tutorial in our conference room. Everyone was asking "can we skip this?" No, you can't. Waste of 20 minutes of our kickoff meeting.
```

---

#### Item 3 - NO EVIDENCE (Yellow/Assumption)
**Sticky Note:**
```
Gamification could improve engagement
```

---

#### Item 4 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Social login would speed up signups
```

**Evidence Title:**
```
Airtable Survey - Login Preferences
```

**Evidence Source:** `airtable`
**Evidence Strength:** `medium`

**Evidence Text:**
```
Survey Question: How would you prefer to sign up for new apps?

Results (523 responses):
- Google Sign-in: 42% (220)
- Apple Sign-in: 28% (146)
- Email/Password: 18% (94)
- Microsoft Sign-in: 9% (47)
- Other: 3% (16)

---

Survey Response ID: #4701 (Open feedback)
"Every app I use has Google login except yours. I have to remember ANOTHER password now. Why?"

Survey Response ID: #4702 (Open feedback)
"Please add Sign in with Apple. I use it everywhere and it protects my real email."

Survey Response ID: #4703 (Open feedback)
"Had to do the whole email verification thing. Would have been 2 clicks with Google."
```

---

### Section: RISKS

---

#### Item 1 - NO EVIDENCE (Yellow/Assumption)
**Sticky Note:**
```
Existing users may resist UI changes
```

---

#### Item 2 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Must maintain backward compatibility
```

**Evidence Title:**
```
Notion Doc - Engineering Constraints
```

**Evidence Source:** `notion`
**Evidence Strength:** `high`

**Evidence Text:**
```
## Engineering Constraints for Q1 2026 Redesign
**Author:** Tech Lead
**Last Updated:** January 10, 2026

### API Compatibility Requirements:
- v2.x API has 12,847 active third-party integrations
- Breaking changes require 6-month deprecation notice (per SLA)
- Zapier integration used by 3,200+ customers
- Slack integration used by 8,100+ workspaces

### Database Constraints:
- User preferences table cannot be restructured (4.2M rows)
- Onboarding_completed flag must remain boolean (not nullable)
- Legacy account types must still be supported

### Timeline Risk:
Any changes to authentication flow require security review (2-3 weeks).
Changes to data storage require legal review for GDPR compliance (1-2 weeks).

### Recommendation:
Keep redesign focused on frontend/UX only. Backend changes should be Phase 2.
```

---

#### Item 3 - HAS EVIDENCE (Green)
**Sticky Note:**
```
Limited engineering capacity until Q2
```

**Evidence Title:**
```
Airtable - Resource Allocation Q1
```

**Evidence Source:** `airtable`
**Evidence Strength:** `high`

**Evidence Text:**
```
Team: Mobile Engineering
Quarter: Q1 2026

| Engineer | Allocation | Primary Project | Available for Onboarding |
|----------|------------|-----------------|--------------------------|
| Alex M.  | 100%       | API Migration   | No                       |
| Sam K.   | 100%       | Security Audit  | No                       |
| Jordan L.| 80%        | Bug Fixes       | 20% (1 day/week)         |
| Taylor R.| 60%        | Performance     | 40% (2 days/week)        |
| Morgan P.| 0%         | Parental Leave  | No                       |

Total Available Capacity for Onboarding Redesign: 3 days/week (0.6 FTE)

Note from Engineering Manager:
"We can support minor UI tweaks but a full onboarding redesign would need to wait until Q2 when the API migration completes. Recommend phased approach: quick wins in Q1, major changes in Q2."
```

---

## EVIDENCE BANK ITEMS (Add Separately)

These are standalone evidence items to add to the Evidence Bank for linking to sticky notes:

---

### Evidence 1 - HIGH Strength

**Title:**
```
Slack Thread - Onboarding Complaints Jan 2026
```
**Source:** `slack`
**Strength:** `high`
**Content:**
```
#customer-complaints | Thread: Onboarding Issues (47 replies)

Original post by Support Team:
We're collecting all onboarding feedback in this thread. Please share what you're hearing from customers.

Key complaints compiled:
1. "Too many steps" - mentioned 23 times
2. "Don't understand what app does" - mentioned 18 times
3. "Too many permissions" - mentioned 15 times
4. "Can't skip tutorial" - mentioned 12 times
5. "Form asks for too much info" - mentioned 9 times
6. "Slow loading during setup" - mentioned 7 times

Top quote from customer:
"I signed up for 3 different productivity apps today. Yours was the only one I gave up on. The others let me try the product in under a minute. Yours made me fill out forms and watch tutorials first."
```

---

### Evidence 2 - HIGH Strength

**Title:**
```
Notion Doc - User Research Synthesis Q4 2025
```
**Source:** `notion`
**Strength:** `high`
**Content:**
```
## User Research Synthesis
**Interviews Conducted:** 24 users
**Date Range:** Oct-Dec 2025

### Key Themes:

**Theme 1: First Impression Matters (20/24 users)**
Users form their opinion of the app within the first 60 seconds. If they don't understand the value immediately, they leave.

**Theme 2: Feature Overload (18/24 users)**
Users feel overwhelmed when shown all features at once. They want to start simple and discover features as needed.

**Theme 3: Trust & Privacy (15/24 users)**
Users are increasingly skeptical of permission requests. They want to know WHY before granting access.

**Theme 4: Time to Value (22/24 users)**
Users want to accomplish their first task within 2 minutes of signing up. Current average: 8+ minutes.

### Direct Quotes:
- "Show me the product, not a slideshow about the product"
- "I'll figure out the features as I go. Just let me start."
- "If I wanted a tour, I'd ask for one"
- "Every permission popup makes me trust you less"
```

---

### Evidence 3 - HIGH Strength

**Title:**
```
Airtable - NPS Survey Comments Jan 2026
```
**Source:** `airtable`
**Strength:** `high`
**Content:**
```
NPS Score Distribution (January 2026):
- Promoters (9-10): 34%
- Passives (7-8): 41%
- Detractors (0-6): 25%

NPS Score: +9

### Detractor Comments (Score 0-6):

Score: 3
"Great app once you figure it out. The problem is figuring it out. Took me 3 attempts to get through signup."

Score: 4
"Onboarding killed my enthusiasm. By the time I got to use the actual app, I was already annoyed."

Score: 5
"Love the features, hate the first experience. Almost quit during signup."

Score: 2
"Asked me to invite my team before I even knew what the app did. That's backwards."

Score: 6
"Solid product ruined by terrible onboarding. Fix that and I'd be a 9."

### Passives Moving to Detractor Risk:

Score: 7
"The app is good but the signup was frustrating. If a competitor comes along with easier onboarding, I might switch."
```

---

### Evidence 4 - MEDIUM Strength

**Title:**
```
Slack Thread - Customer Success Feedback
```
**Source:** `slack`
**Strength:** `medium`
**Content:**
```
#cs-team | Weekly Sync Notes

@CS Team - Here's what I'm hearing from enterprise customers this week:

1. Acme Corp (500 seats): "Our employees keep asking why they can't skip the tutorial. It's hurting adoption rates."

2. TechStart Inc (50 seats): "Three people gave up during signup and asked IT for help. That shouldn't happen."

3. Global Media (200 seats): "Can we get a 'lite' onboarding for users who just need basic features? Not everyone needs the full tour."

@Product - these are our biggest accounts. The onboarding friction is becoming a renewal risk.
```

---

### Evidence 5 - LOW Strength

**Title:**
```
Internal Team Brainstorm Notes
```
**Source:** `notion`
**Strength:** `low`
**Content:**
```
## Onboarding Improvement Brainstorm
**Date:** January 14, 2026
**Attendees:** Product, Design, Engineering

### Ideas Generated (not validated):
1. Skip tutorial button
2. Progress bar showing steps remaining
3. "Quick start" vs "Full tour" choice
4. Social login (Google, Apple)
5. Reduce required fields to just email
6. Just-in-time permissions (ask when needed, not upfront)
7. Interactive demo before signup
8. 30-second video instead of 10 slides
9. Personalized onboarding based on use case
10. "Show me around" button instead of forced tour

### Priority Vote Results:
1. Reduce required fields - 8 votes
2. Skip button - 7 votes
3. Just-in-time permissions - 6 votes
4. Social login - 5 votes
5. Progress bar - 3 votes

### Next Steps:
- Validate top 3 ideas with user research
- Check engineering feasibility
- Create mockups for review
```

---

## Test Execution Checklist

### Setup
- [ ] Create new user account
- [ ] Configure evidence sources in `/settings/insights-schedule`

### Evidence Bank
- [ ] Add evidence items with text content (not URLs)
- [ ] Test source filter (Slack, Notion, Airtable tabs)
- [ ] Verify strength badges display correctly

### Session Creation
- [ ] Create session using "Target Users" template
- [ ] Add objectives from this document
- [ ] Add constraints

### Sticky Notes
- [ ] Add sticky notes to each section
- [ ] Verify yellow styling for assumptions (no evidence)
- [ ] Link evidence to notes
- [ ] Verify green styling for evidence-backed notes
- [ ] Verify label badges show "ASSUMPTION" or "EVIDENCE"

---

*Last updated: 2026-01-21*
