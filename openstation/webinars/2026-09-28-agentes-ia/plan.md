# Webinar: "Cómo crear agentes de IA con identidad propia en WordPress"

**When:** Monday 2026-09-28, 18:00 CEST. Remote, recorded for YouTube, screen share.
**Format:** 5 min intro + 25 min live demo, then Q&A. Someone else triages the questions and passes them to you at the end.
**Audience:** the wider WordPress community in Spanish. Technical and non-technical people, all familiar with wp-admin.
**Language:** you speak Spanish; the plan is in English, and the on-stage lines are in Spanish.

Facts verified against the code at trunk `f4450a97` and against the local site (:8890) on 2026-09-24. The question bank is in [`question-bank.md`](question-bank.md).

---

## 1. What the session description promises, and how we deliver each one

| Promise in the description | What we show | What NOT to overclaim |
|---|---|---|
| "funcionan como usuarios reales de WordPress: tienen permisos, un rol definido" | wp-admin → Users: agents are listed with a role, a face avatar and the "Type: Agent" column. Localizer is an **Author**; the rest are Editors | – |
| "un historial de cada acción que realizan" | (1) The post's **Revisions** screen: the revision an agent made is signed by the agent's user. (2) The Posts list filtered by author: Localizer's drafts are authored by Localizer. (3) The chat window keeps every conversation, with a "Tool calls (n)" list showing exactly which tools ran | There is no visible log of *every* action. Media edits (alt text) leave no revision, and the internal run log has no UI. Say: "todo lo que un agente escribe en tu contenido queda firmado con su usuario" |
| "crear un agente (un traductor o un revisor de estilo)" | Localizer is the translator (it ships with the plugin). The style reviewer ("Revisor de estilo") we **build live** in the wizard | – |
| "asignarle exactamente lo que puede tocar" | Three dials: the **role** (Powers step), the **Tools** checklist with its "read-only" / "can modify" badges, and the **triggers** (which kinds of content it accepts). Live beat: a read-only style reviewer can't apply its own suggestions until you tick `update-post` | The "ask before applying" behaviour is an instruction plus buttons, not a server lock. The real limit is the tools you tick and the role |
| "enviarle contenido arrastrándolo o con un clic derecho" | Drag a post onto tl;dr. Right-click → "Send to Localizer" | "Send to" works for posts, pages, media and users, not for comments |
| "revisar después qué hizo cada agente" | Same trail as row 2, shown as a closing segment | "View contributions" only counts **published** posts and comments, so it looks empty for these agents. Don't use it on stage |

## 2. Demo environment: openstation.blog

**Decided:** the demo runs on **openstation.blog**, with the UI in English. Present it as "nuestro sitio principal". You'll use your own posts there, and you'll confirm the requirements yourself.

**Checklist for openstation.blog** (Roberto confirms). These are the same checks that passed on the local :8890 site on 2026-09-24:
- [ ] WordPress 7.0 or later, so Core's AI Client is present.
- [ ] A connector with **function calling** under Settings → Connectors. The local site used `ai-provider-for-anthropic`. Without function calling, agents can talk but can't use tools.
- [ ] Agents turned on (WP Explorer → Agents → "Turn on Agents").
- [ ] Your user's AI assistant toggle is on (Preferences → Features).
- [ ] All five default agents exist. They are seeded the first time an admin loads wp-admin with Agents on, and only on a site with no agents yet.
- [ ] **Background jobs run.** Every agent run is a background job that WordPress cron has to pick up. Send one test message: if it sits on "Queued — waiting for a WordPress worker…" for more than a few seconds, check that `DISABLE_WP_CRON` is off, or that a real cron hits `wp-cron.php` every minute.
- [ ] Note which OpenStation version the site runs. #902 and #903 won't be deployed by Monday, which doesn't matter for this demo.

**Which default agents to demo.** This depends on whether the `ai/*` abilities are present (the AI experiments plugin):
- ✅ **Localizer**: needs only `get-post` and `create-post`, and it always creates drafts. Safe either way.
- ✅ **tl;dr**: `get-post` and `update-post` are enough; the model writes the summary itself.
- ✅ **SEO Medic** (spare): the same core tools, and it shows the three-titles button flow well.
- ⚠️ **Alt Text Librarian**: only with the `ai/*` abilities. Without `ai/alt-text-generation` it can't *see* the image.
- ❌ **Comment Concierge**: one of its tool names is misspelled until #902 is deployed.

**Working on a live site.** These agents write for real:
- tl;dr updates a post.
- The style reviewer, once it can write, updates a post.
- Localizer creates a draft.

Use demo posts you're happy to change, or revert afterwards from the post's Revisions screen, which is itself a good closing beat. Keep in mind the recording is public: anything on screen (post titles, other drafts, user names) will be on YouTube.

## 3. Run of show (30 minutes)

### Intro: 5 minutes (a 4-slide deck in Spanish, in the OpenStation brand)

| Min | Beat | Say (Spanish) |
|---|---|---|
| 0:00 | Who you are, what OpenStation is (one line) | "OpenStation convierte wp-admin en un escritorio. Hoy vamos a hablar de la parte más nueva: los agentes." |
| 0:45 | **The idea: an agent is a WordPress user** | "Un agente no es un chatbot pegado al lado. Es un usuario de WordPress: tiene nombre, cara, rol y permisos. Lo que escribe, lo firma." |
| 1:45 | **How a request travels** (one diagram) | "Tú le mandas contenido → el agente lo lee y decide qué herramientas usar → las usa como su propio usuario → te responde y, si hace falta, te propone botones para aplicar." Mention: the tools are Core's **Abilities API**, the model goes through Core's **AI Client** and **Connectors**, and OpenStation never stores your API key |
| 3:15 | **The guardrails** (one slide, four lines) | "No puede iniciar sesión. No puede hacer más que tú. Solo usa las herramientas que le marques. Y trata lo que lee (un comentario, un post) como datos, no como órdenes." |
| 4:30 | What we'll see in the demo | "Vamos a usar dos agentes que vienen de serie, crear uno nuevo desde cero y ver después qué ha hecho cada uno." |

The diagram for 1:45:

```
Tú ──(chat / arrastrar / clic derecho)──▶ Agente (usuario WP, rol Editor)
                                              │  hasta 8 turnos
                                              ▼
                              Habilidades de WordPress (get-post, update-post…)
                                              │
                                              ▼
                      Modelo de IA vía los Conectores de WordPress (Claude, …)
                                              │
                                              ▼
                               Respuesta + botones "Aplicar / Descartar"
```

### Demo: 25 minutes

| Min | Beat | Actions | Say / point out |
|---|---|---|---|
| 0:00 | **Meet the cast** | WP Explorer → Agents: the five cards. Open **Localizer** → the Define / Tools / Triggers tabs | "Cada agente tiene instrucciones, herramientas y disparadores. Fijaos en el rol: Localizer es Autor, no Editor. Mínimo privilegio." |
| 2:30 | **They really are users** | wp-admin → Users: the Type column, the faces, the roles. Open one profile | "Tienen email sintético y contraseña aleatoria, pero WordPress les bloquea el inicio de sesión en todas las vías: contraseña, contraseñas de aplicación, cookies." |
| 4:00 | **Translator via right-click** | WP Explorer → Posts → right-click a Spanish post → **Send to Localizer**. It asks for the language → type "inglés" | **While "Working…" is on screen, explain the loop** (section 4). Then show the "Tool calls" list: `get_post`, `create_post` |
| 8:00 | **The draft is signed by the agent** | Open the Posts list → Drafts: "[EN] …", with Localizer as its author | "No ha publicado nada: esta herramienta solo sabe crear borradores." |
| 9:30 | **Drag & drop + approval buttons** | Drag another post onto the **tl;dr** agent (desktop tile or WP Explorer card). It proposes a TL;DR with buttons → click **Apply** | "El agente propone y yo decido. Cada botón es una nueva petición." |
| 12:30 | **The trail** | Open that post → Revisions: the latest revision is by **tl;dr**, with its face | "Esto es WordPress de toda la vida: el historial de revisiones sabe que fue el agente." |
| 14:00 | **Build the style reviewer live** | WP Explorer → Agents → **Cast a new agent** → the wizard (below) | – |
| 20:30 | **Exactly what it can touch** | Send it a post. It suggests edits. Ask "aplica los cambios" → it says it can't. Edit the agent → Tools → tick `update-post` → ask again → it applies. Show the new revision, signed by the new agent | "Lo que no le das, no lo puede hacer. Y aunque tenga rol de Editor, nunca puede hacer más que la persona que se lo pide." |
| 23:30 | **What it did, and what's next** | Chat sidebar: every conversation is saved per person (not even an admin can read someone else's). "Tool calls" per answer | "Lo que viene: agentes que se disparen solos con eventos de WordPress, como al guardar un post. Hoy se lanzan desde el chat, arrastrando o con clic derecho." |
| 25:00 | Hand over to Q&A | – | – |

**Wizard beat (14:00 → 20:30):**
1. **Describe:** brief in Spanish: *"Revisa el estilo de un post en español: frases largas, voz pasiva, repeticiones, tono. Propón cambios concretos, cita la frase original y la versión mejorada. No cambies nada sin que te lo pida."* Click **Draft it for me** (one AI call that writes the instructions; it creates nothing yet).
2. **Meet:** pick a face ("Surprise me" is a nice beat), name it "Revisor de estilo", and give it a voice line, for example "directo, amable, sin rodeos".
3. **Powers:** role **Editor**. Tools: only `desktop-mode/get-post` (read-only). Say: "de momento, solo puede leer."
4. **Summon:** tick **Send to** and **Drag**, accepting posts.
5. **Launch:** **Create and chat**.

**Spare beat, if a run is quick or one fails:** SEO Medic on a post, which offers three titles as buttons.

## 4. The explanation to give while the agent is working (about 60 seconds)

This is the "8-turn loop". Say it in plain words:

> "Ahora mismo el agente está en un bucle. Le hemos mandado sus instrucciones, mi mensaje y la lista de herramientas que tiene permitidas. El modelo puede hacer dos cosas: contestar, y se acaba; o pedir usar una herramienta, por ejemplo 'lee el post 42'. WordPress ejecuta esa herramienta como el usuario del agente, con sus permisos, y le devuelve el resultado. Eso es un turno. Como mucho hace ocho; si llega al límite, le quitamos las herramientas y le obligamos a contestar con lo que tenga. Y todo esto va en segundo plano: si cierro la pestaña, el trabajo sigue."

Facts behind it, in case of follow-ups:
- 8 tool turns, then one forced turn with no tools.
- Any number of tool calls per turn.
- One automatic retry on a transient provider error.
- 180 s timeout per model call.
- Background job: one at a time per person per agent, polled every 2–10 s, never replayed if a worker dies.

## 5. Preparation schedule

| Day | Block | What |
|---|---|---|
| **Thu 24** (today) | 30 min | Read this plan. Answer the open decisions (section 7) |
| | 30 min | **Grilling 1**: what an agent is, and the three AI surfaces |
| **Fri 25** | 60 min | **Rehearsal 1** on openstation.blog, the full demo untimed. Run the section 2 checklist first. Note every surprise: wording, slow runs, UI in the wrong language, anything missing |
| | 30 min | **Grilling 2**: a run end to end, abilities, the provider layer |
| **Sat 26** | 45 min | Intro slides and the Spanish script for the intro and the loop explanation |
| | 30 min | **Grilling 3**: guardrails, what's not built yet, extending |
| **Sun 27** | 45 min | **Rehearsal 2**, timed, recorded locally, on the clean demo state (section 6) |
| | 30 min | **Mock Q&A**: I play YouTube viewers (a curious site owner, a plugin developer, a sceptic about AI costs and privacy) |
| **Mon 28** | morning | No plugin updates or deploys on openstation.blog |
| | 17:15 | Pre-flight (section 6). One warm-up run that is **not** on a demo post |
| | 18:00 | Live |

## 6. Pre-flight and demo state

**Clean state (set up on Sunday, before rehearsal 2) on openstation.blog:**
- [ ] 3–4 demo posts **in Spanish**: one to translate, one for the TL;DR, one with a deliberately clumsy style for the reviewer, and one spare. Your own posts, or ask me to draft them.
- [ ] Delete the "Revisor de estilo" from rehearsal, so the live one is created fresh. Also delete the rehearsal drafts ("[EN] …").
- [ ] Revert the rehearsal edits on the demo posts (Revisions → restore), so the "before" state is clean again.
- [ ] Put tl;dr on the desktop (agent detail → **Send to Desktop**) so the drag-and-drop target is visible.
- [ ] Your chat sidebar lists your own past conversations. Delete the ones you don't want on camera, and keep one good rehearsal conversation per demo agent as a backup.

**Monday 17:15:**
- [ ] openstation.blog loads, logged in as you, with the OpenStation desktop showing.
- [ ] The Anthropic key works and has credit. One warm-up chat with any agent, off the demo posts.
- [ ] Browser: one clean window, 110–125% zoom, notifications off, bookmarks bar hidden, extensions that inject UI disabled.
- [ ] macOS Do Not Disturb on. Close Slack and email.
- [ ] Rate limits are not a risk (60 runs per agent per hour, 120 per person per hour), but avoid a dozen rehearsal runs in the hour before going live.

**If something fails live:**
- A run hangs on "Queued — waiting for a WordPress worker…" for more than 30 s: reload the desktop (any page load wakes WordPress cron), or move to the next beat and come back to it.
- A run errors: read the error out loud (the messages are designed to be human-readable), then say "esto también es parte de trabajar con IA" and use the saved rehearsal conversation in the sidebar as "uno que hice antes". Rehearse with your own user on openstation.blog, so those backups exist in your sidebar.

## 7. Decisions (settled 2026-09-24)

- **UI language:** English. Present it as "nuestro sitio principal".
- **Environment:** openstation.blog. Roberto installs what's needed and confirms the checklist in section 2.
- **Demo content:** Roberto's own posts on openstation.blog. He'll ask for drafted posts if needed.
- **Intro:** a 4-slide deck in Spanish, in the OpenStation brand (https://nuriapenya.github.io/open-station-brand/).
- **"Exactly what it can touch":** the two-step beat. The style reviewer starts read-only and can't apply its own suggestions until `update-post` is ticked.

**Deck:** https://claude.ai/artifact/31Qpa9c1a6VwjQ6mMZD6yP (a cover plus four slides: la idea, cómo viaja una petición, las barreras, lo que vamos a ver; Spanish speaker notes on each slide).
