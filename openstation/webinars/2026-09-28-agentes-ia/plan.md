# Webinar: "Cómo crear agentes de IA con identidad propia en WordPress"

**Cuándo:** lunes 28 de septiembre de 2026, 18:00 CEST. En remoto, grabado para YouTube, compartiendo pantalla.
**Formato:** 5 min de introducción + 25 min de demo en directo, y después preguntas. Otra persona filtra las preguntas y te las pasa al final.
**Público:** la comunidad WordPress hispanohablante en general. Perfiles técnicos y no técnicos, todos familiarizados con wp-admin.
**Idioma:** todo en español. Los botones y textos del sitio van en inglés entre comillas o en negrita, tal como aparecen en pantalla (el sitio está en inglés).

Datos comprobados contra el código en trunk `f4450a97` y contra el sitio local (:8890) el 24/09/2026. El banco de preguntas está en [`question-bank.md`](question-bank.md).

---

## 1. Qué promete la descripción de la sesión y cómo lo cumplimos

| Promesa de la descripción | Qué enseñamos | Qué NO prometer de más |
|---|---|---|
| "funcionan como usuarios reales de WordPress: tienen permisos, un rol definido" | wp-admin → **Users**: los agentes aparecen con su rol, su cara como avatar y la columna **Type: Agent**. Localizer es **Autor**; los demás son Editores | – |
| "un historial de cada acción que realizan" | (1) La pantalla de **Revisions** del post: la revisión que hizo el agente va firmada con su usuario. (2) La lista de entradas filtrada por autor: los borradores de Localizer tienen a Localizer como autor. (3) La ventana de chat guarda cada conversación, con una lista **Tool calls (n)** que muestra exactamente qué herramientas usó | No hay un registro visible de *cada* acción. Los cambios en medios (texto alternativo) no dejan revisión, y el registro interno de ejecuciones no tiene interfaz. Di: "todo lo que un agente escribe en tu contenido queda firmado con su usuario" |
| "crear un agente (un traductor o un revisor de estilo)" | El traductor es Localizer (viene con el plugin). El "Revisor de estilo" lo **creamos en directo** con el asistente de creación | – |
| "asignarle exactamente lo que puede tocar" | Tres palancas: el **rol** (paso **Powers**), la lista de herramientas (**Tools**) con sus etiquetas "read-only" / "can modify", y los **disparadores** (qué tipo de contenido acepta). Momento en directo: un revisor de estilo de solo lectura no puede aplicar sus sugerencias hasta que marcas `update-post` | Lo de "preguntar antes de aplicar" es una instrucción más unos botones, no un bloqueo del servidor. El límite real son las herramientas que marcas y el rol |
| "enviarle contenido arrastrándolo o con un clic derecho" | Arrastrar un post sobre tl;dr. Clic derecho → **Send to Localizer** | "Send to" funciona con entradas, páginas, medios y usuarios, no con comentarios |
| "revisar después qué hizo cada agente" | El mismo rastro de la fila 2, como bloque de cierre | **View contributions** solo cuenta entradas **publicadas** y comentarios, así que para estos agentes sale vacío. No lo uses en directo |

## 2. Entorno de la demo: openstation.blog

**Decidido:** la demo se hace en **openstation.blog**, con la interfaz en inglés. Preséntalo como "nuestro sitio principal". Usarás tus propias entradas, y los requisitos los confirmas tú.

**Lista de comprobación para openstation.blog** (la confirma Roberto). Son las mismas comprobaciones que pasaron en el sitio local :8890 el 24/09/2026:
- [ ] WordPress 7.0 o superior, para que esté el cliente de IA de Core.
- [ ] Un conector con **llamadas a funciones** (function calling) en Settings → Connectors. En local se usó `ai-provider-for-anthropic`. Sin function calling, los agentes pueden hablar pero no usar herramientas.
- [ ] Agentes activados (WP Explorer → Agents → **Turn on Agents**).
- [ ] El interruptor del asistente de IA de tu usuario, activado (Preferences → Features).
- [ ] Existen los cinco agentes de serie. Se crean la primera vez que un administrador carga wp-admin con los agentes activados, y solo en un sitio que aún no tenga ninguno.
- [ ] **Los trabajos en segundo plano funcionan.** Cada ejecución de un agente es un trabajo en segundo plano que tiene que recoger el cron de WordPress. Manda un mensaje de prueba: si se queda en "Queued — waiting for a WordPress worker…" más de unos segundos, comprueba que `DISABLE_WP_CRON` esté desactivado, o que un cron real llame a `wp-cron.php` cada minuto.
- [ ] Apunta qué versión de OpenStation tiene el sitio. #902 y #903 no estarán desplegados el lunes, y para esta demo da igual.

**Qué agentes de serie enseñar.** Depende de si están las habilidades `ai/*` (el plugin de experimentos de IA):
- ✅ **Localizer**: solo necesita `get-post` y `create-post`, y siempre crea borradores. Seguro en cualquier caso.
- ✅ **tl;dr**: con `get-post` y `update-post` le basta; el propio modelo escribe el resumen.
- ✅ **SEO Medic** (de reserva): las mismas herramientas básicas, y enseña muy bien el flujo de los tres títulos con botones.
- ⚠️ **Alt Text Librarian**: solo con las habilidades `ai/*`. Sin `ai/alt-text-generation` no puede *ver* la imagen.
- ❌ **Comment Concierge**: uno de sus nombres de herramienta está mal escrito hasta que se despliegue #902.

**Trabajar en un sitio real.** Estos agentes escriben de verdad:
- tl;dr actualiza una entrada.
- El revisor de estilo, cuando ya pueda escribir, actualiza una entrada.
- Localizer crea un borrador.

Usa entradas de demo que no te importe cambiar, o reviértelas después desde la pantalla de Revisions del post (que además es un buen momento de cierre). Recuerda que la grabación es pública: todo lo que salga en pantalla (títulos de entradas, otros borradores, nombres de usuario) acabará en YouTube.

## 3. Escaleta (30 minutos)

### Introducción: 5 minutos (presentación de 4 diapositivas en español, con la marca OpenStation)

| Min | Momento | Qué decir |
|---|---|---|
| 0:00 | Quién eres y qué es OpenStation (una frase) | "OpenStation convierte wp-admin en un escritorio. Hoy vamos a hablar de la parte más nueva: los agentes." |
| 0:45 | **La idea: un agente es un usuario de WordPress** | "Un agente no es un chatbot pegado al lado. Es un usuario de WordPress: tiene nombre, cara, rol y permisos. Lo que escribe, lo firma." |
| 1:45 | **Cómo viaja una petición** (un diagrama) | "Tú le mandas contenido → el agente lo lee y decide qué herramientas usar → las usa como su propio usuario → te responde y, si hace falta, te propone botones para aplicar." Menciona que las herramientas son la **Abilities API** de Core, que el modelo llega a través del **cliente de IA** y los **Conectores** de Core, y que OpenStation nunca guarda tu API key |
| 3:15 | **Las barreras** (una diapositiva, cuatro líneas) | "No puede iniciar sesión. No puede hacer más que tú. Solo usa las herramientas que le marques. Y trata lo que lee (un comentario, un post) como datos, no como órdenes." |
| 4:30 | Qué vamos a ver en la demo | "Vamos a usar dos agentes que vienen de serie, crear uno nuevo desde cero y ver después qué ha hecho cada uno." |

El diagrama del minuto 1:45:

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

### Demo: 25 minutos

| Min | Momento | Acciones | Qué decir / señalar |
|---|---|---|---|
| 0:00 | **Conoce a la plantilla** | WP Explorer → Agents: las cinco tarjetas. Abre **Localizer** → las pestañas **Define / Tools / Triggers** | "Cada agente tiene instrucciones, herramientas y disparadores. Fijaos en el rol: Localizer es Autor, no Editor. Mínimo privilegio." |
| 2:30 | **Traducir con clic derecho** | WP Explorer → Posts → clic derecho sobre un post en español → **Send to Localizer**. Te pregunta el idioma → escribe "inglés" | "Le mando el post con un clic derecho, y como no le he dicho a qué idioma, me lo pregunta." |
| 3:30 | **Son usuarios de verdad** (mientras Localizer traduce: espera 1 de la sección 4) | wp-admin → **Users** en otra ventana: la columna Type, las caras, los roles. Abre el perfil de Localizer | "Tienen email sintético y contraseña aleatoria, pero WordPress les bloquea el inicio de sesión en todas las vías: contraseña, contraseñas de aplicación, cookies." |
| 6:00 | **Vuelta al chat** | Ya está la respuesta. Abre la lista **Tool calls**: `get_post`, `create_post` | "Aquí veis exactamente qué herramientas ha usado." |
| 8:00 | **El borrador va firmado por el agente** | Abre la lista de entradas → Drafts: "[EN] …", con Localizer como autor | "No ha publicado nada: esta herramienta solo sabe crear borradores." |
| 9:30 | **Arrastrar y soltar + botones de aprobación** | Arrastra otro post sobre el agente **tl;dr** (su icono en el escritorio o su tarjeta en WP Explorer). Propone un TL;DR con botones → pulsa **Apply** | "El agente propone y yo decido. Cada botón es una nueva petición." |
| 12:30 | **El rastro** | Abre ese post → Revisions: la última revisión es de **tl;dr**, con su cara | "Esto es WordPress de toda la vida: el historial de revisiones sabe que fue el agente." |
| 14:00 | **Crear el revisor de estilo en directo** | WP Explorer → Agents → **Cast a new agent** → el asistente de creación (abajo) | – |
| 20:30 | **Exactamente lo que puede tocar** | Mándale un post. Sugiere cambios. Pídele "aplica los cambios" → dice que no puede. Edita el agente → Tools → marca `update-post` → vuelve a pedírselo → los aplica. Enseña la nueva revisión, firmada por el nuevo agente | "Lo que no le das, no lo puede hacer. Y aunque tenga rol de Editor, nunca puede hacer más que la persona que se lo pide." |
| 23:30 | **Qué hizo cada uno y qué viene** | Barra lateral del chat: cada conversación se guarda por persona (ni un administrador puede leer las de otro). **Tool calls** en cada respuesta | "Lo que viene: agentes que se disparen solos con eventos de WordPress, como al guardar un post. Hoy se lanzan desde el chat, arrastrando o con clic derecho." |
| 25:00 | Paso a las preguntas | – | – |

**El asistente de creación (14:00 → 20:30):**
1. **Describe:** la descripción, en español: *"Revisa el estilo de un post en español: frases largas, voz pasiva, repeticiones, tono. Propón cambios concretos, cita la frase original y la versión mejorada. No cambies nada sin que te lo pida."* Pulsa **Draft it for me** (una llamada a la IA que escribe las instrucciones; todavía no crea nada).
2. **Meet:** elige una cara (**Surprise me** queda muy bien), llámalo "Revisor de estilo" y dale una voz, por ejemplo "directo, amable, sin rodeos".
3. **Powers:** rol **Editor**. Herramientas: solo `desktop-mode/get-post` (solo lectura). Di: "de momento, solo puede leer."
4. **Summon:** marca **Send to** y **Drag**, aceptando entradas.
5. **Launch:** **Create and chat**.

**Momento de reserva, si una ejecución va muy rápida o falla:** SEO Medic sobre un post, que propone tres títulos con botones.

## 4. Mientras el agente trabaja

Cada ejecución tarda un rato; mide cada una en el ensayo 1. No rellenes la espera explicando la maquinaria. Aprovéchala para enseñar algo que el público pueda ver:
1. Di en una frase qué está haciendo el agente ("está leyendo el post y preparando el borrador").
2. Pasa al relleno de esa espera.
3. Cuando llegue la respuesta, termina la frase y vuelve a ella.

Tres o cuatro segundos de silencio no pasan nada; el indicador de carga ya enseña que algo está pasando.

| Espera | Qué enseñar o hacer | Qué decir |
|---|---|---|
| **1. Localizer traduciendo** | El momento "son usuarios de verdad": wp-admin → **Users** en otra ventana, la columna Type, las caras, los roles, el perfil de Localizer | "Mientras traduce, os enseño algo: estos agentes son usuarios de verdad." |
| **2. tl;dr preparando el resumen** | La pestaña **Triggers** de tl;dr: acepta entradas arrastrándolas y con **Send to** | "Cada agente decide qué contenido acepta y por dónde: a este le puedo arrastrar entradas o mandárselas con clic derecho." |
| **3. "Draft it for me" escribiendo las instrucciones** | Señala la descripción que has escrito. Las instrucciones que genera se pueden editar antes de crear el agente | "Le he dado una descripción de una frase y está escribiendo las instrucciones completas. Luego las puedo retocar." |
| **4. El revisor de estilo revisando su primer post** | Hazle al público una pregunta que se pueda recoger en el turno de preguntas | "¿Qué agente crearíais vosotros para vuestro sitio? Dejadlo en los comentarios y lo vemos al final." |
| **5. El revisor aplicando, después de marcar `update-post`** | La diferencia entre el rol y las herramientas | "El rol dice lo que podría hacer en WordPress; las herramientas, lo que yo le dejo hacer aquí." |
| **Cualquier espera de más de 30 s** | Una frase y, si sigue, el momento de reserva (SEO Medic) | "Esto va en segundo plano: aunque cerrara la pestaña, seguiría trabajando." |

Antes de contar con la espera 2, comprueba en el ensayo 1 que tl;dr rechaza algo que no sea una entrada (una imagen), para saber qué hace de verdad ese ajuste de Triggers en pantalla.

Si alguien pregunta en el turno de preguntas cómo funciona una ejecución por dentro, la respuesta está en la sesión de preguntas 2 y en `question-bank.md` (el límite de turnos, los trabajos en segundo plano, los reintentos). Simplemente no ocupa tiempo de demo.

**Tiempos del ensayo 1** (rellenar):

| Ejecución | Segundos |
|---|---|
| Localizer pregunta el idioma | |
| Localizer traduce | |
| tl;dr propone | |
| tl;dr aplica | |
| Draft it for me | |
| El revisor revisa | |
| El revisor aplica | |

## 5. Calendario de preparación

| Día | Bloque | Qué |
|---|---|---|
| **Jue 24** (hecho) | 30 min | Leer este plan. Tomar las decisiones pendientes (sección 7) |
| | 30 min | **Sesión de preguntas 1**: qué es un agente y las tres superficies de IA |
| **Vie 25** (hoy) | 60 min | **Ensayo 1** en openstation.blog, la demo entera sin cronometrar. Primero, la lista de comprobación de la sección 2. Apunta cada sorpresa: textos, ejecuciones lentas, interfaz en el idioma equivocado, cualquier cosa que falte |
| | 30 min | **Sesión de preguntas 2**: una ejecución de principio a fin, las habilidades y la capa del proveedor |
| **Sáb 26** | 45 min | Diapositivas de la introducción y el guion en español de la introducción y de los rellenos de espera (sección 4) |
| | 30 min | **Sesión de preguntas 3**: barreras, lo que aún no está hecho, cómo extenderlo |
| **Dom 27** | 45 min | **Ensayo 2**, cronometrado y grabado en local, sobre el estado limpio de la demo (sección 6) |
| | 30 min | **Simulacro de preguntas**: hago de espectadores de YouTube (alguien con un sitio que tiene curiosidad, un desarrollador de plugins, un escéptico con los costes y la privacidad de la IA) |
| **Lun 28** | mañana | Nada de actualizaciones de plugins ni despliegues en openstation.blog |
| | 17:15 | Comprobaciones previas (sección 6). Una ejecución de calentamiento que **no** sea sobre un post de la demo |
| | 18:00 | En directo |

## 6. Comprobaciones previas y estado de la demo

**Estado limpio en openstation.blog (prepararlo el domingo, antes del ensayo 2):**
- [ ] 3–4 entradas de demo **en español**: una para traducir, una para el TL;DR, una con un estilo torpe a propósito para el revisor, y una de reserva. Tus propias entradas, o pídeme que las redacte.
- [ ] Borra el "Revisor de estilo" del ensayo, para crear el del directo desde cero. Borra también los borradores del ensayo ("[EN] …").
- [ ] Revierte los cambios del ensayo en las entradas de demo (Revisions → restaurar), para que el estado de "antes" vuelva a estar limpio.
- [ ] Pon tl;dr en el escritorio (detalle del agente → **Send to Desktop**) para que se vea dónde arrastrar.
- [ ] La barra lateral del chat muestra tus conversaciones anteriores. Borra las que no quieras que salgan en cámara, y guarda una buena conversación de ensayo por cada agente de la demo como plan B.

**Lunes a las 17:15:**
- [ ] openstation.blog carga, con tu sesión iniciada y el escritorio de OpenStation a la vista.
- [ ] La clave de Anthropic funciona y tiene saldo. Un chat de calentamiento con cualquier agente, fuera de las entradas de demo.
- [ ] Navegador: una ventana limpia, zoom al 110–125%, notificaciones desactivadas, barra de marcadores oculta, extensiones que añaden elementos a la página desactivadas.
- [ ] macOS en No molestar. Cierra Slack y el correo.
- [ ] Los límites de uso no son un riesgo (60 ejecuciones por agente y hora, 120 por persona y hora), pero evita hacer una docena de ensayos en la hora anterior al directo.

**Si algo falla en directo:**
- Una ejecución se queda en "Queued — waiting for a WordPress worker…" más de 30 s: recarga el escritorio (cualquier carga de página despierta el cron de WordPress), o pasa al siguiente momento y vuelve después.
- Una ejecución da error: lee el error en voz alta (los mensajes están pensados para entenderse), di "esto también es parte de trabajar con IA" y usa la conversación de ensayo guardada en la barra lateral como "uno que hice antes". Ensaya con tu propio usuario en openstation.blog, para que esos planes B estén en tu barra lateral.

## 7. Decisiones (cerradas el 24/09/2026)

- **Idioma de la interfaz:** inglés. Preséntalo como "nuestro sitio principal".
- **Entorno:** openstation.blog. Roberto instala lo necesario y confirma la lista de la sección 2.
- **Contenido de la demo:** las entradas de Roberto en openstation.blog. Pedirá entradas redactadas si hace falta.
- **Introducción:** una presentación de 4 diapositivas en español, con la marca OpenStation (https://nuriapenya.github.io/open-station-brand/).
- **"Exactamente lo que puede tocar":** el momento en dos pasos. El revisor de estilo empieza en solo lectura y no puede aplicar sus sugerencias hasta que se marca `update-post`.

**Presentación:** https://claude.ai/artifact/31Qpa9c1a6VwjQ6mMZD6yP (portada y cuatro diapositivas: la idea, cómo viaja una petición, las barreras, lo que vamos a ver; notas del orador en español en cada una).

## 8. Registro de las sesiones de preguntas

- **Sesión 1 (jue 24/09/2026): qué es un agente y las tres superficies de IA.** La idea general está bien; faltan los detalles.
  - Repasar antes de la sesión 2:
    - quién puede crear o usar agentes (gestionar = `edit_users`, usar = `edit_posts`; el rol de Administrador exige ser administrador de verdad);
    - qué pasa al borrar un agente (sus entradas y páginas van a la papelera, tus conversaciones se quedan, los de serie no vuelven);
    - el inicio de sesión sigue bloqueado aunque apagues los agentes;
    - no presentarlo como "puede hacer lo que cualquier usuario";
    - Mio es el asistente de cada ventana, no un "agente".
- **Sesión 2 (vie 25/09/2026):** una ejecución de principio a fin, las habilidades y la capa del proveedor.
