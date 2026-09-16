# OpenStation marketing strategy: turning the installs curve around

**Date:** September 16, 2026
**North Star:** active installs on wordpress.org (`desktop-mode`)
**Input framework:** "Building the Enterprise AI Stack: A Framework for Marketing Leaders" (WordPress VIP + Americaneagle.com), applied to how we market OpenStation, and to who we market it to.
**Companion docs:** [wpvibe-growth-analysis.md](../competitive/wpvibe-growth-analysis.md), [wpvibe-code-comparison.md](../competitive/wpvibe-code-comparison.md)

## TL;DR

Active installs peaked near 2,700 in mid July and sit at roughly 2,050 today, losing about 75 sites a week. The decline is not a downloads problem. Weekly downloads have been flat at 1,700 to 2,900 for two months, but 30 releases in four months means nearly all of that is update traffic. New-install acquisition is close to zero, and the launch cohort from May is churning out faster than anything replaces it.

The guide's lens (Generate, Compose, Customize) diagnoses our marketing the same way it diagnoses an enterprise AI stack: we are stuck in Generate. We produce a lot (two releases a week, a blog post every three days, a brand system) with no connected pipeline from release to audience to install, no measurement of what converts, and no customization where differentiation actually lives (the demo, first-run, the enterprise story).

The strategy has three bets, in priority order:

1. **Stop the bleed** with a retention loop we can measure: first-run activation, a deactivation feedback dialog, support hygiene, and a compatibility push. Target: net-flat by end of October.
2. **Turn Automattic's own distribution on.** WordPress.com, WordPress VIP, Jetpack, WooCommerce, Studio and Playground are channels we own and are not using. This is the one lever with the scale to move the number by thousands, not dozens.
3. **Reposition for the market that is buying.** Keep the workspace as the visible hook, but lead the enterprise and press story with the governed AI workbench (Copilot, agents with allowlists, Abilities API, no relay, no keys). That is exactly the "AI-ready platform layer" the guide sells, and today it is hidden from the listing.

Proposed targets: hold 2,000+ through October, 3,000 by end of December, 5,000 by end of Q1 2027. These are commitments to the levers below, not forecasts.

## 1. Where we are

### The numbers (September 16, 2026)

| Metric | Value | Source |
|---|---|---|
| Active installs (wp.org bucket) | 2,000+ | wp.org API |
| Estimated active installs | 2,048, down 16% in 30 days, about 75 sites/week lost | wp-rankings |
| Peak estimate | about 2,700 (July 7 to July 22) | wp-rankings chart |
| All-time downloads | 44,402 | wp.org API |
| Downloads, median per day, last 30 days | 173 (186 the 30 days before) | wp.org stats API |
| Weekly downloads, last 8 weeks | 1,500 to 2,900, flat | wp.org stats API |
| Releases in the last 365 days | 30 (plugin added May 7, 2026) | wp.org |
| Rating | 5.0 on 23 reviews (22 five-star, 1 four-star) | wp.org API |
| Support threads | 1 open, 0 resolved, listing shows "0% resolved" | wp.org API |
| GitHub | 268 stars, 41 forks, 50 open issues | GitHub API |
| wp.org tags | admin, AI, dashboard, desktop, productivity | readme.txt |
| Blog cadence | a post every 2 to 4 days, RSS only, no newsletter | openstation.blog |
| Earned coverage found | happas.jp (Japanese review); no WP Tavern, WPBeginner, SEJ or YouTube review surfaced in search | web search |

### How to read the chart

- **The May cohort is the whole install base.** Week of May 20 to 26 did 4,615 downloads with 1,238 on May 21. That was the hackathon and launch buzz. Nothing since has come close.
- **Downloads are updates.** With 2,000 sites and a release roughly every 4 days, every release generates about 2,000 update downloads over the following week. Weekly totals of 1,700 to 2,900 are consistent with an install base updating, plus a trickle of new installs. The quiet week of June 24 to 30 (no release) did 404 downloads, about 58 a day, and that is the ceiling of our organic acquisition.
- **The two spikes on the wp-rankings chart (Aug 27, Sep 3) are artifacts**, not growth. They line up with the 1.1.4/1.1.5 and 1.1.6 releases. wp-rankings estimates installs partly from download velocity, so a release day reads as a jump and then corrects.
- **Net loss of 75 a week with gross adds under 60 a day** means deactivations run somewhere between 300 and 500 a week. That is the number to attack first. It is also the number we cannot see today, because nothing in the product or the pipeline records why a site leaves.
- **Caveat on downloads.** Playground launches from the openstation.me demo may count as wp.org downloads. If they do, organic acquisition is lower than the quiet-week number suggests. Measuring demo launches separately (section 7) resolves this.

### Why the cohort churns (hypotheses to test, not conclusions)

1. **Curiosity installs.** "Automattic built a desktop for wp-admin in a hackathon" is a try-it story, not a keep-it story. Sites installed to look, looked, and removed.
2. **Per-user opt-in hides the value.** The plugin does nothing until a user clicks the admin-bar toggle. Site owners who installed for their team may never have seen it turn on anywhere.
3. **Compatibility friction.** Windows over plugin admin pages break in ways the compat layer has not seen yet. Each break is a reason to deactivate and, at 0% support resolution, a reason not to come back.
4. **No re-engagement.** Two releases a week ship real improvements, but the only channel to an installed site is the changelog, which is written for engineers ("fix preserved table rendering").
5. **The AI story is invisible.** The market pulled 6,000 installs to WPVibe in ten weeks on "AI manages your site". Our listing leads with windows and buries agents in screenshot 4.

## 2. What the guide says, and what it means for us

The guide is aimed at enterprise marketing leaders assembling AI tooling. Its framework transfers directly to a small team marketing an open-source product, and its audience is also one of our best-fit customers.

### The three modes, applied to our marketing

| Mode | Guide's definition | What it looks like at OpenStation today | What "good" looks like |
|---|---|---|---|
| **Generate** | Out-of-the-box AI creating content fast; easy early wins; fragments at the workflow level | High output: 30 releases, 10 blog posts in a month, a brand system. Inconsistent framing: readme says "wp-admin forgets", site says "One tab", changelog says "fix dock overlap". No shared brand voice file, no reuse. | One voice file and one prompt library. Every release produces one story, told once, reused everywhere. Measured on downstream installs, not on volume. |
| **Compose** | Connecting systems so AI flows across workflows; where most strategies break; pick a few integrations, own them | Nothing is connected. Release, blog, listing, social and metrics are separate manual steps. No funnel dashboard. Support forum and GitHub issues are disconnected. | Three integrations, owned: release to content, metrics to a weekly review, support to triage. API-first, modular, nothing else. |
| **Customize** | Tailored capability on proprietary data; where differentiation happens; the mistake is avoiding it | Our proprietary assets are the demo, the install base, and Automattic's channels. None is instrumented or worked. | The Playground demo as a guided product tour; first-run and deactivation loops feeding the roadmap; a WordPress.com and VIP go-to-market only we can run. |

### The guide's five questions, answered for our marketing stack

1. **Where are we using AI across content and marketing workflows?** Ad hoc, per person, for drafting. No shared prompts, no guardrails, no measurement.
2. **Which workflows create the most friction?** Release to audience. Two releases a week and no repeatable way to turn them into a story, a listing update, a social post and a re-engagement touch. Second: knowing whether anything worked.
3. **Where is out-of-the-box enough, and where does customization differentiate?** Drafting, translation, captioning and changelog rewriting are Generate work and fine as-is with a voice file. The demo, onboarding, and the enterprise narrative are Customize work and nobody else can do them for us.
4. **Do we have governance and ownership?** No named owner for the North Star, no weekly review, no definition of "new install" versus "update".
5. **What manual work or duplicated effort still exists?** Every release note is rewritten by hand at least twice (changelog, blog). Metrics are checked by visiting wp-rankings.

### The guide is also a channel map

WordPress VIP publishes this guide to sell governed, composable, AI-ready platforms to enterprise marketing teams. Read the "What to look for in an AI-ready platform layer" page against OpenStation:

| Guide's criterion | OpenStation already has |
|---|---|
| Governance and control: role-based access, audit trails, approvals | Copilot is read-only by design; agents are real WP users with a capability ceiling and per-agent ability allowlists; destructive actions go through a confirm dialog |
| Workflow consistency | Spaces (one desktop per job), workspaces, shared presence, saved layouts |
| Composable integration, API-first | Abilities API for every AI tool; documented `openstation_register_*` PHP and typed JS APIs; no SaaS relay, no API keys in the plugin |
| Operational resilience | Windows open in 3 ms (measured); "the desktop pays for itself by the third screen" |
| Content readiness | Corkboard content graph; Copilot search over the site's own content |

We are the admin layer of the exact platform story VIP is selling, and VIP is an Automattic company. Section 4 turns this into a play.

## 3. The model: installs = acquisition minus churn

Active installs is a stock. The flows are new installs, deactivations, and deletions. Every play below is tagged with the flow it moves and a rough expected magnitude. Three rules:

- **Retention first.** At the current rate, every 100 new installs a week only buys 25 net. Fixing churn multiplies every acquisition play.
- **Owned distribution before earned.** Automattic's channels reach millions of WordPress sites. A single WordPress.com placement outweighs a year of blog posts.
- **One message, told in two registers.** The workspace is the visual hook for creators and agencies. Governed AI is the reason enterprise teams and the press pay attention. Same product, same demo, different first sentence.

## 4. Positioning

**Current:** "wp-admin forgets. OpenStation doesn't." (listing) and "One tab. Your whole WordPress site." (site). Both are true, both are productivity claims, and neither says why a site should install it this quarter.

**Proposed umbrella:** *The workspace where humans and AI run a WordPress site together. Built by Automattic, open source, nothing leaves your server.*

Two registers:

- **Creator / agency register (listing, site, video):** "Open posts, media and settings side by side. Ask the assistant to find anything. Give an agent a job and watch it work, on your desktop, under your rules." Lead visual: a desk with an editor, the Media Library and an agent's activity window open at once.
- **Enterprise / press register (VIP, WP Tavern, SEJ):** "WPVibe puts your site inside someone else's AI client through a closed relay. OpenStation puts governed AI inside your admin: read-only Copilot, agents that are WordPress users with a capability ceiling, every tool an Ability you can audit, and no API keys or metering. Open source, GPL, by Automattic."

Concrete changes this implies:

1. **Listing title and tags.** Keep "OpenStation" first. Add the AI surface to the title and tags: `ai-agents`, `ai-assistant`, `command-palette`, `chatgpt`, `claude`. wp.org search weights title, tags, freshness, installs and support resolution. Today a search for "AI agent" cannot find us.
2. **Screenshot order.** Screenshot 4 (agents) and 3 (Cmd+K) move to positions 2 and 3. The listing video gets re-cut to show one agent job end to end within the first 30 seconds.
3. **Readme structure.** First paragraph stays human and specific (it is good). Second paragraph is the AI paragraph, with the governance sentence. "For developers" gains one line on Abilities and MCP-readiness.
4. **Site headline** matches the umbrella. The stats block on openstation.me still says "v1.0.0"; fix it and drive it from the wp.org API.

## 5. Acquisition plays, ranked

Effort is team-weeks. Impact is a judgment on net installs per quarter once running.

### Tier 1: owned Automattic distribution (Customize)

| Play | What it is | Effort | Impact |
|---|---|---|---|
| **WordPress.com placement** | Get OpenStation into the WordPress.com plugin marketplace with a featured slot, and into the one-click recommendations for Business and Commerce plans. It already runs on WordPress.com (the wpcomsh work proves it). Ask for a "Try the new admin" banner in Calypso for eligible sites. | 2 (mostly relationship and QA) | Thousands. The only play at this scale. |
| **WordPress VIP co-marketing** | Pitch VIP's content team a follow-on to this very guide: "The AI-ready admin layer: governed agents inside WordPress." Offer a joint webinar and a case study with a VIP editorial customer running Spaces and agents. Get OpenStation onto VIP's recommended-plugins list. | 3 | Tens of large multi-user sites, plus the enterprise narrative for press. |
| **Studio preset and Playground blueprint** | A "WordPress with OpenStation" starter in Studio (Automattic's local app) and a listed blueprint in the Playground gallery with sample content, three open windows and an agent pre-configured. Every developer who tries it locally is a future install on a client site. | 1 | Hundreds, compounding through agencies. |
| **Jetpack and WooCommerce channels** | A WooCommerce blog post on the store desk (orders, products, coupons as folders, customer lifetime spend in a window). A Jetpack newsletter mention. Both audiences are exactly the multi-screen admin user. | 1 | Hundreds. |

### Tier 2: listing and search (Generate, with guardrails)

| Play | What it is | Effort | Impact |
|---|---|---|---|
| **Listing rewrite** | Title, tags, screenshots, video and readme per section 4. | 0.5 | Hundreds over a quarter; raises the conversion rate of every other play. |
| **Support hygiene** | Answer every wp.org thread within 48 hours and mark resolved. The listing's "0% resolved" is visible to every prospect. Route threads to GitHub issues (section 7). | Ongoing, 2 hours/week | Trust signal; also the cheapest churn fix. |
| **Review velocity** | Ask for a review in the product after a user's 5th session, once, with a link. 23 reviews at 5.0 is great and small. 100 reviews changes search rank and social proof. | 0.5 | Rank lift; indirect. |
| **Search content** | Five evergreen pages on openstation.me targeting the queries people actually type: "wordpress admin multiple windows", "wordpress command palette", "wordpress ai agent plugin", "wordpress admin dashboard customization", "connect claude to wordpress". Each ends in the Playground demo. | 1 | Slow, durable. |

### Tier 3: earned media and community (Compose)

| Play | What it is | Effort | Impact |
|---|---|---|---|
| **Press pitch, enterprise register** | WP Tavern, Search Engine Journal, WPBeginner news, Post Status. Angle: "Automattic's open answer to AI site management: governed, self-hosted, no relay." Provide the WPVibe comparison table from the code-comparison doc. Time it to a release that ships something concrete (MCP transport is the ideal hook). | 1 | The WPVibe playbook got 6,000 installs on one SEJ piece plus owned media. Ours is smaller without Awesome Motive's properties, but non-zero. |
| **YouTube** | Send a ready-made demo site and a 90-second script to WPTuts, WPCrafter, Jamie Marsland and two Spanish-language channels. Video converts this product better than text; it is visual. | 1 | Hundreds per video that lands. |
| **International** | happas.jp already covered it unprompted. WPMarmite (FR), WP Tavern's Spanish equivalents, note.com (JP). Roberto can write the Spanish pieces directly. | 0.5 | Tens to hundreds. |
| **WordCamp and Make** | A talk at the next WordCamp on "agents as WordPress users", a Make/Core post on how OpenStation consumes the Abilities API, a Playground demo link in both. | 1 | Developer mindshare; feeds agencies. |
| **AI-client directories** | Once the MCP transport ships (the competitive doc calls it "the missing 10%"), list in the Claude connectors and ChatGPT apps directories and mcpservers.org. This is distribution outside wordpress.org entirely, and it is where WPVibe's curve came from. | Engineering: 2 to 4; marketing: 0.5 | Potentially the second-largest lever after WordPress.com. |

### Tier 4: product-led (Customize)

| Play | What it is | Effort | Impact |
|---|---|---|---|
| **"Invite your team"** | After a user enables OpenStation, offer to email the other users on the site a one-line invitation with the toggle link. Per-user opt-in is our retention risk; this turns it into spread. | 1 | Raises activation per installed site; indirect but strong for churn. |
| **Shareable artifacts** | A gallery on openstation.me for desktop themes, wallpapers and workspaces, uploadable from the product. Every share is a landing page. | 2 | Slow, community-building. |
| **Multisite network story** | 1.1.8 shipped the network switcher. Agencies run multisite. One post, one video, one WP Tavern pitch. | 0.5 | Tens of networks, each many sites. |

## 6. Retention plays (do these first)

| Play | What it is | Why |
|---|---|---|
| **Deactivation feedback dialog** | On deactivate, an optional one-question dialog: broke something / too slow / didn't understand it / not for me / other, with a free-text box. Anonymous, opt-in, common on wp.org. Results land in a table we read weekly. | We cannot fix churn we cannot see. This is the single most important instrument in the plan. |
| **First-run activation** | Site admin installs, activates, and nothing changes. Add a one-time admin notice with the toggle and a 20-second in-product tour on first enable: open a window, snap it, hit Cmd+K. Measure "enabled by at least one user within 7 days of install". | Hypothesis 2 in section 1. An install nobody turned on gets deleted at the next plugin cleanup. |
| **What's New that speaks human** | We ship twice a week. The changelog is commit language. A "What's new" dialog on first load after an update, three lines, one screenshot, written in the voice file. | Re-engagement for the installed base; converts the release cadence from noise into a reason to keep the plugin. |
| **Compatibility program** | Pick the 20 most-installed admin-heavy plugins (Yoast, Elementor, WPForms, ACF, WooCommerce, Rank Math, MonsterInsights, etc.). Test each in a window. Fix or document. Publish a compatibility page. | Hypothesis 3. Each incompatibility is a deactivation and a one-star risk. |
| **Support SLA** | 48-hour first response, thread marked resolved, GitHub issue opened when it is a bug. Owner named. | The listing's 0% resolved is both a churn cause and an acquisition drag. |
| **Performance as a promise** | The "3 ms" and "pays for itself by the third screen" posts are exactly right. Put the numbers in the listing and the first-run tour. | Speed is the objection people expect from a windowed admin. Pre-empt it. |

## 7. The marketing AI stack (the guide, applied literally)

The guide's core advice is: audit Generate, connect a few things in Compose, customize only where it differentiates, and name owners. Here is that stack for a team of two or three.

### Generate: one voice, reusable

- **A voice file** in the warehouse repo (`marketing/voice.md`): the umbrella message, the two registers, banned words, three example paragraphs from the readme that already sound right. Every AI-assisted draft starts from it.
- **A prompt library** for the recurring jobs: PR list to human changelog; changelog to three-line "What's new"; release to blog draft; blog to social snippets (X, Mastodon, LinkedIn, wp.org Slack); English to Spanish, French, Japanese for the international pitches; screenshot captions; support-thread first reply.
- **Approval stays human.** Roberto approves anything public. The guide's warning about brand drift is real; our readme voice is an asset.
- **Measure downstream, not volume.** A post counts if it produced demo launches or installs (section 8), not because it shipped.

### Compose: three integrations, owned

1. **Release to content.** A GitHub Action on tag: collect merged PR titles since the last tag, draft the human changelog and the What's-new lines with the voice file, open a draft post on openstation.blog through the WP REST API, and open a Linear task for Roberto to review and publish. Nothing publishes automatically.
2. **Metrics to review.** A daily script (a Cloudflare Worker cron or a GitHub Action) pulls the wp.org info and download stats APIs, the GitHub stars, the wp-rankings estimate, the openstation.me and demo counters, and the deactivation-feedback table, into one sheet or a tiny dashboard. A weekly Slack post with the North Star and the leading indicators. This replaces visiting wp-rankings.
3. **Support to triage.** A daily check of the wp.org support forum that opens a Linear issue per new thread with the reply draft attached. First reply within 48 hours becomes mechanical.

Do not connect anything else this quarter. The guide's failure mode ("integrations multiply, ownership doesn't") is real at any team size.

### Customize: where only we can win

- **The Playground demo as a guided tour.** A blueprint with a real-looking site (posts, media, comments, a small store), three windows pre-arranged, a Space per job, an agent with one visible completed run, and a five-step overlay. Instrument launches and step completion. This is the product's best salesperson and it is currently a blank sandbox.
- **The retention loop.** Deactivation reasons and first-run activation feed the roadmap directly: a monthly "why sites leave" review that picks one fix per month.
- **The Automattic go-to-market.** Nobody else can put OpenStation on WordPress.com, in Studio, or in a VIP guide. This is the customization that differentiates, in the guide's exact sense.

### Ownership

| Area | Owner |
|---|---|
| North Star and weekly review | Daniel (project lead) |
| Content, voice, blog, international | Roberto |
| Listing, support SLA, compatibility | one named engineer, rotating monthly |
| WordPress.com, VIP, Studio relationships | Daniel, with an Automattic sponsor from each product |
| Metrics pipeline and release automation | one engineer, two weeks, then maintenance |

## 8. Measurement

**North Star:** estimated active installs, tracked daily from the wp.org bucket plus wp-rankings, and from our own estimate: downloads on days with no release in the previous 7 days, times 7, minus deactivation-dialog count. Report as a 7-day rolling net change.

**Leading indicators, weekly:**

| Indicator | Why it leads |
|---|---|
| New installs (quiet-day downloads estimate) | Acquisition, cleaned of update noise |
| Deactivation dialog submissions and reasons | Churn, and why |
| Sites with at least one enabled user within 7 days of install | Activation |
| Playground demo launches and tour completions | Top of funnel that we control |
| openstation.me visits by referrer | Which channel is working |
| wp.org reviews (count) and support threads resolved (%) | Listing trust signals |
| GitHub stars, forks | Developer channel |

**Lagging, monthly:** press placements, YouTube views on partner videos, WordPress.com and VIP milestones.

## 9. Ninety-day plan

**Weeks 1 to 2 (by September 30): instrument and stop the obvious leaks**

- Deactivation feedback dialog, first-run notice and tour, What's-new dialog in the voice file. Ship in 1.2.0.
- Listing rewrite: title, tags, screenshot order, readme AI paragraph, site stats fixed.
- Answer and resolve the open support thread. Set the 48-hour SLA and the rotating owner.
- Metrics pipeline v1: daily pull to a sheet, weekly Slack post.
- Voice file and prompt library in the warehouse repo.

**Weeks 3 to 6 (October): owned distribution and the demo**

- WordPress.com marketplace and featured-slot conversation started, with a QA pass on a WordPress.com Business site.
- Playground blueprint with the guided tour; Studio preset submitted.
- Compatibility program: first 10 plugins tested, compatibility page live.
- Release-to-content automation live.
- First WooCommerce blog post (store desk) and first international pitch (Spanish, by Roberto).
- Target: net-flat installs by October 31.

**Weeks 7 to 13 (November to mid December): the AI story and earned media**

- VIP co-marketing pitch delivered with the "AI-ready admin layer" draft.
- MCP transport scoped with engineering; if it ships, directory listings and the press pitch go out the same week.
- Press pitch (WP Tavern, SEJ, Post Status) in the enterprise register, with the WPVibe comparison.
- Two YouTube partner videos.
- "Invite your team" and the review prompt ship.
- Monthly "why sites leave" review picks one fix.
- Target: 3,000 estimated installs by December 31.

## 10. What not to do

- **Do not chase the downloads chart.** More releases lift downloads without lifting installs, and we already ship twice a week. Cadence is fine; narrative is missing.
- **Do not add telemetry without opt-in.** wp.org rules and our "nothing leaves your server" message both forbid it. The deactivation dialog and the first-run counter are opt-in and anonymous.
- **Do not build a relay or a SaaS.** The self-hosted, no-key story is the differentiator against WPVibe. Keep it.
- **Do not rewrite the readme's first paragraph.** It is the best-written thing in our marketing. Add to it.
- **Do not connect more than three systems this quarter.** The guide's Pattern 2 (connected but fragile) is one weekend of enthusiasm away.

## Sources

- https://wp-rankings.com/plugins/desktop-mode/ (estimated installs, momentum, resolution rate)
- https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=desktop-mode (installs bucket, downloads, ratings, support)
- https://api.wordpress.org/stats/plugin/1.0/downloads.php?slug=desktop-mode&limit=120 (daily downloads)
- https://github.com/WordPress/openstation (stars, forks, releases)
- https://openstation.me/ and https://openstation.blog/ (site and blog audit)
- https://happas.jp/blog/en/post/982/ (the one third-party review surfaced)
- "Building the Enterprise AI Stack: A Framework for Marketing Leaders", WordPress VIP and Americaneagle.com (framework, platform-layer criteria, five questions)
- ../competitive/wpvibe-growth-analysis.md and ../competitive/wpvibe-code-comparison.md (competitor playbook and product gaps)
