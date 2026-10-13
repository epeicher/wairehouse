# Anexo: dónde guardan sus datos los agentes

Anexo del [plan del webinar](plan.md). Nombres comprobados contra `trunk` de OpenStation el 26/09/2026, con #902 y #903 ya fusionados.

**La idea en una frase:** los agentes no crean tablas propias. Todo vive en las tablas de siempre de WordPress (`wp_users`, `wp_usermeta`, `wp_posts`, `wp_postmeta`, `wp_options`), más una carpeta en `uploads` para las caras.

> Los nombres guardados siguen diciendo `desktop_mode` (el nombre antiguo del plugin) a propósito. Ya están escritos en bases de datos reales, y cambiarlos dejaría los datos huérfanos.

## El diagrama

Si tu visor no dibuja Mermaid, tienes el mismo diagrama como imagen: [`anexo-datos-agentes.png`](anexo-datos-agentes.png).

```mermaid
erDiagram
    wp_users-AGENTE ||--o{ wp_usermeta : "su definición (user_id)"
    wp_users-AGENTE ||--o{ wp_posts-CONTENIDO : "autor de borradores y revisiones"
    wp_users-PERSONA ||--o{ wp_posts-CHAT : "dueña de la conversación (post_author)"
    wp_posts-CHAT ||--|| wp_postmeta : "post_id"
    wp_postmeta }o--|| wp_users-AGENTE : "con qué agente se habló"
    wp_users-PERSONA ||--o{ wp_options : "trabajos en segundo plano (owner)"
    wp_users-AGENTE ||--o{ wp_options : "trabajos y límites de uso"

    wp_users-AGENTE {
        int ID "id del agente"
        string user_login "agent-slug, por ejemplo agent-localizer"
        string user_email "slug arroba agents.tudominio, nunca recibe correo"
        string user_pass "aleatoria de 64 caracteres, no sirve para entrar"
        string display_name "el nombre, por ejemplo Localizer"
    }

    wp_usermeta {
        string _desktop_mode_agent "vale 1, la marca que lo convierte en agente"
        string _desktop_mode_agent_description "cuándo usarlo"
        text _desktop_mode_agent_instructions "las instrucciones (prompt de sistema)"
        json _desktop_mode_agent_abilities "lista de herramientas permitidas"
        json _desktop_mode_agent_triggers "disparadores: chat, send-to, drag"
        string _desktop_mode_agent_model "modelo preferido, guardado pero aún sin uso"
        int _desktop_mode_agent_rate_limit "ejecuciones por hora, 0 es el valor por defecto"
        int _desktop_mode_agent_created_by "quién lo creó"
        string _desktop_mode_agent_vibes "la voz, una línea de 120 caracteres como máximo"
        json _desktop_mode_agent_face "el aspecto de su cara estilo Mio"
        int _desktop_mode_agent_face_seed "la semilla de la cara"
        json _desktop_mode_agent_runs "registro de las últimas 50 ejecuciones"
        string wp_capabilities "el rol, guardado por Core como el de cualquier usuario"
    }

    wp_users-PERSONA {
        int ID "la persona que usa el agente"
        json desktop_mode_os_settings "en wp_usermeta, incluye su interruptor de IA"
    }

    wp_posts-CHAT {
        int ID "una entrada por conversación"
        string post_type "desktop_mode_chat, privado, sin REST ni revisiones"
        int post_author "la persona, la única que puede leerla"
        json post_content "los mensajes, hasta 200"
        string post_title "sale del primer mensaje"
    }

    wp_postmeta {
        int _desktop_mode_agent_chat_agent_id "el id del agente"
    }

    wp_posts-CONTENIDO {
        int post_author "el agente, en los borradores que crea Localizer"
        string post_type "revision, cada revisión firmada por el agente que editó"
    }

    wp_options {
        json desktop_mode_extended_options "incluye la clave agents, el interruptor general"
        string desktop_mode_agents_defaults_seeded "los cinco de serie ya se crearon"
        json openstation_agent_job_UUID "un trabajo: estado, mensaje, resultado"
        int openstation_agent_job_claim_UUID "el trabajador que lo cogió, evita repetirlo"
        string openstation_agent_job_active_PERSONA_AGENTE "un trabajo a la vez por persona y agente"
        int desktop_mode_agent_user_rate_PERSONA_HORA "transient, ejecuciones de la persona esta hora"
        int openstation_agent_rate_AGENTE_HORA "transient, ejecuciones del agente esta hora"
        json cron "openstation_agent_job_run y openstation_agent_job_cleanup"
    }
```

## Tabla por tabla

### `wp_users`: el agente es un usuario

Una fila por agente, como cualquier usuario. El email es sintético y la contraseña aleatoria, y OpenStation bloquea todas las vías de inicio de sesión, aunque se apague la función de agentes. El rol se guarda donde Core guarda siempre los roles (`wp_capabilities` en `wp_usermeta`).

### `wp_usermeta`: la definición del agente

Todo lo que define a un agente son metadatos de su propio usuario: instrucciones, herramientas, disparadores, voz, cara y límites. No aparecen en el endpoint `wp/v2/users` de Core, pero cualquiera que pueda usar agentes (`edit_posts`) puede leer las instrucciones por la API de agentes. **No pongas secretos en las instrucciones.**

`_desktop_mode_agent_runs` es un registro de auditoría de las últimas 50 ejecuciones: quién lo lanzó y los primeros 600 caracteres del mensaje y de la respuesta. De momento solo se lee desde PHP; no tiene pantalla.

### `wp_posts` + `wp_postmeta`: las conversaciones

Cada conversación es una entrada privada del tipo `desktop_mode_chat`:
- El autor es la **persona**, no el agente. Solo esa persona puede leerla, ni siquiera un administrador por la API.
- Los mensajes van en JSON dentro de `post_content`.
- El id del agente va en el metadato `_desktop_mode_agent_chat_agent_id`.
- Límites: 100 conversaciones por persona (al pasar de 100 se borran las que llevan más tiempo sin usarse) y 200 mensajes por conversación.
- Se guarda qué herramientas usó el agente y con qué argumentos, pero **no** lo que devolvieron.
- ¿Por qué entradas y no metadatos de usuario? WordPress carga todos los metadatos de un usuario de golpe, y guardar ahí transcripciones largas haría más lenta cada petición.

### `wp_posts`: el contenido que tocan los agentes

Aquí no hay nada especial, y precisamente esa es la gracia:
- Un borrador creado por Localizer tiene a Localizer como `post_author`.
- Cuando tl;dr edita una entrada, Core guarda una revisión con tl;dr como autor.

Por eso "qué hizo cada agente" se ve en las pantallas de siempre: Revisions y la lista de entradas filtrada por autor.

### `wp_options`: trabajos en segundo plano, límites y ajustes

- `desktop_mode_extended_options`: el interruptor general de agentes (la clave `agents`).
- `desktop_mode_agents_defaults_seeded`: marca que los cinco de serie ya se crearon; por eso no vuelven aunque los borres.
- `openstation_agent_job_{uuid}`, `openstation_agent_job_claim_{uuid}` y `openstation_agent_job_active_{persona}_{agente}`: cada petición al agente es un trabajo en segundo plano. Llevan `autoload` desactivado, caducan a las 2 horas y se borran al día.
- Los límites de uso son *transients* por hora: 120 ejecuciones por persona y 60 por agente. Con una caché de objetos (Redis, Memcached) viven ahí en lugar de en `wp_options`.
- El cron de WordPress (la opción `cron`) programa `openstation_agent_job_run`, que ejecuta el trabajo, y `openstation_agent_job_cleanup`, que lo limpia.

### Fuera de la base de datos: las caras

`wp-content/uploads/desktop-mode-agent-faces/{id}-{hash}.svg`: la cara de cada agente, dibujada en PHP al guardarlo, para que `get_avatar()` funcione en cualquier parte sin coste. La carpeta lleva un `.htaccess` que impide ejecutar PHP (en servidores Apache).

## Lo que OpenStation NO guarda

- **La API key del proveedor de IA.** Está en los Conectores de WordPress (Settings → Connectors); OpenStation nunca la toca.
- **Lo que devuelven las herramientas.** Ni en las conversaciones ni en el registro.
- **Índices ni embeddings de tu contenido.** No hay análisis en segundo plano; el agente lee lo que le mandas, cuando se lo mandas.
