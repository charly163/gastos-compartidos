import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './index.css';

// Configura el cliente de Supabase
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

interface Evento {
  id: string;
  nombre: string;
}

interface Participante {
  id: string;
  event_id: string;
  nombre: string;
}

interface Gasto {
  id: string;
  event_id: string;
  participante_id: string;
  item: string;
  monto: number;
  participante?: { id: string; nombre: string };
}

const App: React.FC = () => {
  const [eventId, setEventId] = useState('');
  const [eventNombre, setEventNombre] = useState('');
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [nuevoParticipante, setNuevoParticipante] = useState('');
  const [nuevoGasto, setNuevoGasto] = useState({ participante_id: '', item: '', monto: '' });

  // Crear o unirse a un evento
  const handleCrearEvento = async () => {
    if (!eventNombre.trim()) {
      alert('Por favor, ingresa un nombre para el evento.');
      return;
    }
    const { data, error } = await supabase.from('eventos').insert([{ nombre: eventNombre.trim() }]).select().single();
    if (error) {
      console.error('Error al crear evento:', error);
      alert('Error al crear evento.');
    } else {
      setEventId(data.id);
      setEventNombre('');
    }
  };

  const handleUnirseEvento = () => {
    if (!eventId.trim()) {
      alert('Por favor, ingresa un ID de evento válido.');
      return;
    }
    setEventId(eventId.trim());
  };

  // Cargar datos y suscripciones en tiempo real
  useEffect(() => {
    if (!eventId) return;

    const fetchParticipantes = async () => {
      const { data, error } = await supabase
        .from('participantes')
        .select('*')
        .eq('event_id', eventId);
      if (error) {
        console.error('Error al cargar participantes:', error);
      } else {
        setParticipantes(data || []);
      }
    };

    const fetchGastos = async () => {
      const { data, error } = await supabase
        .from('gastos')
        .select(`
          *,
          participantes (
            id,
            nombre
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error al cargar gastos:', error);
      } else {
        setGastos(data || []);
        console.log('Gastos cargados con participantes:', data);
      }
    };

    fetchParticipantes();
    fetchGastos();

    const participanteSubscription = supabase
      .channel(`participantes-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participantes', filter: `event_id=eq.${eventId}` }, () => {
        fetchParticipantes();
      })
      .subscribe();

    const gastoSubscription = supabase
      .channel(`gastos-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos', filter: `event_id=eq.${eventId}` }, () => {
        fetchGastos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(participanteSubscription);
      supabase.removeChannel(gastoSubscription);
    };
  }, [eventId]);

  // Agregar participante
  const agregarParticipante = async () => {
    if (!nuevoParticipante.trim() || participantes.some(p => p.nombre === nuevoParticipante.trim())) {
      alert('Por favor, ingresa un nombre válido y no repetido.');
      return;
    }
    const { error } = await supabase.from('participantes').insert([{ event_id: eventId, nombre: nuevoParticipante.trim() }]);
    if (error) {
      console.error('Error al agregar participante:', error);
      alert('Error al agregar participante.');
    } else {
      setNuevoParticipante('');
      const { data, error: fetchError } = await supabase
        .from('participantes')
        .select('*')
        .eq('event_id', eventId);
      if (fetchError) {
        console.error('Error al recargar participantes:', fetchError);
      } else {
        setParticipantes(data || []);
        console.log('Participantes recargados:', data);
      }
    }
  };

  // Eliminar participante
  const eliminarParticipante = async (id: string) => {
    if (gastos.some(g => g.participante_id === id)) {
      alert('No puedes eliminar a una persona con gastos registrados.');
      return;
    }
    const { error } = await supabase.from('participantes').delete().eq('id', id);
    if (error) {
      console.error('Error al eliminar participante:', error);
      alert('Error al eliminar participante.');
    }
  };

  // Agregar gasto
  const agregarGasto = async () => {
    if (!nuevoGasto.participante_id || !nuevoGasto.item.trim() || !nuevoGasto.monto || parseFloat(nuevoGasto.monto) <= 0) {
      alert('Por favor, selecciona un nombre, ingresa un producto válido y un monto mayor a 0.');
      return;
    }
    const { error } = await supabase.from('gastos').insert([{
      event_id: eventId,
      participante_id: nuevoGasto.participante_id,
      item: nuevoGasto.item.trim(),
      monto: parseFloat(nuevoGasto.monto),
    }]);
    if (error) {
      console.error('Error al agregar gasto:', error);
      alert('Error al agregar gasto.');
    } else {
      setNuevoGasto({ participante_id: '', item: '', monto: '' });
      const { data, error: fetchError } = await supabase
        .from('gastos')
        .select(`
          *,
          participantes (
            id,
            nombre
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (fetchError) {
        console.error('Error al recargar gastos:', fetchError);
      } else {
        setGastos(data || []);
        console.log('Gastos recargados con participantes:', data);
      }
    }
  };

  // Eliminar gasto
  const eliminarGasto = async (id: string) => {
    console.log('Intentando eliminar gasto con id:', id);
    try {
      const { data, error } = await supabase.from('gastos').delete().eq('id', id);
      if (error) {
        console.error('Error al eliminar gasto:', error.message || error);
        alert('Error al eliminar gasto: ' + (error.message || 'Intenta de nuevo'));
      } else {
        console.log('Gasto eliminado con éxito, datos devueltos:', data);
        const { data: refreshedData, error: fetchError } = await supabase
          .from('gastos')
          .select(`
            *,
            participantes (
              id,
              nombre
            )
          `)
          .eq('event_id', eventId)
          .order('created_at', { ascending: false });
        if (fetchError) {
          console.error('Error al recargar gastos después de eliminar:', fetchError);
        } else {
          setGastos(refreshedData || []);
          console.log('Gastos recargados después de eliminar:', refreshedData);
        }
      }
    } catch (err) {
      console.error('Error inesperado al eliminar gasto:', err);
      alert('Error inesperado al eliminar gasto. Revisa la consola.');
    }
  };

  // Obtener nombre del participante basado en participante_id
  const getParticipanteNombre = (participanteId: string) => {
    const participante = participantes.find(p => p.id === participanteId);
    return participante ? participante.nombre : 'Desconocido';
  };

  // Calcular resumen y liquidaciones
  const calcularResumen = () => {
    const totalGastado = gastos.reduce((sum, gasto) => sum + gasto.monto, 0);
    const porPersona = participantes.length > 0 ? totalGastado / participantes.length : 0;
    const saldos: { [key: string]: number } = {};
    participantes.forEach(p => {
      const gastado = gastos.filter(g => g.participante_id === p.id).reduce((sum, g) => sum + g.monto, 0);
      saldos[p.nombre] = gastado - porPersona;
    });

    const liquidaciones: string[] = [];
    const deudores = Object.entries(saldos).filter(([_, saldo]) => saldo < 0);
    const acreedores = Object.entries(saldos).filter(([_, saldo]) => saldo > 0);

    deudores.forEach(([deudor, deuda]) => {
      deuda = -deuda;
      while (deuda > 0.01) {
        let acreedor = acreedores.find(([_, saldo]) => saldo > 0.01);
        if (!acreedor) break;
        const [nombreAcreedor, saldoAcreedor] = acreedor;
        const monto = Math.min(deuda, saldoAcreedor);
        liquidaciones.push(`${deudor} paga a ${nombreAcreedor} $${monto.toFixed(2)}`);
        deuda -= monto;
        acreedor[1] -= monto;
      }
    });

    return { totalGastado, porPersona, saldos, liquidaciones };
  };

  const { totalGastado, porPersona, saldos, liquidaciones } = calcularResumen();

  if (!eventId) {
    return (
      <div className="container mx-auto p-4 max-w-lg">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-800">Calculadora de Gastos Compartidos</h1>
        <div className="bg-white p-4 rounded-lg shadow-md mb-4">
          <h2 className="text-lg font-semibold mb-2 text-gray-700">Crear Nuevo Evento</h2>
          <input
            type="text"
            value={eventNombre}
            onChange={(e) => setEventNombre(e.target.value)}
            placeholder="Nombre del evento (ej. Cena de Amigos)"
            className="w-full p-2 mb-2 border rounded-md"
          />
          <button
            onClick={handleCrearEvento}
            className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition"
          >
            Crear Evento
          </button>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-2 text-gray-700">Unirse a Evento Existente</h2>
          <input
            type="text"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="Ingresa el ID del evento"
            className="w-full p-2 mb-2 border rounded-md"
          />
          <button
            onClick={handleUnirseEvento}
            className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition"
          >
            Unirse a Evento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Calculadora de Gastos Compartidos</h1>
        <button
          onClick={() => setEventId('')}
          className="bg-red-500 text-white p-2 rounded-md hover:bg-red-600 transition"
        >
          Salir del Evento
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">ID del Evento: {eventId}</p>

      {/* Formulario para agregar persona */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Agregar Persona</h2>
        <input
          type="text"
          value={nuevoParticipante}
          onChange={(e) => setNuevoParticipante(e.target.value)}
          placeholder="Nombre de la persona"
          className="w-full p-2 mb-2 border rounded-md"
        />
        <button
          onClick={agregarParticipante}
          className="w-full bg-purple-500 text-white p-2 rounded-md hover:bg-purple-600 transition"
        >
          Agregar Persona
        </button>
      </div>

      {/* Lista de personas */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Personas</h2>
        <ul className="divide-y divide-gray-200">
          {participantes.map((p) => (
            <li key={p.id} className="py-2 flex justify-between">
              <span className="text-gray-800">{p.nombre}</span>
              <button
                onClick={() => {
                  console.log('Click en eliminar persona, id:', p.id);
                  eliminarParticipante(p.id);
                }}
                className="text-red-500 hover:text-red-700 transition"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Formulario para agregar gasto */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Agregar Gasto</h2>
        <select
          value={nuevoGasto.participante_id}
          onChange={(e) => setNuevoGasto({ ...nuevoGasto, participante_id: e.target.value })}
          className="w-full p-2 mb-2 border rounded-md"
        >
          <option value="" disabled>Selecciona una persona</option>
          {participantes.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <input
          type="text"
          value={nuevoGasto.item}
          onChange={(e) => setNuevoGasto({ ...nuevoGasto, item: e.target.value })}
          placeholder="Producto comprado"
          className="w-full p-2 mb-2 border rounded-md"
        />
        <input
          type="number"
          value={nuevoGasto.monto}
          onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })}
          placeholder="Monto gastado"
          step="0.01"
          className="w-full p-2 mb-2 border rounded-md"
        />
        <button
          onClick={agregarGasto}
          className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition"
        >
          Agregar Gasto
        </button>
      </div>

      {/* Lista de gastos */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Gastos</h2>
        <ul className="divide-y divide-gray-200">
          {gastos.map((g) => (
            <li key={g.id} className="py-2 flex justify-between items-center">
              <span className="text-gray-800">
                {g.participante?.nombre || getParticipanteNombre(g.participante_id)} compró {g.item} por ${g.monto.toFixed(2)}
              </span>
              <button
                onClick={() => {
                  console.log('Click en eliminar gasto, id:', g.id);
                  eliminarGasto(g.id);
                }}
                className="text-red-500 hover:text-red-700 transition ml-2"
                data-gasto-id={g.id}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Sección de Resumen, Saldos y Liquidaciones */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        {/* Resumen */}
        <div className="mb-6 border-b border-gray-200 pb-4">
          <h2 className="text-lg font-bold mb-2 text-blue-600">Resumen</h2>
          <p className="text-gray-700">Total Gastado: <span className="font-semibold">${totalGastado.toFixed(2)}</span></p>
          <p className="text-gray-700">Por Persona: <span className="font-semibold">${porPersona.toFixed(2)}</span></p>
        </div>

        {/* Saldos */}
        <div className="mb-6 border-b border-gray-200 pb-4">
          <h3 className="text-lg font-bold mb-2 text-green-600">Saldos</h3>
          <ul className="divide-y divide-gray-200">
            {Object.entries(saldos).map(([persona, saldo]) => (
              <li key={persona} className="py-2">
                <span className="text-gray-800">{persona}:</span>
                <span className={`font-semibold ml-2 ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${saldo.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Liquidaciones */}
        <div>
          <h3 className="text-lg font-bold mb-2 text-purple-600">Liquidaciones</h3>
          <ul className="divide-y divide-gray-200">
            {liquidaciones.map((l, index) => (
              <li key={index} className="py-2 text-gray-700">{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);