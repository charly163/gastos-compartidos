import { neon } from '@netlify/neon';

type RequestBody = {
    action?: string;
    eventId?: string;
    nombre?: string;
    participanteId?: string;
    item?: string;
    monto?: number;
    id?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

export default async (request: Request) => {
    try {
        const databaseUrl = (
            process.env.NETLIFY_DATABASE_URL
            || process.env.DATABASE_URL
            || process.env.NEON_DATABASE_URL
        )?.trim();
        if (!databaseUrl) {
            return json({ error: 'No hay una variable de conexión disponible para esta función.' }, 500);
        }
        const sql = neon(databaseUrl);

        if (request.method === 'GET') {
            const eventId = new URL(request.url).searchParams.get('eventId');
            if (!eventId) return json({ error: 'Falta eventId.' }, 400);
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
                return json({ error: 'El código del evento no es válido.' }, 400);
            }

            const [evento] = await sql`SELECT id, nombre FROM eventos WHERE id = ${eventId}`;
            if (!evento) return json({ error: 'No existe un evento con ese código.' }, 404);

            const [participantes, gastos] = await Promise.all([
                sql`SELECT id, event_id, nombre FROM participantes WHERE event_id = ${eventId} ORDER BY nombre`,
                sql`SELECT g.id, g.event_id, g.participante_id, g.item, g.monto, p.nombre AS participante_nombre
            FROM gastos g
            JOIN participantes p ON p.id = g.participante_id
            WHERE g.event_id = ${eventId}
            ORDER BY g.created_at DESC`,
            ]);

            return json({
                participantes, gastos: gastos.map((gasto) => ({
                    id: gasto.id,
                    event_id: gasto.event_id,
                    participante_id: gasto.participante_id,
                    item: gasto.item,
                    monto: Number(gasto.monto),
                    participante: { id: gasto.participante_id, nombre: gasto.participante_nombre },
                }))
            });
        }

        const body = await request.json() as RequestBody;

        if (body.action === 'crear-evento') {
            const [eventoExistente] = await sql`SELECT id FROM eventos WHERE lower(trim(nombre)) = lower(trim(${body.nombre})) LIMIT 1`;
            if (eventoExistente) return json({ error: 'Ya existe un evento con ese nombre. Elige otro nombre o únete al evento existente.' }, 409);
            const [evento] = await sql`INSERT INTO eventos (nombre) VALUES (${body.nombre}) RETURNING id, nombre`;
            return json(evento, 201);
        }

        if (body.action === 'buscar-evento') {
            const eventos = await sql`SELECT id, nombre FROM eventos WHERE lower(trim(nombre)) = lower(trim(${body.nombre}))`;
            if (eventos.length === 0) return json({ error: 'No existe un evento con ese nombre.' }, 404);
            if (eventos.length > 1) return json({ error: 'Hay más de un evento con ese nombre. Usa un nombre más específico.' }, 409);
            return json(eventos[0]);
        }

        if (body.action === 'agregar-participante') {
            const [participante] = await sql`INSERT INTO participantes (event_id, nombre)
        VALUES (${body.eventId}, ${body.nombre}) RETURNING id, event_id, nombre`;
            return json(participante, 201);
        }

        if (body.action === 'eliminar-participante') {
            await sql`DELETE FROM participantes WHERE id = ${body.id}`;
            return json({ ok: true });
        }

        if (body.action === 'agregar-gasto') {
            const [gasto] = await sql`INSERT INTO gastos (event_id, participante_id, item, monto)
        VALUES (${body.eventId}, ${body.participanteId}, ${body.item}, ${body.monto})
        RETURNING id, event_id, participante_id, item, monto`;
            return json(gasto, 201);
        }

        if (body.action === 'eliminar-gasto') {
            await sql`DELETE FROM gastos WHERE id = ${body.id}`;
            return json({ ok: true });
        }

        return json({ error: 'Acción no válida.' }, 400);
    } catch (error) {
        console.error(error);
        return json({ error: 'Error interno de base de datos.' }, 500);
    }
};