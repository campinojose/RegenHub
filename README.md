# RegenHub

Sistema de gestión clínica y administrativa para medicina regenerativa. Incluye pacientes, profesionales, consultas, facturación básica y generación de resúmenes PDF.

## Requisitos

- Node.js 20 o superior.
- Un proyecto de Supabase.

## Puesta en marcha

1. Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`.
2. En el SQL Editor de Supabase ejecuta `supabase/migrations/202607270001_initial_schema.sql`.
3. Crea los usuarios en Supabase Auth y sus perfiles en `perfiles_usuario`. El primer administrador debe crearse desde el SQL Editor, porque las políticas no permiten autoasignarse privilegios.
4. Instala dependencias y arranca el proyecto:

```bash
npm ci
npm run dev
```

## Roles

- `administrador`: gestiona profesionales y perfiles.
- `recepcionista`: registra pacientes y actualiza cobros.
- `asistente`: registra consultas de su médico favorito y consulta sus ingresos.
- `doctor`: consulta información clínica.

Las cédulas se guardan en el bucket privado `cedulas-pacientes`. No conviertas ese bucket en público: para mostrar archivos, crea URLs firmadas desde una ruta protegida.

## Validación

```bash
npm run lint
npx tsc --noEmit
npm run build
```
