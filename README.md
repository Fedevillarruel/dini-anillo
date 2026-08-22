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

## Bluetooth y datos del anillo

El botón de vinculación pide una sesión y abre el selector Bluetooth del navegador compatible. Al aceptar un dispositivo, guarda su identificador y nombre bajo RLS en `rings`. La lectura de FC, SpO2, presión, pasos y sueño requiere los UUID GATT y el formato de paquetes del firmware Lefun; esos datos no están en la documentación proporcionada y la aplicación no los inventa.

## Verificaciones

```bash
npm run lint
npm run build
```

