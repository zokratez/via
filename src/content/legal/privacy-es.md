# Política de Privacidad

**Vigente desde: 13 de mayo de 2026**

PACO Peptide ("nosotros", "nuestro") es una aplicación operada por ooabi LLC. Esta política explica qué información recopilamos cuando usas PACO Peptide, cómo la usamos, y qué control tienes sobre ella.

PACO Peptide es una herramienta informativa para personas usando GLP-1. **No somos un proveedor médico**. Esta política describe nuestras prácticas de privacidad — no nuestras prácticas clínicas (no las tenemos).

## Información que recopilamos

### Información que tú nos das directamente

Cuando creas una cuenta y usas PACO Peptide, recopilamos:

- **Correo electrónico** — para autenticación y comunicación de cuenta
- **Datos de salud que ingresas** — peso, dosis registradas, sitios de inyección, síntomas que registras voluntariamente
- **Conversaciones con el coach (Bukowski)** — los mensajes que envías y las respuestas que recibes
- **Fotos privadas que subes** — fotos de progreso y fotos de comida, incluyendo notas opcionales y campos de nutrición

### Información que recopilamos automáticamente

- **Datos de uso** — qué páginas visitas, cuántos mensajes envías al coach, frecuencia de uso (sin contenido personal asociado)
- **Información técnica** — tipo de dispositivo, navegador, dirección IP aproximada (para seguridad y prevención de fraude)

### Información de pago

Si te suscribes a PACO Peptide Pro, **Stripe** procesa tu pago. Nosotros no almacenamos tu número de tarjeta de crédito. Stripe nos da:

- Tu identificador de cliente (Stripe Customer ID)
- Estado de tu suscripción (activa, cancelada, etc.)
- Últimos cuatro dígitos de tu tarjeta (solo para mostrarte cuál usaste)

Las prácticas de privacidad de Stripe están en [stripe.com/privacy](https://stripe.com/privacy).

## Cómo usamos tu información

Usamos los datos recopilados para:

- Proveerte el servicio (mostrar tu historial, calcular tendencias, dar contexto al coach sobre tu situación)
- Procesar pagos a través de Stripe
- Mejorar el producto (en agregado, no a nivel individual)
- Comunicarnos contigo sobre tu cuenta o cambios importantes
- Cumplir obligaciones legales

**No vendemos tus datos. No alquilamos tus datos. No usamos tus conversaciones con el coach para entrenar modelos de IA.**

## Cómo se procesan tus conversaciones con el coach

Tus mensajes al coach se envían a **Anthropic** (los desarrolladores del modelo Claude que usamos) para generar las respuestas. Anthropic procesa esos mensajes según su política de uso comercial, que prohíbe usarlos para entrenamiento por defecto.

Política de Anthropic: [anthropic.com/legal/privacy](https://www.anthropic.com/legal/privacy)

Guardamos tus conversaciones en nuestra base de datos para que tengas historial dentro de PACO Peptide. Si eliminas tu cuenta, eliminamos las conversaciones.

## Cómo se procesa el análisis de fotos de comida

Si eliges analizar una foto de comida, la imagen seleccionada se envía a **Anthropic** para que la IA estime calorías y macros visibles. La estimación no es consejo médico, puede estar equivocada y se muestra para que la revises antes de guardarla.

Las fotos de comida y progreso se almacenan de forma privada en Supabase. No son públicas, no se muestran a otros usuarios y puedes borrarlas.

## Artículos en nuestro diario

Los artículos en el diario editorial de PACO Peptide se producen mediante un pipeline automatizado:

- Extraemos resúmenes de investigación recién publicada sobre GLP-1 y péptidos desde **PubMed** (la base de datos pública de NIH/NCBI)
- Un borrador del artículo se genera con **Claude** (el LLM de Anthropic) resumiendo la investigación
- Un editor humano revisa y aprueba cada borrador antes de su publicación — los borradores no se publican automáticamente

No enviamos datos de usuarios a PubMed ni a Anthropic durante este proceso. La generación de artículos opera únicamente sobre resúmenes de investigación públicamente disponibles.

## Dónde se almacenan tus datos

- **Cuenta y datos de salud:** Supabase (servidores en EE.UU., región AWS us-west-1)
- **Fotos privadas:** Supabase Storage, mismo proyecto y región que tus datos de cuenta
- **Pagos:** Stripe (cumple PCI-DSS)
- **Conversaciones del coach:** Supabase, mismo lugar que tu cuenta
- **Contadores de límite de uso:** Upstash (basado en Redis, se usa para aplicar los límites diarios del plan gratis — recibe únicamente un identificador interno opaco; nunca correo, datos de salud, ni contenido de mensajes)

## Tus derechos

Tienes derecho a:

- **Ver** los datos que tenemos sobre ti
- **Corregir** datos incorrectos
- **Eliminar** tu cuenta y todos los datos asociados
- **Exportar** tu historial en un formato legible

Para ejercer cualquiera de estos derechos, escríbenos a **privacy@pacopeptide.com**. Respondemos en máximo 30 días.

Si vives en California (CCPA), la Unión Europea (GDPR), o cualquier jurisdicción con leyes de protección de datos similares, tienes derechos adicionales bajo esas leyes. Los respetamos también.

## Retención de datos

Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, eliminamos tus datos personales — registros de salud, conversaciones con el coach, detalles de cuenta — dentro de **30 días** desde la solicitud de eliminación, incluyendo de nuestros respaldos activos.

Podemos conservar estadísticas de uso anonimizadas (conteos, frecuencias, sin identificadores personales) de forma indefinida para análisis de producto. Estas no pueden vincularse contigo después de la eliminación.

También podemos conservar un registro mínimo de la eliminación misma (fecha, referencia anonimizada de cuenta) para cumplimiento legal y para defendernos contra intentos fraudulentos de re-registro.

## Menores

PACO Peptide no está dirigida a menores de 18 años. No recopilamos datos a sabiendas de menores. Si descubres que un menor creó una cuenta, escríbenos y la eliminaremos.

## Seguridad

Usamos cifrado en tránsito (HTTPS) y en reposo (cifrado a nivel de base de datos). Ninguna plataforma es 100% impenetrable, pero tomamos en serio la seguridad de datos médicos personales.

Si descubrimos una violación de datos que te afecte, te lo notificaremos según las leyes aplicables.

## Cookies

Usamos cookies estrictamente necesarias para que la aplicación funcione (sesión, autenticación). No usamos cookies de seguimiento de terceros ni cookies publicitarias.

## Cambios a esta política

Si cambiamos esta política de manera significativa, te avisaremos por correo electrónico antes de que el cambio entre en vigor. La fecha de "Vigente desde" arriba siempre refleja la versión actual.

## Contacto

**ooabi LLC**
privacy@pacopeptide.com

Para preguntas sobre esta política o sobre tus datos.

---

*Esta política está disponible también en [inglés](/en/privacy).*
