import Link from 'next/link'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
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
              <a href="#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">How It Works</a>
              <Link href="/about" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">About</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors px-4 py-2"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight tracking-tight">
            Make product decisions<br />you can defend.
          </h1>
          <p className="mt-6 text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Most PM tools organize information. They don&apos;t help you decide.
            Discovery Board turns scattered research into confident, evidence-backed product decisions.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="bg-slate-900 text-white px-8 py-3.5 rounded-lg text-base font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
            >
              Start a discovery session
            </Link>
            <a
              href="#how-it-works"
              className="text-slate-600 px-6 py-3.5 rounded-lg text-base font-medium hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              See how it works &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Product Mockup */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
            <div className="bg-slate-800 px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-slate-400">Discovery Board - Session Canvas</span>
              </div>
            </div>
            <div className="p-8">
              {/* Simplified canvas mockup */}
              <div className="flex gap-4">
                {/* Sidebar mock */}
                <div className="w-10 bg-slate-800 rounded-lg flex flex-col items-center py-3 gap-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-6 h-6 rounded bg-slate-700"></div>
                  ))}
                </div>
                {/* Canvas mock */}
                <div className="flex-1 space-y-4">
                  {/* Context bar mock */}
                  <div className="flex gap-2">
                    <div className="bg-amber-50 border border-amber-200 rounded px-3 py-1 text-xs text-amber-700">Objectives (3)</div>
                    <div className="bg-blue-50 border border-blue-200 rounded px-3 py-1 text-xs text-blue-700">Checklist 2/4</div>
                    <div className="bg-purple-50 border border-purple-200 rounded px-3 py-1 text-xs text-purple-700">Constraints (2)</div>
                  </div>
                  {/* Sections mock */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Problems section */}
                    <div className="bg-white border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        <span className="text-xs font-semibold text-slate-600">Problems</span>
                      </div>
                      <div className="space-y-2">
                        <MockNote strength={82} color="green" />
                        <MockNote strength={45} color="yellow" />
                        <MockNote color="gray" />
                      </div>
                    </div>
                    {/* Evidence section */}
                    <div className="bg-white border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        <span className="text-xs font-semibold text-slate-600">Evidence</span>
                      </div>
                      <div className="space-y-2">
                        <MockNote strength={91} color="green" />
                        <MockNote strength={67} color="yellow" />
                      </div>
                    </div>
                    {/* Decisions section */}
                    <div className="bg-white border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        <span className="text-xs font-semibold text-slate-600">Decisions</span>
                      </div>
                      <div className="space-y-2">
                        <MockNote strength={78} color="green" />
                        <MockNote color="gray" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">
            From scattered research to confident decisions
          </h2>
          <p className="text-center text-slate-500 mb-16 max-w-2xl mx-auto">
            Four steps to decisions you can defend in any stakeholder meeting.
          </p>

          <div className="grid md:grid-cols-4 gap-8">
            <FeatureCard
              step={1}
              title="Add Problems"
              description="Drop problems, pain points, and observations onto the canvas as sticky notes."
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <FeatureCard
              step={2}
              title="Link Evidence"
              description="Attach research from Slack, Notion, surveys, and analytics. Each piece gets a strength score."
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              }
            />
            <FeatureCard
              step={3}
              title="Analyze"
              description="AI agents score evidence, detect contradictions, identify gaps, and rank problems by strength."
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
            <FeatureCard
              step={4}
              title="Decide"
              description="Commit the strongest problems to decisions with success metrics, owners, and review dates."
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* Features Detail */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-16">
            Built for product discovery
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <DetailCard
              title="Evidence Strength Scoring"
              description="Every piece of evidence gets a computed strength score based on source quality, recency, segment diversity, and corroboration."
            />
            <DetailCard
              title="7 AI Agents"
              description="Contradiction detection, segment identification, voice analysis, gap detection, and session analysis run automatically."
            />
            <DetailCard
              title="Discovery Briefs"
              description="Generate stakeholder-ready briefs with ranked problems, evidence summaries, and clear recommendations."
            />
            <DetailCard
              title="Evidence Bank"
              description="Centralized repository for all research artifacts. Link evidence to multiple problems across sessions."
            />
            <DetailCard
              title="Smart Canvas"
              description="Visual workspace with sections, sticky notes, drag-and-drop, zoom, and real-time strength indicators."
            />
            <DetailCard
              title="Decision Tracking"
              description="Commit validated problems to decisions with success metrics, owners, and scheduled review dates."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Stop guessing. Start deciding.
          </h2>
          <p className="text-slate-400 mb-10 text-lg">
            Turn your research into defensible product decisions.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-slate-900 px-8 py-3.5 rounded-lg text-base font-medium hover:bg-slate-100 transition-colors"
          >
            Start your first session
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
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <Link href="/about" className="hover:text-slate-900 transition-colors">About</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function MockNote({ strength, color = 'gray' }: { strength?: number; color?: string }) {
  const borderColor = color === 'green' ? 'border-green-300 bg-green-50' :
    color === 'yellow' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-gray-50'
  const badgeColor = color === 'green' ? 'bg-green-500' :
    color === 'yellow' ? 'bg-yellow-500' : 'bg-gray-400'

  return (
    <div className={`border rounded p-2 ${borderColor} relative`}>
      {strength && (
        <span className={`absolute -top-1.5 right-2 text-[9px] text-white px-1.5 rounded ${badgeColor}`}>
          {strength}%
        </span>
      )}
      <div className="h-2 bg-slate-200/50 rounded w-full mb-1"></div>
      <div className="h-2 bg-slate-200/50 rounded w-3/4"></div>
    </div>
  )
}

function FeatureCard({ step, title, description, icon }: {
  step: number
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Step {step}</div>
      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  )
}

function DetailCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  )
}
