# INDI QR — Control de materiales (escaneo QR / código de barras)

App web (PWA) para escanear QR o códigos de barras de materiales con la cámara del celular o la webcam de la computadora, y registrar la información directamente en un formulario propio (en vez de abrir la página del código), con listado, edición y exportación a PDF/Excel.

## Configuración inicial (una sola vez)

1. **Crea un proyecto en Supabase** (gratis): entra a https://supabase.com → "New project".
2. En tu proyecto, ve a **SQL Editor** → **New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo. Esto crea la tabla `materiales` y las reglas de seguridad.
3. Ve a **Project Settings → API**. Copia:
   - `Project URL`
   - `anon public` key
4. En este proyecto, copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   y pega ahí tu URL y tu anon key.
5. Instala dependencias (si no lo has hecho) y corre el servidor de desarrollo:
   ```bash
   npm install
   npm run dev
   ```
6. Abre la URL que te da Vite. La primera vez, crea una cuenta (correo + contraseña) desde la pantalla de login — cualquier persona de tu equipo puede crear su propia cuenta y todos verán los mismos registros.
7. **(Opcional) Autocompletar el nombre al escanear un código nuevo**: instala la [Supabase CLI](https://supabase.com/docs/guides/cli) y despliega la función que consulta el nombre real del producto por su código de barras:
   ```bash
   npx supabase login
   npx supabase link --project-ref <tu-project-ref>   # está en Project Settings → General
   npx supabase functions deploy lookup-producto --no-verify-jwt
   ```
   Sin este paso la app sigue funcionando igual, solo que al registrar un código nuevo tendrás que escribir el nombre a mano.

### Usar la cámara desde el celular

El navegador solo permite usar la cámara en conexiones seguras (HTTPS) o en `localhost`. Para probar desde tu celular en la misma red, corre:
```bash
npm run dev -- --host
```
y abre en el celular la URL con la IP que te muestre (ej. `http://192.168.x.x:5173`). Si el navegador del celular bloquea la cámara por no ser HTTPS, la opción más simple es desplegar la app (Vercel/Netlify, ambos gratis) y usar esa URL con HTTPS.

## Flujo de la app

1. **Escanear**: apunta la cámara al QR o código de barras. También puedes escribir el código a mano si no se lee bien.
2. Si el código **ya existe**, se abre el formulario con los datos actuales para actualizar (por ejemplo, sumar cantidad o cambiar ubicación).
3. Si el código **es nuevo**, se abre un formulario para capturar: nombre, cantidad, unidad, ubicación, categoría y notas. Si es un código de barras real (UPC/EAN) y la función `lookup-producto` está desplegada, el nombre se autocompleta buscando el producto en [UPCitemdb](https://www.upcitemdb.com/) — siempre puedes editarlo si no es exacto o no lo encontró.
4. **Listado**: ve todos los materiales registrados, búscalos, edítalos, elimínalos, y expórtalos a **PDF** o **Excel** con un botón.

## Stack

- React + TypeScript + Vite, como PWA instalable (`vite-plugin-pwa`).
- Escaneo con [`@zxing/browser`](https://github.com/zxing-js/browser) (lee QR y códigos de barras EAN/Code128/etc.).
- Supabase (Postgres + Auth) como backend, para que celular y computadora compartan los mismos datos.
- Exportación con `jspdf` / `jspdf-autotable` (PDF) y `xlsx` (Excel).
