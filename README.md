# Heart Ring

Aplicación para un anillo inteligente: salud, actividad, sueño, historial de siete días, configuración y acceso seguro. La interfaz no incluye datos ficticios; solo muestra lecturas recibidas desde Supabase.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Vite mostrará la URL local, normalmente `http://localhost:5173`.

## Supabase: base de datos y acceso

La aplicación se puede explorar sin una cuenta. Iniciar sesión es obligatorio para vincular el anillo, guardar los ajustes y consultar los datos privados del usuario.

1. Crea un proyecto de Supabase y ejecuta [supabase/schema.sql](supabase/schema.sql) completo en **SQL Editor**. Crea tablas, RLS, el perfil inicial, ajustes y la limpieza diaria de datos con una retención rodante de siete días.
2. Copia `.env.example` a `.env.local` y completa los valores:

```bash
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
```

3. En **Authentication > URL Configuration**, añade estas Redirect URLs:

```text
http://localhost:5173
http://127.0.0.1:5173
com.heartring.app://auth/callback
```

4. En **Authentication > Providers** activa Email, Google y Apple.

Si las tablas se crearon antes de incorporar el color del anillo, ejecuta también [supabase/migrations/20260822_profile_and_ring_color.sql](supabase/migrations/20260822_profile_and_ring_color.sql). Esta migración agrega `rings.color`, el perfil de hardware, datos básicos de perfil, la restricción de un anillo por cuenta, las tablas de Realtime y recarga la caché REST de Supabase.

### Google

En Google Cloud crea un OAuth 2.0 Client ID de tipo Web. La URL de callback autorizada debe ser exactamente:

```text
https://TU_PROJECT_REF.supabase.co/auth/v1/callback
```

Copia el Client ID y Client Secret en el proveedor Google de Supabase. Los orígenes locales se configuran en Supabase como Redirect URLs, no como callback de Google.

### Apple

En Apple Developer configura un Services ID con Sign in with Apple y usa esta Return URL:

```text
https://TU_PROJECT_REF.supabase.co/auth/v1/callback
```

Genera la clave de Sign in with Apple y completa en el proveedor Apple de Supabase el Services ID, Team ID, Key ID y private key. Apple y Google no se pueden activar solo con SQL: sus secretos deben cargarse en el panel de Supabase porque proceden de los proveedores de identidad.

## Android e iOS

Los proyectos nativos de Capacitor ya están creados en `android/` e `ios/`. Después de cambiar la interfaz, actualiza ambos con:

```bash
npm run mobile:sync
```

Para abrirlos en el entorno de compilación nativo:

```bash
npm run android:open
npm run ios:open
```

Android Studio puede generar el APK/AAB y Xcode el archivo de distribución para App Store. El callback OAuth nativo `com.heartring.app://auth/callback` ya está registrado en Android e iOS. La firma y publicación requieren las cuentas y certificados de Google Play y Apple Developer del propietario.

## Vercel

El proyecto incluye [vercel.json](vercel.json) para construir Vite y resolver rutas de la SPA hacia `index.html`.

1. Importa el repositorio en Vercel.
2. Añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en **Project Settings > Environment Variables**.
3. Despliega sin cambiar Build Command ni Output Directory: `vercel.json` define `npm run build` y `dist`.

Agrega la URL de producción de Vercel en **Authentication > URL Configuration** de Supabase para completar OAuth en producción.

## Bluetooth y datos del anillo

Cada cuenta admite un único `Dini Ring 1`; una vez vinculado, no se ofrece una segunda vinculación, incluso si el acabado es distinto. La app actualiza FC, presión, SpO2, actividad y sueño en Realtime cuando las nuevas lecturas llegan a Supabase, con una recarga de respaldo cada minuto mientras está abierta.

En Android/iPhone, **Actualizar conexión** explora el anillo ya asociado, registra RSSI, servicios y características GATT en `rings.hardware_profile`, y no crea otro vínculo. El anillo físico debe estar cerca del teléfono para hacer esta exploración. Si anuncia servicios estándar, se podrán usar sus capacidades directamente; si usa UUIDs propietarios Lefun, el perfil guardado permitirá incorporar el decoder exacto. No se generan mediciones ficticias.

## Verificaciones

```bash
npm run lint
npm run build
```

