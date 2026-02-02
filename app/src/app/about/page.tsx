import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation — matches landing page */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="font-bold text-lg text-slate-900">Discovery Board</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Features</Link>
              <Link href="/#how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">How It Works</Link>
              <Link href="/about" className="text-sm text-slate-900 font-medium">About</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors px-4 py-2">
              Log in
            </Link>
            <Link href="/signup" className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight tracking-tight">
            Stop building on<br />assumptions.
          </h1>
          <p className="mt-6 text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Most product decisions are made on gut feeling, scattered Slack messages, and whoever speaks loudest in the room.
            Then teams wonder why 70% of features miss the mark.
          </p>
          <p className="mt-4 text-lg text-slate-900 font-semibold">
            Discovery Board changes that.
          </p>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">The problem with product decisions today</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <ProblemCard
              problem="Evidence lives in 10 different tools"
              cost="You miss critical signals"
            />
            <ProblemCard
              problem="A loud opinion beats quiet data"
              cost="Wrong features get prioritized"
            />
            <ProblemCard
              problem="Old research drives new decisions"
              cost="You build for yesterday's user"
            />
            <ProblemCard
              problem="No one tracks if decisions were right"
              cost="Teams never improve"
            />
          </div>
          <p className="text-center mt-10 text-slate-600 text-lg">
            <span className="font-semibold text-slate-900">The result:</span> wasted roadmaps, frustrated users, and the same debates every sprint.
          </p>
        </div>
      </section>

      {/* What It Is */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">What Discovery Board is</h2>
          <p className="text-xl text-slate-500 max-w-3xl mx-auto leading-relaxed">
            An AI-powered decision system that turns scattered team signals into evidence-backed
            product decisions&mdash;with confidence scores you can actually defend.
          </p>

          {/* Framework diagram */}
          <div className="mt-14 bg-slate-50 rounded-2xl border border-slate-200 p-8 md:p-12 max-w-2xl mx-auto">
            <div className="grid grid-cols-3 gap-8 mb-8">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-900 text-sm">Problems</p>
                <p className="text-xs text-slate-500 mt-1">What users struggle with</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-900 text-sm">Evidence</p>
                <p className="text-xs text-slate-500 mt-1">Proof it&apos;s real</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-900 text-sm">Decisions</p>
                <p className="text-xs text-slate-500 mt-1">What you&apos;ll build</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-200">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <div className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                Strength Score
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <div className="mt-4 flex justify-center gap-6 text-sm">
              <span className="text-green-600 font-medium">Strong &rarr; Commit</span>
              <span className="text-yellow-600 font-medium">Moderate &rarr; Validate</span>
              <span className="text-red-600 font-medium">Weak &rarr; Park</span>
            </div>
          </div>
        </div>
      </section>

      {/* Example Walkthrough — Sarah's Story */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">See it in action</h2>
          <p className="text-center text-slate-500 mb-16 max-w-2xl mx-auto">
            Meet Sarah. She&apos;s a PM at FinWise, a mobile finance app with 50,000 users.
            Her team is deciding what to build next quarter.
          </p>

          {/* Before/After intro */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <p className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-3">Without Discovery Board</p>
              <p className="text-slate-700 text-sm leading-relaxed">
                Opinions fly. The CEO wants AI budgeting. Sales says users want crypto.
                Support keeps mentioning transaction search. Sarah picks based on gut feeling and politics.
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wider mb-3">With Discovery Board</p>
              <p className="text-slate-700 text-sm leading-relaxed">
                Sarah lets evidence decide. She creates a session, links evidence from existing tools,
                and gets clear recommendations backed by data.
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-12">
            {/* Step 1: Capture */}
            <WalkthroughStep
              step={1}
              title="Sarah captures the problems"
              description="She adds three problems her team has heard about: spending habit tracking, crypto tracking, and broken transaction search. All start at 0% — pure assumptions."
            >
              <div className="grid grid-cols-3 gap-3">
                <StoryNote title="Users can't track spending habits" strength={0} />
                <StoryNote title="Users want crypto tracking" strength={0} />
                <StoryNote title="Transaction search is broken" strength={0} />
              </div>
            </WalkthroughStep>

            {/* Step 2: Evidence */}
            <WalkthroughStep
              step={2}
              title="She links evidence from where it already lives"
              description="Support tickets, app reviews, user interviews, analytics, sales calls. No new tools needed — just connect what exists."
            >
              <div className="space-y-4 text-sm">
                <div className="bg-white border rounded-lg p-4">
                  <p className="font-semibold text-slate-800 mb-2">Spending habits &mdash; 4 sources</p>
                  <div className="space-y-1 text-slate-600">
                    <p>&bull; Support ticket: &ldquo;I wish I could see where my money goes each month&rdquo;</p>
                    <p>&bull; App review: &ldquo;Great app but no spending insights&rdquo;</p>
                    <p>&bull; User interview: &ldquo;I export to Excel just to see my patterns&rdquo;</p>
                    <p>&bull; Analytics: 68% check balance daily but never use categories</p>
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="font-semibold text-slate-800 mb-2">Crypto tracking &mdash; 2 sources</p>
                  <div className="space-y-1 text-slate-600">
                    <p>&bull; Sales call: &ldquo;One prospect asked about Bitcoin&rdquo;</p>
                    <p>&bull; Slack message: &ldquo;CEO saw competitor has crypto&rdquo;</p>
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="font-semibold text-slate-800 mb-2">Transaction search &mdash; 3 sources</p>
                  <div className="space-y-1 text-slate-600">
                    <p>&bull; Support tickets: 34 tickets this month about search</p>
                    <p>&bull; User interview: &ldquo;I literally cannot find transactions over $100&rdquo;</p>
                    <p>&bull; Analytics: Search abandonment rate is 73%</p>
                  </div>
                </div>
              </div>
            </WalkthroughStep>

            {/* Step 3: Strength */}
            <WalkthroughStep
              step={3}
              title="Evidence strength appears instantly"
              description="Discovery Board calculates how well-evidenced each problem is. No more 'I think' vs 'I think.'"
            >
              <div className="grid grid-cols-3 gap-3">
                <StoryNote title="Spending habit tracking" strength={67} band="strong" voice />
                <StoryNote title="Crypto tracking" strength={18} band="weak" />
                <StoryNote title="Transaction search broken" strength={84} band="strong" voice />
              </div>
              <p className="mt-4 text-sm text-slate-600 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                <span className="font-semibold text-yellow-800">Insight:</span> Crypto tracking looked urgent &mdash; the CEO mentioned it, sales brought it up.
                But evidence says otherwise: one prospect mention, zero support tickets, zero user interviews.
              </p>
            </WalkthroughStep>

            {/* Step 4: Analysis */}
            <WalkthroughStep
              step={4}
              title="AI analyzes the session"
              description="Sarah clicks 'Analyze.' Discovery Board ranks problems, checks constraints, and gives clear recommendations."
            >
              <div className="bg-slate-900 rounded-xl p-6 text-sm font-mono">
                <p className="text-slate-400 mb-4">SESSION ANALYSIS</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-green-400 shrink-0">1.</span>
                    <div>
                      <p className="text-white">Transaction search broken <span className="text-green-400">(84%)</span></p>
                      <p className="text-slate-400">Recommendation: <span className="text-green-400 font-semibold">COMMIT</span></p>
                      <p className="text-slate-500">34 support tickets. 73% abandonment. Direct user pain.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-green-400 shrink-0">2.</span>
                    <div>
                      <p className="text-white">Spending habits tracking <span className="text-yellow-400">(67%)</span></p>
                      <p className="text-slate-400">Recommendation: <span className="text-green-400 font-semibold">COMMIT</span></p>
                      <p className="text-slate-500">Strong user voice. Multiple sources confirm.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-red-400 shrink-0">3.</span>
                    <div>
                      <p className="text-white">Crypto tracking <span className="text-red-400">(18%)</span></p>
                      <p className="text-slate-400">Recommendation: <span className="text-slate-500 font-semibold">PARK</span></p>
                      <p className="text-slate-500">One sales mention + CEO preference. No user evidence.</p>
                      <p className="text-yellow-500 mt-1">Warning: This is an assumption, not validated demand.</p>
                    </div>
                  </div>
                </div>
              </div>
            </WalkthroughStep>

            {/* Step 5: Decide */}
            <WalkthroughStep
              step={5}
              title="Sarah commits the decision"
              description="She commits to fixing transaction search with a clear success metric, an owner, and a review date."
            >
              <div className="bg-white border-2 border-green-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <p className="font-semibold text-slate-900">Decision Record</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Decision</p>
                    <p className="font-medium text-slate-900">Fix transaction search</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Evidence Strength</p>
                    <p className="font-medium text-green-600">84%</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Success Metric</p>
                    <p className="font-medium text-slate-900">Search abandonment &lt; 30%</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Review Date</p>
                    <p className="font-medium text-slate-900">March 15</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500">Evidence: 34 support tickets, 73% search abandonment, direct user quote</p>
                </div>
              </div>
            </WalkthroughStep>

            {/* Step 6: Share */}
            <WalkthroughStep
              step={6}
              title="She shares a stakeholder brief"
              description="One click generates a defensible brief. Sarah shares it with the CEO. No debate. The evidence speaks."
            >
              <div className="bg-white border rounded-xl p-6 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Executive Decision Brief</p>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-slate-500">Decision</p>
                    <p className="font-semibold text-slate-900">Fix transaction search functionality</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Problem</p>
                    <p className="text-slate-700">Users cannot find past transactions. 73% abandon search. 34 support tickets this month.</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Evidence Strength</p>
                    <p className="text-green-600 font-semibold">84% (Strong) &mdash; Support, Analytics, User Interview</p>
                  </div>
                  <div>
                    <p className="text-slate-500">What we&apos;re not doing</p>
                    <p className="text-slate-700">Crypto tracking (18% evidence &mdash; unvalidated assumption)</p>
                  </div>
                </div>
              </div>
            </WalkthroughStep>
          </div>
        </div>
      </section>

      {/* What Makes It Different */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">What makes it different</h2>
          <div className="grid md:grid-cols-2 gap-px bg-slate-200 rounded-xl overflow-hidden">
            <ComparisonRow label="Others" value="Store feedback" isHeader />
            <ComparisonRow label="Discovery Board" value="Score evidence strength" isHeader isHighlight />
            <ComparisonRow label="Others" value="Organize insights" />
            <ComparisonRow label="Discovery Board" value="Detect contradictions" isHighlight />
            <ComparisonRow label="Others" value="Generate reports" />
            <ComparisonRow label="Discovery Board" value="Generate defensible decisions" isHighlight />
            <ComparisonRow label="Others" value="Hope you were right" />
            <ComparisonRow label="Discovery Board" value="Track and prove outcomes" isHighlight />
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Core capabilities</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <CapabilityCard
              title="Evidence Strength Scoring"
              description="Not all signals are equal. Direct user voice beats internal opinion. Fresh data beats stale research. Discovery Board weights it automatically."
            />
            <CapabilityCard
              title="Contradiction Detection"
              description="When evidence conflicts, you should know. AI flags when signals point different directions so you investigate before committing."
            />
            <CapabilityCard
              title="Decision Audit Trail"
              description="Every decision captures: what evidence supported it, who made it, what you expected. No more 'why did we build this?'"
            />
            <CapabilityCard
              title="Outcome Calibration"
              description="After you ship, log what happened. Over time, see which evidence sources actually predict success and which mislead."
            />
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-12">Who it&apos;s for</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Product Managers</h3>
              <p className="text-sm text-slate-500">Tired of defending decisions with &ldquo;I talked to some users.&rdquo;</p>
            </div>
            <div className="p-6">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Product Leaders</h3>
              <p className="text-sm text-slate-500">Want visibility into what&apos;s validated vs assumed across the portfolio.</p>
            </div>
            <div className="p-6">
              <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Product Teams</h3>
              <p className="text-sm text-slate-500">Waste time re-debating settled questions every sprint.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Outcome table */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">The outcome</h2>
          <div className="space-y-4">
            <OutcomeRow
              before="&ldquo;I think users want this&rdquo;"
              after="&ldquo;72% evidence strength across 4 sources&rdquo;"
            />
            <OutcomeRow
              before="Loudest voice wins"
              after="Strongest evidence wins"
            />
            <OutcomeRow
              before="Rehash decisions monthly"
              after="Decisions stick with audit trail"
            />
            <OutcomeRow
              before="No idea if you were right"
              after="Track and calibrate over time"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to decide with confidence?
          </h2>
          <p className="text-slate-400 mb-4 text-lg">
            Know what to build, why, and whether you were right.
          </p>
          <p className="text-slate-500 mb-10">
            Stop building on assumptions. Start building on evidence.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-slate-900 px-8 py-3.5 rounded-lg text-base font-medium hover:bg-slate-100 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-sm text-slate-500">Product Discovery Board</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/#features" className="hover:text-slate-900 transition-colors">Features</Link>
            <Link href="/about" className="hover:text-slate-900 transition-colors">About</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ============================================
// Sub-components
// ============================================

function ProblemCard({ problem, cost }: { problem: string; cost: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-red-100 text-red-500 flex items-center justify-center shrink-0 mt-0.5">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <p className="font-medium text-slate-900">{problem}</p>
        <p className="text-sm text-slate-500 mt-1">{cost}</p>
      </div>
    </div>
  )
}

function WalkthroughStep({ step, title, description, children }: {
  step: number
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-6">
      <div className="shrink-0">
        <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
          {step}
        </div>
        <div className="w-px h-full bg-slate-300 mx-auto mt-2 hidden md:block"></div>
      </div>
      <div className="flex-1 pb-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-4">{description}</p>
        {children}
      </div>
    </div>
  )
}

function StoryNote({ title, strength, band, voice }: {
  title: string
  strength: number
  band?: string
  voice?: boolean
}) {
  const borderColor = band === 'strong' ? 'border-green-300 bg-green-50' :
    band === 'weak' ? 'border-red-200 bg-red-50' :
    strength === 0 ? 'border-slate-200 bg-slate-50' : 'border-yellow-200 bg-yellow-50'
  const badgeColor = band === 'strong' ? 'bg-green-600' :
    band === 'weak' ? 'bg-red-500' :
    strength === 0 ? 'bg-slate-400' : 'bg-yellow-500'

  return (
    <div className={`border rounded-lg p-3 ${borderColor} relative`}>
      <span className={`absolute -top-2 right-2 text-[10px] text-white px-2 py-0.5 rounded-full font-semibold ${badgeColor}`}>
        {strength}%
      </span>
      <p className="text-xs font-medium text-slate-800 mt-1 line-clamp-2">{title}</p>
      <div className="flex items-center gap-1 mt-2">
        {voice && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">Voice</span>}
        {strength === 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">No proof</span>}
      </div>
    </div>
  )
}

function ComparisonRow({ label, value, isHeader, isHighlight }: {
  label: string
  value: string
  isHeader?: boolean
  isHighlight?: boolean
}) {
  return (
    <div className={`p-4 ${isHighlight ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>
      <p className={`text-xs uppercase tracking-wider mb-1 ${isHighlight ? 'text-slate-400' : 'text-slate-400'} ${isHeader ? 'font-semibold' : ''}`}>
        {label}
      </p>
      <p className={`font-medium ${isHighlight ? 'text-white' : 'text-slate-700'}`}>{value}</p>
    </div>
  )
}

function CapabilityCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-300 transition-colors">
      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  )
}

function OutcomeRow({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid md:grid-cols-2 gap-px bg-slate-200 rounded-lg overflow-hidden">
      <div className="bg-white p-4">
        <p className="text-xs text-red-500 font-semibold uppercase tracking-wider mb-1">Before</p>
        <p className="text-slate-700 text-sm" dangerouslySetInnerHTML={{ __html: before }} />
      </div>
      <div className="bg-green-50 p-4">
        <p className="text-xs text-green-600 font-semibold uppercase tracking-wider mb-1">After</p>
        <p className="text-slate-900 font-medium text-sm" dangerouslySetInnerHTML={{ __html: after }} />
      </div>
    </div>
  )
}
