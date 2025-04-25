// src/components/RealtimeNotifications.tsx
import { useState, useEffect } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js'; // Echo usa la librería de Pusher JS bajo el capó

// --- Configuración de Laravel Echo ---
// Idealmente, esta configuración e instancia de Echo se haría una vez
// en un nivel superior de la aplicación (ej: en App.tsx o un Context)
// y se pasaría/usaría donde sea necesario.
// Para este ejemplo conciso, lo incluimos aquí.

// Hacemos que Pusher esté disponible globalmente para Echo
declare global {
    interface Window { Pusher: any; Echo: Echo }
}
window.Pusher = Pusher;

// Reemplaza con tus credenciales y configuración de Reverb/Laravel
const REVERB_APP_KEY = import.meta.env.VITE_REVERB_APP_KEY || 'tu_reverb_app_key';
const REVERB_HOST = import.meta.env.VITE_REVERB_HOST || '127.0.0.1';
const REVERB_PORT = parseInt(import.meta.env.VITE_REVERB_PORT || '8080', 10);
const REVERB_SCHEME = import.meta.env.VITE_REVERB_SCHEME || 'http';

// Asumimos que tienes un ID de usuario (ej: obtenido tras login ContextAuth)
const USER_ID = 1; // Reemplaza con el ID del usuario logueado real

const echoInstance = new Echo({
    broadcaster: 'reverb',
    key: REVERB_APP_KEY,
    wsHost: REVERB_HOST,
    wsPort: REVERB_PORT,
    wssPort: REVERB_PORT, // Si usas TLS (wss://), ajusta según necesidad
    forceTLS: REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'], // Asegúrate de que los transportes estén habilitados
    // Endpoint de autenticación para canales privados/presence en tu backend Laravel
    // Echo hará una petición POST a esta ruta para autorizar la suscripción
    authEndpoint: '/broadcasting/auth',
     // Puedes necesitar pasar headers de autorización (ej: Bearer token)
     // auth: {
     //    headers: {
     //        Authorization: `Bearer ${tu_token_jwt}`,
     //    },
     // },
});

// --- Componente React ---

interface Notification {
    id: string; // Opcional, para key en la lista
    message: string;
    timestamp: number;
}

function RealtimeNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Canal privado específico para este usuario
        const channelName = `App.Models.User.${USER_ID}`;
        const eventName = '.NewNotificationEvent'; // Nombre del evento (ajusta según tu evento Laravel)

        console.log(`Attempting to connect to channel: private-${channelName}`);

        // Suscribirse al canal privado
        const privateChannel = echoInstance.private(channelName);

        // Escuchar el evento específico
        privateChannel.listen(eventName, (eventData: { message: string }) => {
            console.log('Notification received:', eventData);
            const newNotification: Notification = {
                id: `notif-${Date.now()}-${Math.random()}`, // Generar ID simple
                message: eventData.message,
                timestamp: Date.now(),
            };
            // Añadir la nueva notificación al principio de la lista
            setNotifications(prevNotifications => [newNotification, ...prevNotifications]);
        });

        // Manejar estado de conexión (opcional pero útil para debug)
        echoInstance.connector.pusher.connection.bind('connected', () => {
            console.log('Successfully connected to Reverb/WebSocket.');
            setIsConnected(true);
         });

         echoInstance.connector.pusher.connection.bind('error', (error: any) => {
            console.error('WebSocket Connection Error:', error);
            setIsConnected(false);
         });

         echoInstance.connector.pusher.connection.bind('disconnected', () => {
            console.log('WebSocket disconnected.');
            setIsConnected(false);
         });

        // --- Función de Limpieza ---
        // Se ejecuta cuando el componente se desmonta
        return () => {
            console.log(`Leaving channel: private-${channelName}`);
            echoInstance.leaveChannel(`private-${channelName}`);
             // Desvincular listeners de conexión (opcional, pero buena práctica)
             echoInstance.connector.pusher.connection.unbind('connected');
             echoInstance.connector.pusher.connection.unbind('error');
             echoInstance.connector.pusher.connection.unbind('disconnected');
            // Considera desconectar Echo completamente si es el último suscriptor
            // echoInstance.disconnect();
        };

    }, []); // El array vacío asegura que el efecto se ejecute solo al montar/desmontar

    return (
        <div style={{ border: '1px solid #ccc', padding: '15px', margin: '10px' }}>
            <h3>Notificaciones en Tiempo Real</h3>
            <p>Estado Conexión: {isConnected ? 'Conectado ✅' : 'Desconectado ❌'}</p>
            {notifications.length === 0 && <p>No hay notificaciones nuevas.</p>}
            <ul style={{ listStyle: 'none', padding: 0, maxHeight: '200px', overflowY: 'auto' }}>
                {notifications.map((notif) => (
                    <li key={notif.id} style={{ borderBottom: '1px dashed #eee', padding: '5px 0' }}>
                        {notif.message}
                        <small style={{ display: 'block', color: '#888' }}>
                            {new Date(notif.timestamp).toLocaleTimeString()}
                        </small>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default RealtimeNotifications;
