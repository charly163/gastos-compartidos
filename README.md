# Cena Justa

Aplicación web para organizar gastos compartidos entre varias personas. Permite crear un evento, sumar participantes, registrar quién pagó cada gasto y calcular automáticamente cuánto debe pagar o recibir cada persona.

## Accesos

- **Aplicación publicada:** https://cenajusta.netlify.app
- **Repositorio:** https://github.com/charly163/gastos-compartidos
- **Hosting y despliegue:** Netlify
- **Base de datos:** PostgreSQL en Neon

## Funcionalidades

- Crear eventos por nombre.
- Unirse a eventos existentes buscando por nombre.
- Validar que el evento exista antes de ingresar.
- Evitar la creación de eventos con nombres duplicados.
- Agregar y quitar participantes.
- Registrar gastos indicando persona, concepto y monto.
- Eliminar gastos registrados.
- Calcular el total gastado y el promedio por persona.
- Mostrar el saldo individual de cada participante.
- Generar las liquidaciones necesarias entre deudores y acreedores.
- Actualizar la interfaz inmediatamente después de agregar o eliminar datos.
- Sincronizar cambios periódicamente con la base de datos.
- Diseño responsive para escritorio, tablet y móvil.

## Tecnologías

### Frontend

- **React 18:** construcción de la interfaz.
- **TypeScript:** tipado estático y mantenimiento del código.
- **React DOM:** montaje de la aplicación.
- **Create React App / react-scripts:** desarrollo y build de producción.
- **Tailwind CSS:** configuración base de estilos.
- **CSS personalizado:** identidad visual, layout responsive, animaciones y componentes de la interfaz.
- **Google Fonts:** tipografías DM Sans y Space Grotesk.

### Backend

- **Netlify Functions:** API serverless para las operaciones de la aplicación.
- **@netlify/neon:** conexión HTTP desde las funciones hacia PostgreSQL.
- **Neon:** PostgreSQL serverless utilizado como base de datos.

### Despliegue

- **Netlify:** sirve el frontend compilado y ejecuta la función serverless.
- El build se genera con `npm run build`.
- Los archivos estáticos se publican desde `build`.
- Las funciones se encuentran en `netlify/functions`.

## Arquitectura

La aplicación está dividida en dos partes:

1. El frontend React, ubicado principalmente en `src/index.tsx` y `src/index.css`.
2. La API serverless ubicada en `netlify/functions/api.ts`.

El navegador no se conecta directamente a Neon. Las operaciones se realizan mediante la función serverless de Netlify, que utiliza la variable secreta de conexión y ejecuta las consultas SQL.

### Flujo de una operación

```text
Usuario
  |
  v
Frontend React
  |
  v
Netlify Function: /.netlify/functions/api
  |
  v
Neon PostgreSQL
```

La aplicación usa una actualización optimista para que los cambios aparezcan de inmediato en pantalla. Además, realiza una sincronización periódica cada 10 segundos para mantener los datos actualizados entre distintos usuarios.

## Base de datos

La base de datos está alojada en **Neon** como PostgreSQL. El esquema se encuentra en [netlify/schema.sql](netlify/schema.sql).

### Tablas

- `eventos`: guarda el nombre y la fecha de creación de cada evento.
- `participantes`: relaciona personas con eventos.
- `gastos`: guarda el concepto, monto y participante que realizó cada pago.

### Relaciones

- Un evento tiene muchos participantes.
- Un evento tiene muchos gastos.
- Cada gasto pertenece a un participante.
- Si se elimina un evento, se eliminan sus participantes y gastos relacionados.
- No se puede eliminar un participante que tenga gastos registrados.

## Variables de entorno

La conexión con Neon debe configurarse en Netlify como una variable secreta disponible para **Functions**:

```text
NETLIFY_DATABASE_URL=postgresql://usuario:contraseña@host.neon.tech/base?sslmode=require
```

La función también acepta `DATABASE_URL` y `NEON_DATABASE_URL` como nombres alternativos.

No se deben subir al repositorio la contraseña ni la cadena real de conexión. Para desarrollo local se puede tomar como referencia [.env.example](.env.example).

## Desarrollo local

Requisitos:

- Node.js y npm.
- Acceso a una base PostgreSQL de Neon.
- Variable `NETLIFY_DATABASE_URL` configurada.

Instalar dependencias:

```bash
npm install
```

Iniciar el frontend:

```bash
npm start
```

Crear el build de producción:

```bash
npm run build
```

Para probar las funciones de Netlify localmente, se recomienda utilizar Netlify CLI y ejecutar el proyecto con `netlify dev`, ya que las funciones necesitan acceder a las variables de entorno del entorno serverless.

## Despliegue

El sitio de Netlify está vinculado al repositorio de GitHub y a la rama `main`.

Configuración esperada en Netlify:

- **Build command:** `npm run build`
- **Publish directory:** `build`
- **Functions directory:** `netlify/functions`
- **Variable requerida:** `NETLIFY_DATABASE_URL` o una alternativa compatible, disponible para Functions

La configuración se encuentra en [netlify.toml](netlify.toml). Cada push a `main` puede iniciar un nuevo deploy automático.

## API serverless

La función `netlify/functions/api.ts` expone estas operaciones:

- `POST` con `action: crear-evento`: crea un evento nuevo.
- `POST` con `action: buscar-evento`: busca un evento por nombre.
- `POST` con `action: agregar-participante`: agrega una persona.
- `POST` con `action: eliminar-participante`: elimina una persona sin gastos asociados.
- `POST` con `action: agregar-gasto`: registra un gasto.
- `POST` con `action: eliminar-gasto`: elimina un gasto.
- `GET ?eventId=...`: devuelve participantes y gastos del evento.

La ruta pública de la función es:

```text
https://cenajusta.netlify.app/.netlify/functions/api
```

## Estructura principal

```text
.
├── netlify/
│   ├── functions/
│   │   └── api.ts       # API serverless
│   └── schema.sql       # Esquema PostgreSQL para Neon
├── public/
│   └── index.html        # HTML base
├── src/
│   ├── index.tsx        # Aplicación React y lógica de negocio
│   └── index.css        # Estilos globales y responsive
├── .env.example          # Ejemplo de variables locales
├── netlify.toml          # Configuración de build, funciones y rutas
├── package.json          # Dependencias y scripts
└── tailwind.config.js    # Configuración de Tailwind
```

## Scripts disponibles

- `npm start`: inicia el entorno de desarrollo.
- `npm run build`: crea el build de producción.
- `npm test`: ejecuta los tests de React.
- `npm run eject`: expone la configuración interna de Create React App.

## Seguridad

- La cadena de conexión de Neon sólo debe existir como variable secreta de Netlify.
- El frontend no recibe ni expone las credenciales de la base de datos.
- No se deben guardar archivos `.env` con secretos en GitHub.
- Las consultas a la base se ejecutan exclusivamente desde Netlify Functions.

## Estado actual

La versión publicada utiliza Neon como base de datos y Netlify como plataforma de hosting, build y backend serverless. El frontend y las funciones se despliegan desde la rama `main` del repositorio de GitHub.
